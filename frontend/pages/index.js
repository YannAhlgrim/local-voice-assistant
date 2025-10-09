import { useState, useRef } from 'react'
import { startRecording, stopRecording, sendAudioToBackend, playAudioBlob } from '../services/audioService'

export default function Home() {
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)

  async function handleStartRecording() {
    await startRecording(mediaRecorderRef, audioChunksRef, setRecording, handleSendAudio)
  }

  function handleStopRecording() {
    // Immediately stop the recording animation
    setRecording(false)
    stopRecording(mediaRecorderRef)
  }

  async function handleSendAudio(blob) {
    try {
      setIsProcessing(true)
      const audioBlob = await sendAudioToBackend(blob)
      playAudioBlob(audioBlob, audioRef, setPlaying)
    } catch (error) {
      // Show a more user-friendly error notification
      const errorDiv = document.createElement('div')
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300'
      errorDiv.textContent = `Error: ${error.message}`
      document.body.appendChild(errorDiv)
      setTimeout(() => {
        errorDiv.style.transform = 'translateX(100%)'
        setTimeout(() => document.body.removeChild(errorDiv), 300)
      }, 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="flex flex-col mx-auto min-h-[30vh] items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-7xl font-bold gradient-text mb-4">
            🎤 Voice Assistant
          </h1>
        </div>
      </div>

        {/* Main Interface */}
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-[50vh] gap-12 max-w-6xl mx-auto my-auto">

          {/* Recording Section */}
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              {/* Animated rings around button when recording */}
              {recording && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-40 animation-delay-75"></div>
                </>
              )}

              <button
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onMouseLeave={handleStopRecording}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
                disabled={isProcessing}
                className={`record-button w-60 h-60 rounded-full border-none text-white text-lg font-semibold cursor-pointer
                  ${recording
                    ? 'record-button--recording'
                    : isProcessing
                    ? 'record-button--processing'
                    : 'record-button--idle'
                  }
                `}
              >
                <div className="flex flex-col items-center">
                  <div className="text-4xl mb-2">
                    {recording ? '🎙️' : isProcessing ? '⏳' : '🎤'}
                  </div>
                  <div className="text-2xl">
                    {recording ? 'Recording...' : isProcessing ? 'Processing...' : 'Hold to Record'}
                  </div>
                </div>
              </button>
            </div>

            {/* Status indicators */}
            <div className="flex space-x-4">
              <div className={`status-indicator ${
                recording ? 'status-indicator--recording' : ''
              }`}>
                <div className={`pulse-dot ${recording ? 'pulse-dot--error' : 'pulse-dot--inactive'}`}></div>
                <span className="text-xl font-medium">Recording</span>
              </div>

              <div className={`status-indicator ${
                isProcessing ? 'status-indicator--processing' : ''
              }`}>
                <div className={`pulse-dot ${isProcessing ? 'pulse-dot--warning' : 'pulse-dot--inactive'}`}></div>
                <span className="text-xl font-medium">Processing</span>
              </div>
            </div>
          </div>

          {/* Audio Playback Section */}
          <div className="glass-panel p-8 min-w-2/3">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-semibold text-white mb-2">🔊 Audio Response</h3>
              <p className="text-theme-muted">Your AI assistant's response will play here</p>
            </div>

            <div className="audio-visualizer p-6">
              <audio
                ref={audioRef}
                controls
                className="w-full mb-4"
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                }}
              />

              {playing && (
                <div className="flex items-center justify-center space-x-3 text-theme-success">
                  <div className="flex space-x-1">
                    <div className="w-1 h-6 bg-theme-success rounded animate-bounce"></div>
                    <div className="w-1 h-8 bg-theme-success rounded animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-6 bg-theme-success rounded animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1 h-10 bg-theme-success rounded animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    <div className="w-1 h-6 bg-theme-success rounded animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="font-medium">Playing response...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}
