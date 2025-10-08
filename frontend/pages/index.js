import { useState, useRef } from 'react'

export default function Home() {
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)

  async function startRecording() {
    if (!navigator.mediaDevices) return alert('No microphone available')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data)
    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []
      await sendAudio(blob)
    }
    mediaRecorderRef.current = mr
    audioChunksRef.current = []
    mr.start()
    setRecording(true)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  async function sendAudio(blob) {
    const form = new FormData()
    // Convert webm to wav on the client is complex; many servers accept webm/ogg.
    form.append('file', blob, 'recording.webm')

    const res = await fetch('http://localhost:8000/chat', { method: 'POST', body: form })
    if (!res.ok) {
      const text = await res.text()
      alert('Error: ' + res.status + ' ' + text)
      return
    }
    const audioBlob = await res.blob()
    const url = URL.createObjectURL(audioBlob)
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play()
      setPlaying(true)
      audioRef.current.onended = () => setPlaying(false)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Local Voice Assistant — Frontend</h1>
      <p>Press and hold the big button to record, or click to toggle.</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onClick={() => (recording ? stopRecording() : startRecording())}
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            background: recording ? 'red' : '#0b84ff',
            color: 'white',
            fontSize: 18,
            border: 'none',
          }}
        >
          {recording ? 'Recording...' : 'Hold / Click'}
        </button>

        <div>
          <p>Playback:</p>
          <audio ref={audioRef} controls />
          {playing && <div>Playing...</div>}
        </div>
      </div>
    </div>
  )
}
