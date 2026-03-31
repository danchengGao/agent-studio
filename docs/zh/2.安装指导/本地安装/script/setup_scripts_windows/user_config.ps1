# HTTP(S) proxy configuration
# Usage:
# - HTTP_PROXY, HTTPS_PROXY: full proxy URL, e.g. http://127.0.0.1:7890 (with auth: http://user:pass@proxy.example.com:8080)
# - SSL_VERIFY: true/false, whether to enable SSL verification
# - Leave empty to skip proxy / SSL override (script will skip)
$HTTP_PROXY=""
$HTTPS_PROXY=""
$SSL_VERIFY=""

# Proxy apply switches (optional, default enabled)
# - ENABLE_SESSION_ENV_PROXY: apply HTTP(S) proxy to current PowerShell session env (HTTP_PROXY/HTTPS_PROXY)
# - ENABLE_GIT_PROXY_CONFIG: configure git http.proxy/https.proxy/http.sslVerify
# - ENABLE_NPM_PROXY_CONFIG: configure npm proxy/https-proxy/strict-ssl
$ENABLE_SESSION_ENV_PROXY="true"
$ENABLE_GIT_PROXY_CONFIG="true"
$ENABLE_NPM_PROXY_CONFIG="true"

# uv default package index, used by uv sync / uv pip / uv run
# Usage:
# - UV_INDEX: uv index URL, e.g. https://pypi.tuna.tsinghua.edu.cn/simple 
# - UV_TRUSTED_HOST: trusted host for uv TLS verification bypass, e.g. pypi.tuna.tsinghua.edu.cn
# - Leave empty to use uv default 
$UV_INDEX=""
$UV_TRUSTED_HOST=""


# npm registry configuration
# Usage:
# - NPM_REGISTRY: npm registry URL, e.g. https://registry.npmmirror.com
# - Leave empty to skip npm registry config (script will skip)
$NPM_REGISTRY=""


