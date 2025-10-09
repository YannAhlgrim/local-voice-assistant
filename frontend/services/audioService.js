const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function startRecording(mediaRecorderRef, audioChunksRef, setRecording, onRecordingComplete) {
  if (!navigator.mediaDevices) {
    alert('No microphone available')
    return false
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)

    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data)
    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []
      if (onRecordingComplete) {
        await onRecordingComplete(blob)
      }
    }

    mediaRecorderRef.current = mr
    audioChunksRef.current = []
    mr.start()
    setRecording(true)
    return true
  } catch (error) {
    console.error('Error starting recording:', error)
    alert('Failed to start recording: ' + error.message)
    return false
  }
}

export function stopRecording(mediaRecorderRef) {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop()
    return true
  }
  return false
}

export async function sendAudioToBackend(audioBlob) {
  try {
    const form = new FormData()
    // Convert webm to wav on the client is complex; many servers accept webm/ogg.
    form.append('file', audioBlob, 'recording.webm')

    console.log('Sending request to backend...')
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      body: form
    })
    console.log('Response received:', res.status, res.statusText)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${res.status} ${text}`)
    }

    console.log('Converting response to blob...')
    const responseBlob = await res.blob()
    console.log('Audio blob created, size:', responseBlob.size)

    return responseBlob
  } catch (error) {
    console.error('Error in sendAudioToBackend:', error)
    throw error
  }
}

export function playAudioBlob(audioBlob, audioRef, setPlaying) {
  const url = URL.createObjectURL(audioBlob)
  if (audioRef.current) {
    audioRef.current.src = url
    audioRef.current.play()
    setPlaying(true)
    audioRef.current.onended = () => setPlaying(false)
  }
}