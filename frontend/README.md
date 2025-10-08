Frontend to test `/chat` endpoint. Uses the browser MediaRecorder API to record audio and POST to the middleware.

Run locally:

1. Install dependencies

```bash
cd frontend
npm install
```

2. Start dev server

```bash
npm run dev
```

3. Open http://localhost:3000 in the browser and press/hold the record button. The app will POST the recorded audio to `http://localhost:8000/chat` and play the returned audio.

Notes:
- This simple client posts a `webm` audio blob (from MediaRecorder). The backend must accept `webm` or you can adapt the client to encode WAV.
- If the backend runs on a different origin make sure to enable CORS on the middleware (FastAPI) or run the frontend proxied.
