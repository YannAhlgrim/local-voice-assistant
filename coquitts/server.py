from fastapi import FastAPI, HTTPException
from fastapi import Body
from fastapi.responses import FileResponse, JSONResponse
from TTS.api import TTS
import tempfile
import os

app = FastAPI()

# Load a German-capable model. Model may be downloaded on first run.
tts = TTS(model_name="tts_models/de/thorsten_hsmm")


@app.post("/speak")
def speak(payload: dict = Body(...)):
    text = payload.get("text")
    language = payload.get("language", "de")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in body")

    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        tts.tts_to_file(text=text, speaker=None, language=language, file_path=path)
        return FileResponse(path, media_type="audio/wav", filename="response.wav")
    finally:
        # FileResponse will stream the file; don't remove immediately. Consumer can manage cleanup.
        pass
