#!/bin/sh

exec 2>/dev/null

if [ -z "${SSL_PASSWORD}" ]; then
    exit 1
fi

printf '%s' "${SSL_PASSWORD}"
