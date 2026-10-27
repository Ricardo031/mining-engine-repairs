#!/bin/bash
# Creates one database + one login role per microservice.
# Each role owns only its database and PUBLIC connect is revoked,
# so a service cannot read the other service's internal tables.
set -euo pipefail

create_service_db() {
  local db="$1" user="$2" password="$3"
  echo "Creating database '$db' owned by '$user'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE ROLE "$user" WITH LOGIN PASSWORD '$password';
    CREATE DATABASE "$db" OWNER "$user";
    REVOKE ALL ON DATABASE "$db" FROM PUBLIC;
    GRANT ALL PRIVILEGES ON DATABASE "$db" TO "$user";
EOSQL
}

create_service_db "$AUTH_DB_NAME" "$AUTH_DB_USER" "$AUTH_DB_PASSWORD"
create_service_db "$REPAIRS_DB_NAME" "$REPAIRS_DB_USER" "$REPAIRS_DB_PASSWORD"
