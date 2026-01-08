#!/usr/bin/env bash
sort ../.env.example > .env.runtime.default
sed -i 's/#.*//; /^[[:space:]]*$/d' .env.runtime.default
sed -i -E 's/^[[:space:]]+//; s/[[:space:]]+$//' .env.runtime.default
sed -i '/^CODE_SANDBOX_URL=/d; /^DB_HOST=/d; /^MILVUS_HOST=/d; /^SERVER_AES_MASTER_KEY=/d; /^SSL_PASSWORD=/d; /^VITE_API_PROXY_TARGET=/d; /^VITE_PLUGIN_SERVICE_URL=/d' .env.runtime.default
sed -i 's/^DB_TYPE=.*/DB_TYPE=mysql/; s/^FRONTEND_PORT=.*/FRONTEND_PORT=3001/' .env.runtime.default

cp -r ../backend/openjiuwen_studio/examples .

cp ../backend/openjiuwen_studio/conf/config.yaml conf/.

cp ../backend/openjiuwen_studio/conf/config.json conf/.

echo "FRONTEND_IMAGE=your_frontend_image_name:your_frontend_image_version" >> .env.custom

echo "BACKEND_IMAGE=your_backend_image_name:your_backend_image_version" >> .env.custom

echo "CODE_SANDBOX_URL=your_code_sandbox_url" >> .env.custom

echo "VITE_PLUGIN_SERVICE_URL=your_plugin_service_url" >> .env.custom


