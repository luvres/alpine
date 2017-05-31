//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2017, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
// BrowserWindow.h - Declaration of the main window class
//
//////////////////////////////////////////////////////////////////////////

#ifndef BROWSERWINDOW_H
#define BROWSERWINDOW_H

#include "pgAdmin4.h"
#include "TabWindow.h"
#include "WebViewWindow.h"

#if QT_VERSION >= 0x050000
#include <QtWidgets>
#ifdef PGADMIN4_USE_WEBENGINE
#include <QtWebEngineWidgets>
#else
#include <QtWebKitWidgets>
#endif
#else
#include <QMainWindow>
#ifdef PGADMIN4_USE_WEBENGINE
#include <QtWebEngineView>
#else
#include <QWebView>
#endif
#endif

QT_BEGIN_NAMESPACE
class QAction;
class QMenu;
QT_END_NAMESPACE

class BrowserWindow : public QMainWindow
{
    Q_OBJECT

public:
    BrowserWindow(QString url);

protected:
    void closeEvent(QCloseEvent *event);

protected slots:
    void urlLinkClicked(const QUrl &);
    void closetabs();
    void tabTitleChanged(const QString &);
#ifdef __APPLE__
  #ifdef PGADMIN4_USE_WEBENGINE
    void onMacCut();
    void onMacCopy();
    void onMacPaste();
  #endif
#endif

private slots:
    void openUrl();
    void preferences();
    void about();
    void zoomIn();
    void zoomOut();
#ifdef PGADMIN4_USE_WEBENGINE
    void downloadRequested(QWebEngineDownloadItem *download);
#endif

public slots:
    void tabIndexChanged(int index);
    void goBackPage();
    void goForwardPage();
    void download(const QNetworkRequest &request);
    void unsupportedContent(QNetworkReply * reply);
    void downloadFinished();
    void downloadFileProgress(qint64 , qint64 );
    void progressCanceled();
    void current_dir_path(const QString &dir);
#ifdef PGADMIN4_USE_WEBENGINE
    void createNewTabWindow(QWebEnginePage * &);
    void downloadEngineFileProgress(qint64 , qint64 );
    void downloadEngineFinished();
#endif

private:
    QString m_appServerUrl;
    WebViewWindow *m_mainWebView;

    QShortcut *openUrlShortcut;
    QShortcut *preferencesShortcut;
    QShortcut *exitShortcut;
    QShortcut *aboutShortcut;
    QShortcut *zoomInShortcut;
    QShortcut *zoomOutShortcut;

    QGridLayout  *m_tabGridLayout;
    QGridLayout  *m_mainGridLayout;
    TabWindow    *m_tabWidget;
    QWidget      *m_pgAdminMainTab;

    QWidget           *m_addNewTab;
    QGridLayout       *m_addNewGridLayout;
    WebViewWindow     *m_addNewWebView;
    QHBoxLayout       *m_horizontalLayout;
    QWidget           *m_widget;
    QToolButton       *m_toolBtnBack;
    QToolButton       *m_toolBtnForward;

    QString m_downloadFilename;
    int m_downloadStarted;
    int m_downloadCancelled;
    QFile *m_file;
    QProgressDialog *m_progressDialog;
    QString m_defaultFilename;
    QString m_last_open_folder_path;
    QString m_dir;
    QNetworkReply *m_reply;
#ifdef PGADMIN4_USE_WEBENGINE
    QWebEngineDownloadItem *m_download;
#endif

    void createActions();
    void pause(int seconds = 1);
    int  findURLTab(const QUrl &name);

#ifdef __APPLE__
  #ifdef PGADMIN4_USE_WEBENGINE
    void triggerWebViewWindowEvents(QWebEnginePage::WebAction action);
  #endif
#endif
};

#endif // BROWSERWINDOW_H
