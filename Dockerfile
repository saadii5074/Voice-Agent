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

# Default port (Railway will override with its own PORT env var at runtime)
ENV PORT=8000

# 3. Start using a shell script so $PORT expands correctly
WORKDIR /app/backend
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
