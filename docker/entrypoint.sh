#!/bin/bash
set -e  
if [ -d "/app/ops" ]; then
  chown -R app:app /app/ops
  echo "Updated ownership of /app/ops to app:app"
fi

if [ -f "/app/config.yaml" ]; then
  chown app:app /app/config.yaml
  chmod 644 /app/config.yaml  
  echo "Updated ownership of /app/config.yaml to app:app"
fi

if [ -f "/app/pyproject.toml" ]; then
  chown app:app /app/pyproject.toml
  chmod 644 /app/pyproject.toml
  echo "Updated ownership of /app/pyproject.toml to app:app"
fi

if [ -d "/app/site-packages/openjiuwen_studio_server/examples" ]; then
  chown -R app:app /app/site-packages/openjiuwen_studio_server/examples
  chmod -R 554 /app/site-packages/openjiuwen_studio_server/examples
  echo "Updated ownership of /app/site-packages/openjiuwen_studio_server/examples to app:app"
fi

if [ -f "/app/site-packages/openjiuwen_studio_server/config.yaml" ]; then
  chown app:app /app/site-packages/openjiuwen_studio_server/config.yaml
  chmod 644 /app/site-packages/openjiuwen_studio_server/config.yaml
  echo "Updated ownership of /app/site-packages/openjiuwen_studio_server/config.yaml to app:app"
fi

if [ -f "/app/site-packages/openjiuwen_studio_server/config.json" ]; then
  chown app:app /app/site-packages/openjiuwen_studio_server/config.json
  chmod 644 /app/site-packages/openjiuwen_studio_server/config.json
  echo "Updated ownership of /app/site-packages/openjiuwen_studio_server/config.json to app:app"
fi

chown -R app:app /app/logs
exec runuser -u app -- "$@"
