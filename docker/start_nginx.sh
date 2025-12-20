#!/bin/sh
set -e

NGINX_CONF_DIR="/etc/nginx"
KEYPASS_PATH="/root/keypass"
NGINX_USER="nginx"

# Ensure SSL directory exists
mkdir -p "$NGINX_CONF_DIR/ssl"

# Step1：Create FIFO if not exists
if [ ! -p "$KEYPASS_PATH" ]; then
    mkfifo "$KEYPASS_PATH"
    chown "$NGINX_USER:$NGINX_USER" "$KEYPASS_PATH"
    chmod 600 "$KEYPASS_PATH"
fi

# Step2：Obtain password
if [ -z "$SSL_KEY_PASSWORD" ]; then
    SSL_KEY_PASSWORD=$(echo "Enterpassphrase:" | /usr/local/bin/privateKeyTool | head -n1)
    if [ -z "$SSL_KEY_PASSWORD" ]; then
        echo "ERROR: Failed to obtain SSL key password." >&2
        exit 1
    fi
fi

# Step3: Count how many times password is needed
PASSWORD_COUNT=$(grep -c "ssl_password_file.*keypass" "$NGINX_CONF_DIR/nginx.conf" 2>/dev/null || true)
if [ "$PASSWORD_COUNT" -eq 0 ]; then
    PASSWORD_COUNT=1  # 保守起见至少1次
fi

# Step4: Background writer for FIFO
(
    sleep 0.3
    i=0
    while [ $i -lt $PASSWORD_COUNT ]; do
        echo "$SSL_KEY_PASSWORD" > "$KEYPASS_PATH" || break
        i=$((i + 1))
    done
) &

# 步骤5：前台启动 Nginx（不加 -g 'daemon off;' 会导致容器退出）
exec nginx -g "daemon off;"