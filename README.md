## Alpine Linux
-----
### Latest image (Alpine Linux)
##### Pull image
```
docker pull izone/alpine
```
##### Run pulled image
```
docker run --rm --name Alpine -ti izone/alpine ash
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine .
```

### ALMPP stack (Alpine, Lighttpd, MariaDB, Postgres, PHP)
##### MariaDB 10.1
```
docker run --name MariaDB -h mariadb \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=maria \
-d izone/alpine:mariadb
```
##### PHP 5.6 and Lighttpd
```
mkdir $HOME/www

docker run --name Php -h php \
--link MariaDB:mariadb-host \
-p 80:80 \
-v $HOME/www:/var/www \
-d izone/alpine:php5
```
##### PHP 7.1 and Lighttpd
```
mkdir $HOME/www

docker run --rm --name Php -h php \
--link MariaDB:mariadb-host \
--link Postgres:postgres-host \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php
```
##### Browser access
```
http://localhost/
```

### phpMyAdmin
##### Usage with linked server
```
docker run --rm --name Myadmin -h phpmyadmin \
--link MariaDB:db \
-p 8080:80 \
-ti izone/alpine:phpmyadmin
```
##### Usage with external server
```
docker run --rm --name Myadmin -h phpmyadmin \
-e PMA_HOST=169.8.192.130 \
-p 8080:80 \
-ti izone/alpine:phpmyadmin
```
##### Browser access
```
http://localhost:8080/
```
##### Official phpMyAdmin Docker image
##### https://github.com/phpmyadmin/docker

-----
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

### Tomcat 8.0.44
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

### Windfly 10.1.0 Final
##### Pull image
```
docker pull izone/alpine:wildfly
```
##### Run pulled image
```
docker run --rm --name Wildfly -h wildfly \
-e PASS="admin" \
-p 8080:8080 \
-p 9990:9990 \
-ti izone/alpine:wildfly

docker run --name Wildfly -h wildfly \
--link MariaDB:mariadb-host \
-e PASS="admin" \
-p 8080:8080 \
-p 9990:9990 \
-d izone/alpine:wildfly
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:wildfly ./wildfly/
```

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

### Postgres 9.6.3
##### Pull image
```
docker pull izone/alpine:postgres
```

##### Run pulled image
```
docker run --name Postgres -h postgres \
-p 5432:5432 \
-e POSTGRES_PASSWORD=postgres \
-d izone/alpine:postgres

docker logs -f Postgres

docker exec -ti Postgres bash -c "su postgres"

createdb dbzone
psql -U postgres
create user luvres with password 'pass';
alter database dbzone owner to luvres;
---------------
alter user luvres password 'p4sS';
drop user luvres;
\du
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:postgres ./postgres/
```
### pgAdmin
```
docker run --rm --name PgAdmin -h pgadmin \
--link Postgres:postgres \
-p 5050:5050 \
-ti izone/alpine:pgadmin
```
##### Browser access
```
http://localhost:5050/
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:pgadmin ./pgadmin/
```
##### References
##### https://github.com/docker-library/python
##### https://github.com/fenglc/dockercloud-pgAdmin4


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
##### Browser access
```
http://localhost/
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
docker pull izone/alpine:php5
```
##### Run pulled image
```
mkdir $HOME/www

docker run --rm --name Php -h php \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php5

docker run --rm --name Php -h php \
--link MariaDB:mariadb-host \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php5
```
### PHP 7.1 and Lighttpd
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
--link Postgres:postgres-host \
-p 80:80 \
-v $HOME/www:/var/www \
-ti izone/alpine:php
```
##### Browser access
```
http://localhost/
```
##### Buildin
```
git clone https://github.com/luvres/alpine.git
cd alpine

docker build -t izone/alpine:php5 ./php5/

docker build -t izone/alpine:php ./php/
```



-----
### AUTO CONSTRUCTION creation sequences
##### Base (Alpine)
```
docker build -t izone/alpine .
```
##### Databases
```
docker build -t izone/alpine:mariadb ./mariadb/ && \
docker build -t izone/alpine:phpmyadmin ./phpmyadmin/

docker build -t izone/alpine:python2 ./python2/ && \
docker build -t izone/alpine:python3 ./python3/ && \
docker build -t izone/alpine:pgadmin ./pgadmin/
```
##### Web Servers
```
docker build -t izone/alpine:lighttpd ./lighttpd/ && \
docker build -t izone/alpine:php5 ./php5/  && \
docker build -t izone/alpine:php ./php/
```
##### Web Servers Java
```
docker build -t izone/alpine:openjdk ./openjdk/ && \
docker build -t izone/alpine:tomcat ./tomcat/ && \
docker build -t izone/alpine:wildfly ./wildfly/
```
