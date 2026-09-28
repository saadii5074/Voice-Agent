#!/bin/sh
set -e

# Railway provides PORT, if not default to 8000
PORT_NUM=${PORT:-8000}

echo "Starting server on port: $PORT_NUM"
exec python -m uvicorn main:app --host 0.0.0.0 --port "$PORT_NUM"
