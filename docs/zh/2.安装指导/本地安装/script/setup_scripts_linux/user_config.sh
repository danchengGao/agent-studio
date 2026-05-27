# HTTP(S) proxy configuration
# Usage:
# - No proxy: leave empty (script will skip proxy config)
# - With proxy: set full URL, e.g. http://127.0.0.1:7890
# - Proxy with auth supported, e.g. http://user:pass@proxy.example.com:8080
# - SSL_VERIFY: true/false (maps to git http.sslVerify)
HTTP_PROXY=""
HTTPS_PROXY=""
SSL_VERIFY=""

# uv default package index, used by uv sync / uv pip / uv run
# Usage:
# - UV_INDEX: uv index URL, e.g. https://pypi.tuna.tsinghua.edu.cn/simple 
# - UV_TRUSTED_HOST: trusted host for uv TLS verification bypass, e.g. pypi.tuna.tsinghua.edu.cn
# - Leave empty to use uv default
UV_INDEX=""
UV_TRUSTED_HOST=""

# NVM Node.js download mirror
# Usage:
# - NVM_NODEJS_ORG_MIRROR: mirror URL used when nvm installs Node.js
# - e.g. https://npmmirror.com/mirrors/node
# - Leave empty to use nvm default (nodejs.org); set for faster or reliable access in restricted networks
NVM_NODEJS_ORG_MIRROR=""

# npm registry configuration
# Usage:
# - NPM_REGISTRY: npm registry URL, e.g. https://registry.npmmirror.com
# - Leave empty to skip npm registry config (script will skip)
NPM_REGISTRY=""

# Database server host. Leave empty for default 127.0.0.1
DB_HOST=""

# Database server port. Leave empty for default 3306
DB_PORT=""

