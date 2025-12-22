#!/bin/bash

# SSL certificate generation script using mkcert (locally trusted)
# Generates locally trusted certificate for localhost, 127.0.0.1, ::1
# Basic usage:
#   ./generate_ssl.sh
# Specify output directory:
#   ./generate_ssl.sh /path/to/ssl_dir

SSL_DIR="${1:-$(pwd)/ssl}" # Output directory (default: studio/scripts/ssl)

# Skip if certificate and key already exist
#if [[ -f "$SSL_DIR/certificate.crt" && -f "$SSL_DIR/private.key" ]]; then
#    echo "SSL files already exist in $SSL_DIR. Skipping generation." >&2
#    return 0
#fi

if ! command -v openssl &> /dev/null; then
    echo "Error: please install openssl first." >&2
    exit 1
fi

# Generate a strong random password (32 chars alphanumeric)
SSL_PASSWORD=$(openssl rand -base64 24 | tr -d '+/=' | cut -c1-32)
export SSL_PASSWORD="$SSL_PASSWORD"

# Create output directory
mkdir -p "$SSL_DIR"

# Temporary unencrypted key path
TEMP_KEY="$SSL_DIR/private.unencrypted.key"

# Ensure mkcert is installed
if ! command -v mkcert &> /dev/null; then
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            openssl req -x509 -nodes -days 365 \
            -newkey rsa:2048 \
            -keyout "$TEMP_KEY" \
            -out "$SSL_DIR/certificate.crt" \
            -subj "//CN=localhost"
            ;;
        *)
            openssl req -x509 -nodes -days 365 \
            -newkey rsa:2048 \
            -keyout "$TEMP_KEY" \
            -out "$SSL_DIR/certificate.crt" \
            -subj "/CN=localhost"
            ;;
    esac
else
   # Generate certificate and unencrypted key using mkcert
    echo "Generating certificate with mkcert..."
    mkcert -cert-file "$SSL_DIR/certificate.crt" -key-file "$TEMP_KEY" localhost 127.0.0.1 ::1
fi

# Encrypt the private key with the generated password
echo "Encrypting private key with generated password..."
openssl rsa -aes256 \
    -in "$TEMP_KEY" \
    -out "$SSL_DIR/private.key" \
    -passout "pass:$SSL_PASSWORD"

# Securely remove unencrypted key
rm -f "$TEMP_KEY"

# Set appropriate permissions
chmod 600 "$SSL_DIR/private.key"
chmod 644 "$SSL_DIR/certificate.crt"

# Output paths for Nginx
# echo "ssl_cert_key_file=$SSL_DIR/private.key"
# echo "ssl_cert_file=$SSL_DIR/certificate.crt"
# echo "SSL_PASSWORD=$SSL_PASSWORD"
echo "Note: Private key is encrypted with AES-256. Use ssl_password to decrypt."
echo "SSL files generated successfully in: $SSL_DIR"