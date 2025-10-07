from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import httpx
import tempfile
import shutil
import asyncio

app = FastAPI()

WHISPER_URL = "http://whisper:8001/transcribe"
COQUITTS_URL = "http://coquitts:8002/speak"
OLLAMA_URL = "http://ollama:11434/v1/complete"


@app.post("/chat")
async def chat(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be audio")

    # save file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name

    async with httpx.AsyncClient() as client:
        # Send audio to whisper
        with open(tmp_path, "rb") as f:
            files = {"file": ("audio.wav", f, "audio/wav")}
            r = await client.post(WHISPER_URL, files=files, timeout=120.0)

        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Whisper error: {r.status_code} {r.text}")

        text = r.json().get("text", "")

        # Send text to ollama for reasoning
        # We assume Ollama HTTP API accepts JSON {"model":"<model>", "prompt":"..."}
        ollama_payload = {"model": "llama2", "prompt": text}
        ro = await client.post(OLLAMA_URL, json=ollama_payload, timeout=120.0)
        if ro.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Ollama error: {ro.status_code} {ro.text}")

        answer_json = ro.json()
        # Depending on API shape, try to extract text
        answer_text = answer_json.get("response") or answer_json.get("text") or answer_json.get("output") or str(answer_json)

        # Send answer to coquitts to generate German audio
        coquitts_payload = {"text": answer_text, "language": "de"}
        co = await client.post(COQUITTS_URL, json=coquitts_payload, timeout=120.0)
        if co.status_code != 200:
            raise HTTPException(status_code=502, detail=f"CoquiTTS error: {co.status_code} {co.text}")

        # stream the audio back
        return StreamingResponse(co.aiter_bytes(), media_type="audio/wav")
