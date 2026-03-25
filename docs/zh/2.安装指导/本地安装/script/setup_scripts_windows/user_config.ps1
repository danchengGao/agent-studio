# Proxy configuration (optional)
# Usage:
# - No proxy: leave empty (script will skip proxy config)
# - With proxy: set full URL, e.g. http://127.0.0.1:7890
# - Proxy with auth supported, e.g. http://user:pass@proxy.example.com:8080
# - SSL_VERIFY: true/false (maps to git http.sslVerify)
$HTTP_PROXY=""
$HTTPS_PROXY=""
$SSL_VERIFY=""

# pip index configuration (optional)
# Usage:
# - PIP_INDEX_URL: pip index URL, e.g. https://pypi.tuna.tsinghua.edu.cn/simple
# - PIP_TRUSTED_HOST: trusted host, e.g. pypi.tuna.tsinghua.edu.cn
# - Leave empty to skip pip index config (script will skip)
$PIP_INDEX_URL=""
$PIP_TRUSTED_HOST=""

# npm registry configuration (optional)
# Usage:
# - NPM_REGISTRY: npm registry URL, e.g. https://registry.npmmirror.com
# - Leave empty to skip npm registry config (script will skip)
$NPM_REGISTRY=""

