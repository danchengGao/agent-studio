#!/bin/bash
set -e  

if [ -d "/app/site-packages/openjiuwen_studio/examples" ]; then
  chown -R app:app /app/site-packages/openjiuwen_studio/examples
  chmod -R 554 /app/site-packages/openjiuwen_studio/examples
  echo "Updated ownership of /app/site-packages/openjiuwen_studio/examples to app:app"
fi

if [ -f "/app/site-packages/openjiuwen_studio/conf/config.yaml" ]; then
  chown app:app /app/site-packages/openjiuwen_studio/conf/config.yaml
  chmod 644 /app/site-packages/openjiuwen_studio/conf/config.yaml
  echo "Updated ownership of /app/site-packages/openjiuwen_studio/conf/config.yaml to app:app"
fi

if [ -f "/app/site-packages/openjiuwen_studio/conf/config.json" ]; then
  chown app:app /app/site-packages/openjiuwen_studio/conf/config.json
  chmod 644 /app/site-packages/openjiuwen_studio/conf/config.json
  echo "Updated ownership of /app/site-packages/openjiuwen_studio/conf/config.json to app:app"
fi

chown -R app:app /app/logs
exec su app -s /bin/sh -c 'export PYTHONPATH="$PYTHONPATH" PATH="$PATH"; exec "$@"' -- sh "$@"