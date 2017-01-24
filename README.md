## Alpine Linux
-----
### MySQL (MariaDB)
##### Pull image
```
docker pull izone/alpine:mariadb
```
##### Run pulled image
```
docker run --rm --name MariaDB -h mariadb \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=maria \
-ti izone/alpine:mariadb

docker run --name MariaDB -h mariadb \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=maria \
-d izone/alpine:mariadb

docker logs -f MariaDB

docker exec -ti MariaDB mysql -u root -pmaria

CREATE DATABASE dbzone;
CREATE USER 'luvres'@'%' IDENTIFIED BY 'pass';
GRANT ALL PRIVILEGES ON dbzone.* TO 'luvres'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
-- -------------
DROP USER luvres;
mysql --user=luvres --password=p4sS dbzone
mysql -u luvres -pp4sS dbzone
select user, host from mysql.user;
SHOW GRANTS FOR usuario;
select user();
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:mariadb ./mariadb/
```

### Lighttpd
##### Pull image
```
docker pull izone/alpine:lighttpd
```
##### Run pulled image
```
mkdir $HOME/www

docker run --rm --name Lighttpd -h lighttpd \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:lighttpd
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:lighttpd ./lighttpd/
```

### PHP 5.6 and Lighttpd
##### Pull image
```
docker pull izone/alpine:php
```
##### Run pulled image
```
mkdir $HOME/www

docker run --rm --name Php -h php \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php

docker run --rm --name Php -h php \
--link MariaDB:mariadb-host \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:php ./php/
```

### Openjdk 8
##### Pull image
```
docker pull izone/alpine:openjdk
```
##### Run pulled image
```
docker run --rm --name OpenJDK -ti izone/alpine:openjdk java -version
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:openjdk ./openjdk/
```

### Tomcat 8.0.39
##### Pull image
```
docker pull izone/alpine:tomcat
```
##### Run pulled image
```
docker run --rm --name Tomcat -h tomcat \
-e PASS="admin" \
-p 8080:8080 \
-ti izone/alpine:tomcat

docker run -name Tomcat -h tomcat \
-e PASS="admin" \
-p 8080:8080 \
-d izone/alpine:tomcat

docker run -name Tomcat -h tomcat \
--link MariaDB:mariadb-host \
-e PASS="admin" \
-p 8080:8080 \
-d izone/alpine:tomcat
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:tomcat ./tomcat/
```
