from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import tempfile
import shutil
import asyncio
import os
import json
import logging
import traceback

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins like ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("middleware")

WHISPER_URL = "http://whisper:8001/transcribe"
COQUITTS_URL = "http://coquitts:8002/speak"
OLLAMA_URL = "http://ollama:11434/api/generate"
LLM_MODEL = os.getenv("LLM_MODEL", "gemma3:270m")
logger.info("Using LLM model: %s", LLM_MODEL)


@app.post("/chat")
async def chat(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be audio")

    tmp_path = None
    try:
        # save file to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp.flush()
            tmp_path = tmp.name
            logger.info("Saved uploaded audio to %s", tmp_path)

        async with httpx.AsyncClient() as client:
            # Send audio to whisper
            try:
                with open(tmp_path, "rb") as f:
                    files = {"file": ("audio.wav", f, "audio/wav")}
                    r = await client.post(WHISPER_URL, files=files, timeout=120.0)
            except httpx.RequestError as e:
                logger.exception("Request to Whisper failed")
                raise HTTPException(status_code=502, detail=f"Whisper request failed: {e}")

            if r.status_code != 200:
                logger.error("Whisper returned non-200: %s body=%s", r.status_code, r.text)
                raise HTTPException(status_code=502, detail=f"Whisper error: {r.status_code} {r.text}")

            try:
                text = r.json().get("text", "")
            except Exception:
                logger.exception("Failed to decode Whisper JSON: %s", r.text)
                raise HTTPException(status_code=502, detail="Invalid JSON from Whisper")

            logger.info("Whisper transcribed text: %s", text)

            # Send text to ollama for reasoning. Ollama often streams incremental
            # JSON objects (one per line) instead of returning a single JSON body.
            # Use a streaming request and parse JSON lines as they arrive.
            ollama_payload = {"model": LLM_MODEL, "prompt": text}
            try:
                async with client.stream("POST", OLLAMA_URL, json=ollama_payload, timeout=120.0) as ro:
                    if ro.status_code != 200:
                        # read body for error message
                        body = await ro.aread()
                        body_text = body.decode(errors="ignore")
                        logger.error("Ollama returned non-200: %s body=%s", ro.status_code, body_text)
                        raise HTTPException(status_code=502, detail=f"Ollama error: {ro.status_code} {body_text}")

                    parts = []
                    # Ollama can send multiple JSON objects line-by-line; collect 'response' parts
                    async for raw_line in ro.aiter_lines():
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        # handle Server-Sent Events style 'data: ...' prefixes
                        if line.startswith("data:"):
                            line = line[len("data:"):].strip()
                        try:
                            j = json.loads(line)
                        except Exception:
                            logger.debug("Skipping non-JSON line from Ollama: %s", line)
                            continue

                        # prefer 'response', fallback to other candidate fields
                        piece = j.get("response") or j.get("text") or j.get("output")
                        if piece:
                            parts.append(str(piece))

                        # stop when stream indicates completion
                        if j.get("done") or j.get("done_reason"):
                            break

                    answer_text = "".join(parts).strip()
            except httpx.RequestError as e:
                logger.exception("Request to Ollama failed")
                raise HTTPException(status_code=502, detail=f"Ollama request failed: {e}")

            if not answer_text:
                # as a last resort, try to fetch full text non-streamed
                try:
                    fallback = await client.post(OLLAMA_URL, json=ollama_payload, timeout=30.0)
                    if fallback.status_code == 200:
                        try:
                            fallback_json = fallback.json()
                            answer_text = (
                                fallback_json.get("response")
                                or fallback_json.get("text")
                                or fallback_json.get("output")
                                or str(fallback_json)
                            )
                        except Exception:
                            answer_text = (await fallback.aread()).decode(errors="ignore")
                    else:
                        logger.debug("Ollama fallback non-200: %s %s", fallback.status_code, await fallback.aread())
                except Exception:
                    # nothing more to do; keep answer_text empty and let downstream handle it
                    logger.debug("Ollama fallback failed", exc_info=True)

            logger.info("Ollama returned: %s", answer_text)

            # Send answer to coquitts to generate German audio
            coquitts_payload = {"text": answer_text, "language": "de"}
            try:
                co = await client.post(COQUITTS_URL, json=coquitts_payload, timeout=120.0)
            except httpx.RequestError as e:
                logger.exception("Request to CoquiTTS failed")
                raise HTTPException(status_code=502, detail=f"CoquiTTS request failed: {e}")

            if co.status_code != 200:
                logger.error("CoquiTTS returned non-200: %s body=%s", co.status_code, co.text)
                raise HTTPException(status_code=502, detail=f"CoquiTTS error: {co.status_code} {co.text}")

            logger.info("CoquiTTS returned audio, streaming back to client")

            # Get the audio content as bytes instead of streaming
            audio_content = await co.aread()

            # Return the audio as a regular response with proper headers
            return StreamingResponse(
                iter([audio_content]),
                media_type="audio/wav",
                headers={
                    "Content-Length": str(len(audio_content)),
                    "Accept-Ranges": "bytes"
                }
            )
    finally:
        # cleanup temp file
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
                logger.info("Removed temp file %s", tmp_path)
        except Exception:
            logger.warning("Failed to remove temp file %s: %s", tmp_path, traceback.format_exc())
