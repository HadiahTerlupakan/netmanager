# ==============================================================================
# NetManager Cron Container
# ==============================================================================
# Container ini menjalankan scheduled tasks untuk attendance alerts
# Packages di-install saat build time untuk menghindari DNS issues saat runtime
# ==============================================================================

FROM alpine:3.21

# Install packages saat build time (bukan runtime)
RUN apk add --no-cache curl tzdata

# Set timezone default
ENV TZ=Asia/Jakarta

# Create log file
RUN touch /var/log/cron.log

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
