# Local Voice Assistant (Docker Compose)

This repository contains a minimal multi-container voice assistant composed of:

- `whisper` - FastAPI service exposing POST /transcribe for speech-to-text using Whisper.
- `coquitts` - FastAPI service exposing POST /speak for text-to-speech using Coqui TTS.
- `ollama` - Placeholder container running an Ollama-compatible LLM (exposed on port 11434).
- `middleware` - FastAPI service exposing POST /chat that orchestrates the above services.

Quick notes & assumptions
- These services are a starting point. Models will be downloaded on first run and may require lots of disk and memory.
- `ollama` uses a placeholder public image; you must replace it with your own Ollama setup or run an Ollama server with the desired model.
- The Whisper service uses the `whisper` Python package. For better performance consider `faster-whisper` or running Whisper in GPU-enabled base images.
- The Coqui TTS service uses the `TTS` package and downloads German models on first run.

Run locally with Docker Compose

1. Build and start:

```bash
docker-compose up --build
```

2. Example request to the middleware:

```bash
curl -X POST "http://localhost:8000/chat" -F "file=@./sample.wav;type=audio/wav" --output response.wav
```

The `response.wav` will contain the German TTS response.

Next steps / improvements
- Add authentication between services.
- Add healthchecks and readiness probes.
- Add model selection, caching, and GPU support where available.
- Replace Ollama placeholder with a validated model name and response parsing.
