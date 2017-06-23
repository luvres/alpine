#!/bin/bash

# Build script to create Mac App Bundle and DMG for pgAdmin4 runtime

export WD=$(cd `dirname $0` && pwd)
export SOURCEDIR=$WD/../..
export BUILDROOT=$WD/../../mac-build
export DISTROOT=$WD/../../dist
export VIRTUALENV=venv

if [ "x$PYTHON_HOME" == "x" ]; then
    echo "PYTHON_HOME not set. Setting it to default"
    export PYTHON_HOME=/System/Library/Frameworks/Python.framework/Versions/2.7
    export PYTHON_VERSION=27
fi

# Check if Python is working and calculate PYTHON_VERSION
if $PYTHON_HOME/bin/python2 -V > /dev/null 2>&1; then
    export PYTHON_VERSION=`$PYTHON_HOME/bin/python2 -V 2>&1 | awk '{print $2}' | cut -d"." -f1-2 | sed 's/\.//'`
elif $PYTHON_HOME/bin/python3 -V > /dev/null 2>&1; then
    export PYTHON_VERSION=`$PYTHON_HOME/bin/python3 -V 2>&1 | awk '{print $2}' | cut -d"." -f1-2 | sed 's/\.//'`
else
    echo "Error: Python installation missing!"
    exit 1
fi

if [ "$PYTHON_VERSION" -gt "34" -a "$PYTHON_VERSION" -lt "26" ]; then
    echo "Python version not supported"
    exit 1
fi

if [ "$PYTHON_VERSION" -ge "30" ]; then
    export PYTHON=$PYTHON_HOME/bin/python3
    export PIP=pip3
    export REQUIREMENTS=requirements_py3.txt
else
    export PYTHON=$PYTHON_HOME/bin/python2
    export PIP=pip
    export REQUIREMENTS=requirements_py2.txt
fi

if [ "x$QTDIR" == "x" ]; then
    echo "QTDIR not set. Setting it to default"
    export QTDIR=~/Qt/5.5/clang_64
fi
export QMAKE=$QTDIR/bin/qmake
if ! $QMAKE --version > /dev/null 2>&1; then
    echo "Error: qmake not found. QT installation is not present or incomplete."
    exit 1
fi

if [ "x$PGDIR" == "x" ]; then
    echo "PGDIR not set. Setting it to default"
    export PGDIR=/usr/local/pgsql
fi

_get_version() {
    export APP_RELEASE=`grep "^APP_RELEASE" web/config.py | cut -d"=" -f2 | sed 's/ //g'`
    export APP_REVISION=`grep "^APP_REVISION" web/config.py | cut -d"=" -f2 | sed 's/ //g'`
    export APP_NAME=`grep "^APP_NAME" web/config.py | cut -d"=" -f2 | sed "s/'//g" | sed 's/^ //'`
    export APP_BUNDLE_NAME=$APP_NAME.app
    export APP_LONG_VERSION=$APP_RELEASE.$APP_REVISION
    export APP_SHORT_VERSION=`echo $APP_LONG_VERSION | cut -d . -f1,2`
    export APP_SUFFIX=`grep "^APP_SUFFIX" web/config.py | cut -d"=" -f2 | sed 's/ //g' | sed "s/'//g"`
    if [ ! -z $APP_SUFFIX ]; then
        export APP_LONG_VERSION=$APP_LONG_VERSION-$APP_SUFFIX
    fi
}

_cleanup() {
    echo "Cleaning up the old environment and app bundle"
    rm -rf $SOURCEDIR/runtime/pgAdmin4.app
    rm -rf $BUILDROOT
    rm -f $DISTROOT/pgadmin4*.dmg
}

_create_python_virtualenv() {
    export PATH=$PGDIR/bin:$PATH
    export LD_LIBRARY_PATH=$PGDIR/lib:$_LD_LIBRARY_PATH
    test -d $BUILDROOT || mkdir $BUILDROOT || exit 1
    cd $BUILDROOT
    test -d $VIRTUALENV || virtualenv -p $PYTHON $VIRTUALENV || exit 1
    source $VIRTUALENV/bin/activate
    $PIP install -r $SOURCEDIR/$REQUIREMENTS || { echo PIP install failed. Please resolve the issue and rerun the script; exit 1; }

    # Figure out some paths for use when completing the venv
    # Use "python" here as we want the venv path
    export PYMODULES_PATH=`python -c "from distutils.sysconfig import get_python_lib; print(get_python_lib())"`
    export DIR_PYMODULES_PATH=`dirname $PYMODULES_PATH`
    
    # Use $PYTHON here as we want the system path
    export PYSYSLIB_PATH=`$PYTHON -c "import sys; print '%s/lib/python%d.%.d' % (sys.prefix, sys.version_info.major, sys.version_info.minor)"`
    
    # Symlink in the rest of the Python libs. This is required because the runtime
    # will clear PYTHONHOME for safety, which has the side-effect of preventing
    # it from finding modules that are note explicitly included in the venv
    cd $DIR_PYMODULES_PATH
    
    # Files
    for FULLPATH in $PYSYSLIB_PATH/*.py; do
        FILE=${FULLPATH##*/}
        if [ ! -e $FILE ]; then
           ln -s $FULLPATH $FILE
        fi
    done
    
    # Paths
    for FULLPATH in $PYSYSLIB_PATH/*/; do
        FULLPATH=${FULLPATH%*/}
        FILE=${FULLPATH##*/}
        if [ ! -e $FILE ]; then
            ln -s $FULLPATH $FILE
        fi
    done
    
    # Move the python<version> directory to python so that the private environment path is found by the application.
    if test -d $DIR_PYMODULES_PATH; then
        mv $DIR_PYMODULES_PATH $DIR_PYMODULES_PATH/../python
    fi
}

_build_runtime() {
    _create_python_virtualenv || exit 1
    cd $SOURCEDIR/runtime
    $QMAKE || { echo qmake failed; exit 1; }
    make || { echo make failed; exit 1; }
    cp -r pgAdmin4.app "$BUILDROOT/$APP_BUNDLE_NAME"
}

_build_doc() {
    cd $SOURCEDIR/docs/en_US
    # Commenting the build as it is taken care by Makefile
    #LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 make -f Makefile.sphinx html || exit 1
    test -d "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources" || "mkdir -p $BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources"
    test -d "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/docs/en_US" || mkdir -p "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/docs/en_US"
    cp -r _build/html "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/docs/en_US/" || exit 1
}

_complete_bundle() {
    cd $SOURCEDIR/pkg/mac
    
    # Replace the place holders with the current version
    sed -e "s/PGADMIN_LONG_VERSION/$APP_LONG_VERSION/g" -e "s/PGADMIN_SHORT_VERSION/$APP_SHORT_VERSION/g" pgadmin.Info.plist.in > pgadmin.Info.plist

    # copy Python private environment to app bundle
    cp -PR $BUILDROOT/$VIRTUALENV "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/" || exit 1

    # remove the python bin and include from app bundle as it is not needed
    rm -rf "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/$VIRTUALENV/bin" "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/$VIRTUALENV/include"
    rm -rf "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/$VIRTUALENV/.Python"

    # run complete-bundle to copy the dependent libraries and frameworks and fix the rpaths
    ./complete-bundle.sh "$BUILDROOT/$APP_BUNDLE_NAME" || { echo complete-bundle.sh failed; exit 1; }

    # copy the web directory to the bundle as it is required by runtime
    cp -r $SOURCEDIR/web "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/" || exit 1
    cd "$BUILDROOT/$APP_BUNDLE_NAME/Contents/Resources/web"
    rm -f pgadmin4.db config_local.*
    echo "SERVER_MODE = False" > config_distro.py
    echo "MINIFY_HTML = False" >> config_distro.py
    echo "HELP_PATH = '../../../docs/en_US/html/'" >> config_distro.py

    # Remove the .pyc files if any
    cd "$BUILDROOT/$APP_BUNDLE_NAME"
    find . -name *.pyc | xargs rm -f
}

_codesign_bundle() {
    cd $SOURCEDIR/pkg/mac
    
    if [ ! -f codesign.conf ]; then
        echo
        echo "******************************************************************"
        echo "* codesign.conf not found. NOT signing the bundle."
        echo "******************************************************************"
        echo
        sleep 5
        return
    fi

    ./codesign-bundle.sh "$BUILDROOT/$APP_BUNDLE_NAME" || { echo codesign-bundle.sh failed; exit 1; }    
}

_create_dmg() {
    cd $SOURCEDIR
    ./pkg/mac/create-dmg.sh || { echo create-dmg.sh failed; exit 1; }
    # Clean the mac-build/ on successful build
    rm -rf $BUILDROOT/*
}

_codesign_dmg() {
    cd $SOURCEDIR/pkg/mac
    
    if [ ! -f codesign.conf ]; then
        echo
        echo "******************************************************************"
        echo "* codesign.conf not found. NOT signing the disk image."
        echo "******************************************************************"
        echo
        sleep 5
        return
    fi

    ./codesign-dmg.sh || { echo codesign-bundle.sh failed; exit 1; }    
}

_get_version || { echo Could not get versioning; exit 1; }
_cleanup
_build_runtime || { echo Runtime build failed; exit 1; }
_build_doc
_complete_bundle
_codesign_bundle
_create_dmg
_codesign_dmg