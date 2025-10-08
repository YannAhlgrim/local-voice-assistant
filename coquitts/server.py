from fastapi import FastAPI, HTTPException, Body, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from TTS.api import TTS
import tempfile
import os
import logging

app = FastAPI()

# Load TTS model at startup with a valid 4-part model name
model_name = os.environ.get("TTS_MODEL", "tts_models/de/thorsten/tacotron2-DDC")
try:
    tts = TTS(model_name=model_name)
    logging.info(f"Successfully loaded TTS model: {model_name}")
except Exception as exc:
    logging.exception("Failed to load TTS model '%s'", model_name)
    raise RuntimeError(
        f"Failed to load TTS model '{model_name}': {exc}.\n"
        "Set the environment variable TTS_MODEL to a valid model id in the format 'tts_models/<lang>/<dataset>/<model>' "
        "or install the model manually."
    ) from exc


def _cleanup_file(path: str) -> None:
    try:
        os.remove(path)
    except Exception:
        logging.exception("Failed to remove temporary file %s", path)


@app.post("/speak")
def speak(payload: dict = Body(...), background_tasks: BackgroundTasks = None):
    text = payload.get("text")
    language = payload.get("language", "de")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in body")

    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        # Check if the model is multilingual before passing language parameter
        if hasattr(tts, 'is_multi_lingual') and tts.is_multi_lingual:
            tts.tts_to_file(text=text, speaker=None, language=language, file_path=path)
        else:
            # For non-multilingual models, don't pass the language parameter
            tts.tts_to_file(text=text, speaker=None, file_path=path)
        # schedule cleanup after response has been sent
        if background_tasks is not None:
            background_tasks.add_task(_cleanup_file, path)
        return FileResponse(path, media_type="audio/wav", filename="response.wav")
    except Exception:
        logging.exception("TTS generation failed")
        # try to remove file immediately on failure
        _cleanup_file(path)
        raise HTTPException(status_code=500, detail="TTS generation failed")
