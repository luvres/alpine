//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2016, The pgAdmin Development Team
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
#include <QtWebKitWidgets>
#else
#include <QMainWindow>
#include <QWebView>
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
    void finishLoading(bool);
    void urlLinkClicked(const QUrl &);
    void closetabs();
    void tabTitleChanged(const QString &);

private slots:
    void openUrl();
    void preferences();
    void about();
    void zoomIn();
    void zoomOut();

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

    bool m_initialLoad;
    int m_loadAttempt;
    QString m_downloadFilename;
    int m_downloadStarted;
    int m_downloadCancelled;
    QFile *m_file;
    QProgressDialog *m_progressDialog;
    QString m_defaultFilename;
    QString m_last_open_folder_path;
    QString m_dir;
    QNetworkReply *m_reply;

    void createActions();
    void pause(int seconds = 1);
    int  findURLTab(const QUrl &name);
};

#endif // BROWSERWINDOW_H
