FROM freeradius/freeradius-server:3.2.5

# 0. Install PostgreSQL Driver (Required for Alpine-based images)
RUN apk add --no-cache freeradius-postgresql

# 1. Enable SQL Module (Create Symlink)
RUN ln -s /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql

# 2. Fix Permission
RUN chown -R freerad:freerad /etc/freeradius/mods-enabled/sql

# 3. Force use of PostgreSQL driver instead of null driver
# We use sed to replace 'driver = "rlm_sql_null"' with 'driver = "rlm_sql_postgresql"' in the config file
RUN sed -i 's/driver = "rlm_sql_null"/driver = "rlm_sql_postgresql"/g' /etc/freeradius/mods-available/sql
