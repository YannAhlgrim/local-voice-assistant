from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import whisper
import tempfile
import shutil
import os
import logging
from pydub import AudioSegment

logging.basicConfig(level=logging.INFO)
app = FastAPI()

# Load model at startup
try:
    model = whisper.load_model("small")
except Exception:
    logging.exception("Failed to load Whisper model")
    # re-raise so container fails fast if model can't be loaded
    raise


def convert_to_wav(src_path: str) -> str:
    """Convert an audio file (webm/ogg/mp3/...) to a 16 kHz mono WAV file using pydub/ffmpeg.

    Returns path to the new WAV file (caller is responsible for cleanup).
    """
    audio = AudioSegment.from_file(src_path)
    audio = audio.set_frame_rate(16000).set_channels(1)
    wav_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    wav_tmp.close()
    audio.export(wav_tmp.name, format="wav")
    return wav_tmp.name


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be audio")

    # preserve original extension if possible
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1] or ""
    if not ext:
        # try to infer common extension from content-type
        if "webm" in file.content_type:
            ext = ".webm"
        elif "ogg" in file.content_type or "opus" in file.content_type:
            ext = ".ogg"
        elif "mpeg" in file.content_type or "mp3" in file.content_type:
            ext = ".mp3"
        else:
            ext = ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name

    logging.info("Received upload %s (%d bytes, content-type=%s)", filename, os.path.getsize(tmp_path), file.content_type)

    # If the uploaded file is not a WAV, convert it to WAV first to ensure ffmpeg/pydub compatibility.
    wav_path = tmp_path
    converted = False
    try:
        if not tmp_path.lower().endswith('.wav'):
            try:
                wav_path = convert_to_wav(tmp_path)
                converted = True
                logging.info("Converted to wav: %s (size=%d)", wav_path, os.path.getsize(wav_path))
            except Exception as e:
                # conversion failed; return a helpful error including ffmpeg/pydub message
                logging.exception("Failed to convert uploaded audio to wav")
                # try to surface the underlying error text
                raise HTTPException(status_code=400, detail=f"Failed to convert audio: {e}")

        try:
            result = model.transcribe(wav_path, language=None)
            text = result.get("text", "")
        except RuntimeError as e:
            # likely ffmpeg failed while loading audio; include error message for debugging
            logging.exception("Whisper failed to transcribe audio")
            raise HTTPException(status_code=500, detail=str(e))

        return JSONResponse({"text": text})
    finally:
        # cleanup temp files
        for path in {tmp_path, wav_path}:
            try:
                if path and os.path.exists(path):
                    os.remove(path)
            except Exception:
                logging.exception("Failed to remove temp file %s", path)
