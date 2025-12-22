#!/bin/bash

VERSION=$1

echo "VERSION: ${VERSION}"

sed -i "s#version = \"[^\"]*\"#version = \"${VERSION}\"#g" backend/pyproject.toml

sed -i "s#\"version\": \"[^\"]*\"#\"version\": \"${VERSION}\"#g" frontend/package.json