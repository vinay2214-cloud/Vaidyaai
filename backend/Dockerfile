FROM python:3.11-slim

WORKDIR /app

# System dependencies for ReportLab, PostgreSQL, FFmpeg for audio chunk concatenation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libc-dev libffi-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user (least privilege) rather than root.
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

# Container-level liveness check hitting the dependency-free probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,os,sys; \
    sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8080')+'/livez').status==200 else 1)"

# Cloud Run expects the server to listen on PORT env variable
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2 \
    --timeout-keep-alive 300
