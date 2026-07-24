FROM python:3.11-slim

WORKDIR /app

# System dependencies for ReportLab, PostgreSQL, FFmpeg for audio chunk concatenation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libc-dev libffi-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run expects the server to listen on PORT env variable
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2 \
    --timeout-keep-alive 300
