# #################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2016, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
# ##################################################################
import uuid

from regression import test_utils as utils
from regression import parent_node_dict
from pgadmin.utils.route import BaseTestGenerator
from pgadmin.browser.server_groups.servers.tests import utils as server_utils
from pgadmin.browser.server_groups.servers.databases.tests import utils as \
    database_utils
from pgadmin.browser.server_groups.servers.databases.schemas.tests import \
    utils as schema_utils
from . import utils as trigger_funcs_utils


class TriggerFuncDeleteTestCase(BaseTestGenerator):
    """ This class will delete the trigger function under schema node. """
    scenarios = [
        # Fetching default URL for trigger function node.
        ('Fetch Trigger Function Node URL',
         dict(url='/browser/trigger_function/obj/'))
    ]

    def setUp(self):
        self.db_name = parent_node_dict["database"][-1]["db_name"]
        self.schema_name = parent_node_dict["schema"][-1]["schema_name"]
        self.schema_id = parent_node_dict["schema"][-1]["schema_id"]
        func_name = "test_event_delete_%s" % str(uuid.uuid4())[1:6]
        db_user = self.server["username"]
        self.function_info = trigger_funcs_utils.create_trigger_function(
            self.server, self.db_name, self.schema_name, func_name)

    def runTest(self):
        """ This function will delete trigger function under database node. """
        schema_info = parent_node_dict["schema"][-1]
        server_id = schema_info["server_id"]
        db_id = schema_info["db_id"]
        db_con = database_utils.connect_database(self, utils.SERVER_GROUP,
                                                 server_id, db_id)
        if not db_con['data']["connected"]:
            raise Exception("Could not connect to database to add collation.")
        schema_response = schema_utils.verify_schemas(self.server,
                                                      self.db_name,
                                                      self.schema_name)
        if not schema_response:
            raise Exception("Could not find the schema to add the collation.")
        trigger_func_id = self.function_info[0]
        response = self.tester.delete(
            self.url + str(utils.SERVER_GROUP) + '/'
            + str(server_id) + '/' + str(db_id) + '/' +
            str(self.schema_id) + '/' + str(trigger_func_id),
            content_type='html/json')
        self.assertEquals(response.status_code, 200)
        # Disconnect the database
        database_utils.disconnect_database(self, server_id, db_id)

    def tearDown(self):
        pass
