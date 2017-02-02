//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2016, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
// WebViewWindow.cpp - Implementation of the custom web view widget
//
//////////////////////////////////////////////////////////////////////////

#include "pgAdmin4.h"

// App headers
#include "WebViewWindow.h"

WebViewWindow::WebViewWindow(QWidget *parent) :
    QWebView(parent)
{
    m_url = QString("");
    m_tabIndex = 0;
}

void WebViewWindow::setFirstLoadURL(const QString &url)
{
    m_url = url;
}

QString WebViewWindow::getFirstLoadURL() const
{
    return m_url;
}

void WebViewWindow::setTabIndex(const int &tabIndex)
{
    m_tabIndex = tabIndex;
}

int WebViewWindow::getTabIndex() const
{
    return m_tabIndex;
}
