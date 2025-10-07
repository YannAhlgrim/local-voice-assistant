from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import whisper
import tempfile
import shutil

app = FastAPI()

model = whisper.load_model("small")


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be audio")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language=None)
        text = result.get("text", "")
    finally:
        try:
            shutil.os.remove(tmp_path)
        except Exception:
            pass

    return JSONResponse({"text": text})
