FROM izone/alpine:lighttpd
MAINTAINER Leonardo Loures <luvres@hotmail.com>

RUN apk add --no-cache \
    php7-common \
    php7-iconv \
    php7-json \
    php7-gd \
    php7-curl \
    php7-xml \
    php7-dom \
    php7-imap \
    php7-cgi \
    fcgi \
    php7-fpm \
  \
    php7-sqlite3 \
    php7-mysqli \
    php7-pgsql \
  \
    php7-pdo \
    php7-pdo_sqlite \
    php7-pdo_mysql \
    php7-pdo_pgsql \
    php7-odbc \
    php7-pdo_odbc \
    php7-pdo_dblib \
  \
    php7-soap \
    php7-xmlrpc \
    php7-posix \
    php7-mcrypt \
    php7-gettext \
    php7-ldap \
    php7-ctype \
  \
    php7-session \
    php7-openssl \
    php7-mbstring \
    php7-zip \
    php7-bz2 \
    php7-bcmath \
    php7-xmlreader \
  \
	php7-zlib \
	php7-simplexml \
	php7-fileinfo \
	php7-tokenizer \
	php7-intl \
  \
    && mkdir -p /run/lighttpd/ \
    && chown www-data. /run/lighttpd/ \
#    && sed -i '/session.save_path = "\/tmp"/s/;//' /etc/php7/php.ini
#    && ln -s /usr/bin/php-cgi7 /usr/bin/php-cgi
  \
    && mkdir /var/data \
    && chown -R www-data:1000 /var/data

ADD lighttpd.conf /etc/lighttpd/lighttpd.conf

VOLUME /var/www

EXPOSE 80

CMD php-fpm7 -D && lighttpd -D -f /etc/lighttpd/lighttpd.conf

