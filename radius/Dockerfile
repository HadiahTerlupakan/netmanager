FROM freeradius/freeradius-server:3.2.5

# 0. Install PostgreSQL Driver (Required for Debian-based images)
RUN apt-get update && apt-get install -y freeradius-postgresql

# 1. Enable SQL Module (Create Symlink)
RUN ln -s /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql

# 2. Fix Permission
RUN chown -R freerad:freerad /etc/freeradius/mods-enabled/sql

# 3. Configure SQL to use Environment Variables
# Force use of PostgreSQL driver
RUN sed -i 's/driver = "rlm_sql_null"/driver = "rlm_sql_postgresql"/g' /etc/freeradius/mods-available/sql

# Inject Env Vars for Connection
# 1. Set dialect to postgresql
RUN sed -i 's/dialect = "sqlite"/dialect = "postgresql"/g' /etc/freeradius/mods-available/sql

# 2. Uncomment and set Connection Info (match # line)
# Use ${ENV:VAR} syntax (Colon) for FreeRadius
RUN sed -i 's/#.*server = "localhost"/server = "${ENV:DB_HOST}"/g' /etc/freeradius/mods-available/sql && \
    sed -i 's/#.*port = 3306/port = ${ENV:DB_PORT}/g' /etc/freeradius/mods-available/sql && \
    sed -i 's/#.*login = "radius"/login = "${ENV:DB_USER}"/g' /etc/freeradius/mods-available/sql && \
    sed -i 's/#.*password = "radpass"/password = "${ENV:DB_PASSWORD}"/g' /etc/freeradius/mods-available/sql && \
    sed -i 's/radius_db = "radius"/radius_db = "${ENV:DB_NAME}"/g' /etc/freeradius/mods-available/sql
