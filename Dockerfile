FROM python:3.12-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire project
COPY . .

# 1. Build the React Frontend
RUN cd frontend && npm install && npm run build

# 2. Install Python Backend Dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Default port (Railway overrides this with its own PORT env var)
ENV PORT=8000

WORKDIR /app/backend
# Use Python to start uvicorn - avoids $PORT shell expansion issues
CMD ["python", "-c", "import os, uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))"]
