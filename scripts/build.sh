#!/usr/bin/env bash

cp ../.env.example .

cp -r ../backend/examples .

cp ../backend/config.yaml conf/.

cp ../backend/config.json conf/.

cp ../backend/build_AES_master_key.sh .

cp ../backend/build_AES_master_key.ps1 .

echo "FRONTEND_DOCKER_IMAGE=your_frontend_image_name:your_frontend_image_version" >> .env.custom

echo "BACKEND_DOCKER_IMAGE=your_backend_image_name:your_backend_image_version" >> .env.custom

echo "CODE_SANDBOX_URL=your_code_sandbox_url" >> .env.custom

echo "VITE_PLUGIN_SERVICE_URL=your_plugin_service_url" >> .env.custom


