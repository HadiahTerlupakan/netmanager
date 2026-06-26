# Use official FreeRADIUS image from Docker Hub (fallback sampai mirror GHCR ready)
FROM freeradius/freeradius-server:3.2.5

# 1. Install PostgreSQL Driver (Required for Debian-based images)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        freeradius-postgresql \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 2. Enable SQL Modules (Create Symlinks)
RUN ln -sf /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql && \
    ln -sf /etc/freeradius/mods-available/sqlippool /etc/freeradius/mods-enabled/sqlippool

# 3. Copy custom configuration files
COPY config/radius/sql.conf /etc/freeradius/mods-available/sql
COPY config/radius/sqlippool.conf /etc/freeradius/mods-available/sqlippool
COPY config/radius/clients.conf /etc/freeradius/clients.conf

# 4. Copy and prepare entrypoint script
COPY radius/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 5. Fix permissions
RUN chown -R freerad:freerad /etc/freeradius

# 6. Expose RADIUS ports
EXPOSE 1812/udp 1813/udp

# 7. Use custom entrypoint for env var substitution at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
