# server/ -- FastAPI backend. docs/backend.md §11 documents the equivalent local
# (non-Docker) setup; this mirrors it rather than diverging into a separate recipe.
FROM python:3.13-slim

# ffmpeg is a real runtime dependency (video/ffmpeg_runner.py's RTSP->HLS transcoding,
# routers/health.py's ffmpeg_available check) -- not a pip package, must come from apt.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite by default (matches local dev, docs/backend.md §11) -- override DATABASE_URL
# via docker-compose/.env for Postgres+PostGIS. hls_output/ is where transcoded
# segments land (HLS_OUTPUT_DIR); kept as a volume mount point in docker-compose.yml
# rather than baked into the image, since it's runtime output, not source.
ENV HLS_OUTPUT_DIR=/app/hls_output
RUN mkdir -p /app/hls_output

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
