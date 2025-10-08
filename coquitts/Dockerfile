FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	ffmpeg \
	libsndfile1 \
	build-essential \
	git \
	wget \
	espeak-ng \
	espeak-ng-data \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --upgrade pip setuptools wheel && \
	pip install --no-cache-dir -r requirements.txt

COPY server.py ./
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8002"]
