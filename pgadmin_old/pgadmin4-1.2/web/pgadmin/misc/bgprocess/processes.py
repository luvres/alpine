# -*- coding: utf-8 -*-
##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2017, The pgAdmin Development Team
# This software is released under the PostgreSQL License
#
##########################################################################

"""
Introduce a function to run the process executor in detached mode.
"""
from __future__ import print_function, unicode_literals

import csv
import os
import sys
from abc import ABCMeta, abstractproperty, abstractmethod
from datetime import datetime
from pickle import dumps, loads
from subprocess import Popen

import pytz
from dateutil import parser
from flask import current_app
from flask_babel import gettext as _
from flask_security import current_user

import config
from pgadmin.model import Process, db

if sys.version_info < (3,):
    from StringIO import StringIO
else:
    from io import StringIO


def get_current_time(format='%Y-%m-%d %H:%M:%S.%f %z'):
    """
    Generate the current time string in the given format.
    """
    return datetime.utcnow().replace(
        tzinfo=pytz.utc
    ).strftime(format)


class IProcessDesc(object):
    __metaclass__ = ABCMeta

    @abstractproperty
    def message(self):
        pass

    @abstractmethod
    def details(self, cmd, args):
        pass


class BatchProcess(object):
    def __init__(self, **kwargs):

        self.id = self.desc = self.cmd = self.args = self.log_dir = \
            self.stdout = self.stderr = self.stime = self.etime = \
            self.ecode = None

        if 'id' in kwargs:
            self._retrieve_process(kwargs['id'])
        else:
            self._create_process(kwargs['desc'], kwargs['cmd'], kwargs['args'])

    def _retrieve_process(self, _id):
        p = Process.query.filter_by(pid=_id, user_id=current_user.id).first()

        if p is None:
            raise LookupError(
                _("Could not find a process with the specified ID.")
            )

        # ID
        self.id = _id
        # Description
        self.desc = loads(p.desc)
        # Status Acknowledged time
        self.atime = p.acknowledge
        # Command
        self.cmd = p.command
        # Arguments
        self.args = p.arguments
        # Log Directory
        self.log_dir = p.logdir
        # Standard ouput log file
        self.stdout = os.path.join(p.logdir, 'out')
        # Standard error log file
        self.stderr = os.path.join(p.logdir, 'err')
        # Start time
        self.stime = p.start_time
        # End time
        self.etime = p.end_time
        # Exit code
        self.ecode = p.exit_code

    def _create_process(self, _desc, _cmd, _args):
        ctime = get_current_time(format='%y%m%d%H%M%S%f')
        log_dir = os.path.join(
            config.SESSION_DB_PATH, 'process_logs'
        )

        def random_number(size):
            import random
            import string

            return ''.join(
                random.choice(
                    string.ascii_uppercase + string.digits
                ) for _ in range(size)
            )

        created = False
        size = 0
        id = ctime
        while not created:
            try:
                id += random_number(size)
                log_dir = os.path.join(log_dir, id)
                size += 1
                if not os.path.exists(log_dir):
                    os.makedirs(log_dir, int('700', 8))
                    created = True
            except OSError as oe:
                import errno
                if oe.errno != errno.EEXIST:
                    raise

        # ID
        self.id = ctime
        # Description
        self.desc = _desc
        # Status Acknowledged time
        self.atime = None
        # Command
        self.cmd = _cmd
        # Log Directory
        self.log_dir = log_dir
        # Standard ouput log file
        self.stdout = os.path.join(log_dir, 'out')
        # Standard error log file
        self.stderr = os.path.join(log_dir, 'err')
        # Start time
        self.stime = None
        # End time
        self.etime = None
        # Exit code
        self.ecode = None

        # Arguments
        self.args = _args
        args_csv_io = StringIO()
        csv_writer = csv.writer(
            args_csv_io, delimiter=str(','), quoting=csv.QUOTE_MINIMAL
        )
        csv_writer.writerow(_args)

        j = Process(
            pid=int(id), command=_cmd,
            arguments=args_csv_io.getvalue().strip(str('\r\n')),
            logdir=log_dir, desc=dumps(self.desc), user_id=current_user.id
        )
        db.session.add(j)
        db.session.commit()

    def start(self):

        def which(program, paths):
            def is_exe(fpath):
                return os.path.exists(fpath) and os.access(fpath, os.X_OK)

            for path in paths:
                if not os.path.isdir(path):
                    continue
                exe_file = os.path.join(path, program)
                if is_exe(exe_file):
                    return exe_file
            return None

        def convert_environment_variables(env):
            """
            This function is use to convert environment variable to string
            because environment variable must be string in popen
            :param env: Dict of environment variable
            :return: Encoded environment variable as string
            """
            encoding = sys.getdefaultencoding()
            temp_env = dict()
            for key, value in env.items():
                if not isinstance(key, str):
                    key = key.encode(encoding)
                if not isinstance(value, str):
                    value = value.encode(encoding)
                temp_env[key] = value
            return temp_env

        if self.stime is not None:
            if self.etime is None:
                raise Exception(_('The process has already been started.'))
            raise Exception(
                _('The process has already finished and can not be restarted.')
            )

        executor = os.path.join(
            os.path.dirname(__file__), 'process_executor.py'
        )
        paths = sys.path[:]
        interpreter = None

        if os.name == 'nt':
            paths.insert(0, os.path.join(sys.prefix, 'Scripts'))
            paths.insert(0, os.path.join(sys.prefix))

            interpreter = which('pythonw.exe', paths)
            if interpreter is None:
                interpreter = which('python.exe', paths)
        else:
            paths.insert(0, os.path.join(sys.prefix, 'bin'))
            interpreter = which('python', paths)

        p = None
        cmd = [
            interpreter if interpreter is not None else 'python',
            executor, self.cmd
        ]
        cmd.extend(self.args)

        command = []
        for c in cmd:
            command.append(str(c))

        current_app.logger.info(
            "Executing the process executor with the arguments: %s",
            ' '.join(command)
        )
        cmd = command

        # Make a copy of environment, and add new variables to support
        env = os.environ.copy()
        env['PROCID'] = self.id
        env['OUTDIR'] = self.log_dir
        env['PGA_BGP_FOREGROUND'] = "1"

        # We need environment variables & values in string
        env = convert_environment_variables(env)

        if os.name == 'nt':
            DETACHED_PROCESS = 0x00000008
            from subprocess import CREATE_NEW_PROCESS_GROUP

            # We need to redirect the standard input, standard output, and
            # standard error to devnull in order to allow it start in detached
            # mode on
            stdout = os.devnull
            stderr = stdout
            stdin = open(os.devnull, "r")
            stdout = open(stdout, "a")
            stderr = open(stderr, "a")

            p = Popen(
                cmd, close_fds=False, env=env, stdout=stdout.fileno(),
                stderr=stderr.fileno(), stdin=stdin.fileno(),
                creationflags=(CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS)
            )
        else:
            def preexec_function():
                import signal
                # Detaching from the parent process group
                os.setpgrp()
                # Explicitly ignoring signals in the child process
                signal.signal(signal.SIGINT, signal.SIG_IGN)

            p = Popen(
                cmd, close_fds=True, stdout=None, stderr=None, stdin=None,
                preexec_fn=preexec_function, env=env
            )

        self.ecode = p.poll()

        # Execution completed immediately.
        # Process executor can not update the status, if it was not able to
        # start properly.
        if self.ecode is not None and self.ecode != 0:
            # There is no way to find out the error message from this process
            # as standard output, and standard error were redirected to
            # devnull.
            p = Process.query.filter_by(
                pid=self.id, user_id=current_user.id
            ).first()
            p.start_time = p.end_time = get_current_time()
            if not p.exit_code:
                p.exit_code = self.ecode
            db.session.commit()

    def status(self, out=0, err=0):
        import re

        ctime = get_current_time(format='%Y%m%d%H%M%S%f')

        stdout = []
        stderr = []
        out_completed = err_completed = False
        process_output = (out != -1 and err != -1)
        enc = sys.getdefaultencoding()

        def read_log(logfile, log, pos, ctime):
            completed = True
            idx = 0
            c = re.compile(r"(\d+),(.*$)")

            if not os.path.isfile(logfile):
                return 0, False

            with open(logfile, 'rb') as f:
                eofs = os.fstat(f.fileno()).st_size
                f.seek(pos, 0)
                while pos < eofs:
                    idx += 1
                    line = f.readline()
                    line = line.decode(enc, 'replace')
                    r = c.split(line)
                    if r[1] > ctime:
                        completed = False
                        break
                    log.append([r[1], r[2]])
                    pos = f.tell()
                    if idx == 1024:
                        completed = False
                        break
                    if pos == eofs:
                        completed = True
                        break

            return pos, completed

        if process_output:
            out, out_completed = read_log(self.stdout, stdout, out, ctime)
            err, err_completed = read_log(self.stderr, stderr, err, ctime)

        j = Process.query.filter_by(
            pid=self.id, user_id=current_user.id
        ).first()

        execution_time = None

        if j is not None:
            status, updated = BatchProcess.update_process_info(j)
            if updated:
                db.session.commit()
            self.stime = j.start_time
            self.etime = j.end_time
            self.ecode = j.exit_code

            if self.stime is not None:
                stime = parser.parse(self.stime)
                etime = parser.parse(self.etime or get_current_time())

                execution_time = (etime - stime).total_seconds()

            if process_output and self.ecode is not None and (
                len(stdout) + len(stderr) < 1024
            ):
                out, out_completed = read_log(self.stdout, stdout, out, ctime)
                err, err_completed = read_log(self.stderr, stderr, err, ctime)
        else:
            out_completed = err_completed = False

        if out == -1 or err == -1:
            return {
                'start_time': self.stime,
                'exit_code': self.ecode,
                'execution_time': execution_time
            }

        return {
            'out': {'pos': out, 'lines': stdout, 'done': out_completed},
            'err': {'pos': err, 'lines': stderr, 'done': err_completed},
            'start_time': self.stime,
            'exit_code': self.ecode,
            'execution_time': execution_time
        }

    @staticmethod
    def update_process_info(p):
        if p.start_time is None or p.end_time is None:
            status = os.path.join(p.logdir, 'status')
            if not os.path.isfile(status):
                return False, False

            with open(status, 'r') as fp:
                import json
                try:
                    data = json.load(fp)

                    #  First - check for the existance of 'start_time'.
                    if 'start_time' in data and data['start_time']:
                        p.start_time = data['start_time']

                        # We can't have 'exit_code' without the 'start_time'
                        if 'exit_code' in data and \
                                data['exit_code'] is not None:
                            p.exit_code = data['exit_code']

                            # We can't have 'end_time' without the 'exit_code'.
                            if 'end_time' in data and data['end_time']:
                                p.end_time = data['end_time']

                    return True, True

                except ValueError as e:
                    current_app.logger.warning(
                        _("Status for the background process '{0}' couldn't be loaded!").format(
                            p.pid
                        )
                    )
                    current_app.logger.exception(e)
                    return False, False
        return True, False

    @staticmethod
    def list():
        processes = Process.query.filter_by(user_id=current_user.id)
        changed = False

        res = []
        for p in processes:
            status, updated = BatchProcess.update_process_info(p)
            if not status:
                continue

            if not changed:
                changed = updated

            if p.start_time is None or (
                p.acknowledge is not None and p.end_time is None
            ):
                continue

            execution_time = None

            stime = parser.parse(p.start_time)
            etime = parser.parse(p.end_time or get_current_time())

            execution_time = (etime - stime).total_seconds()
            desc = loads(p.desc)
            details = desc

            if isinstance(desc, IProcessDesc):
                args = []
                args_csv = StringIO(p.arguments)
                args_reader = csv.reader(args_csv, delimiter=str(','))
                for arg in args_reader:
                    args = args + arg
                details = desc.details(p.command, args)
                desc = desc.message

            res.append({
                'id': p.pid,
                'desc': desc,
                'details': details,
                'stime': stime,
                'etime': p.end_time,
                'exit_code': p.exit_code,
                'acknowledge': p.acknowledge,
                'execution_time': execution_time
            })

        if changed:
            db.session.commit()

        return res

    @staticmethod
    def acknowledge(_pid):
        """
        Acknowledge from the user, he/she has alredy watched the status.

        Update the acknowledgement status, if the process is still running.
        And, delete the process information from the configuration, and the log
        files related to the process, if it has already been completed.
        """
        p = Process.query.filter_by(
            user_id=current_user.id, pid=_pid
        ).first()

        if p is None:
            raise LookupError(
                _("Could not find a process with the specified ID.")
            )

        if p.end_time is not None:
            logdir = p.logdir
            db.session.delete(p)
            import shutil
            shutil.rmtree(logdir, True)
        else:
            p.acknowledge = get_current_time()

        db.session.commit()
