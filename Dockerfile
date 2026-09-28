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

# 3. Start the FastAPI server (which also serves the frontend static files)
CMD cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
