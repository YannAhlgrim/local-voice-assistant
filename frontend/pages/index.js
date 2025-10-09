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
      {/* Header */}
      <div className="container mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            🎤 Voice Assistant
          </h1>
        </div>

        {/* Main Interface */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12 max-w-6xl mx-auto">

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
                className={`record-button w-40 h-40 rounded-full border-none text-white text-lg font-semibold
                  ${recording
                    ? 'bg-gradient-to-r from-red-500 to-red-600 recording-pulse shadow-red-500/50'
                    : isProcessing
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-yellow-500/50'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-blue-500/50'
                  }
                  ${isProcessing ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:shadow-xl'}
                  disabled:cursor-not-allowed disabled:opacity-75
                `}
              >
                <div className="flex flex-col items-center">
                  <div className="text-3xl mb-2">
                    {recording ? '🎙️' : isProcessing ? '⏳' : '🎤'}
                  </div>
                  <div className="text-sm">
                    {recording ? 'Recording...' : isProcessing ? 'Processing...' : 'Hold / Click'}
                  </div>
                </div>
              </button>
            </div>

            {/* Status indicators */}
            <div className="flex space-x-4">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${
                recording ? 'bg-red-500/20 text-red-300' : 'bg-gray-700/50 text-gray-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${recording ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm font-medium">Recording</span>
              </div>

              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${
                isProcessing ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700/50 text-gray-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm font-medium">Processing</span>
              </div>
            </div>
          </div>

          {/* Audio Playback Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 min-w-[400px]">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-semibold text-white mb-2">🔊 Audio Response</h3>
              <p className="text-gray-300">Your AI assistant's response will play here</p>
            </div>

            <div className="audio-visualizer bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6">
              <audio
                ref={audioRef}
                controls
                className="w-full mb-4"
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                }}
              />

              {playing && (
                <div className="flex items-center justify-center space-x-3 text-green-400">
                  <div className="flex space-x-1">
                    <div className="w-1 h-6 bg-green-400 rounded animate-bounce"></div>
                    <div className="w-1 h-8 bg-green-400 rounded animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-6 bg-green-400 rounded animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1 h-10 bg-green-400 rounded animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    <div className="w-1 h-6 bg-green-400 rounded animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="font-medium">Playing response...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-16 text-center">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 max-w-3xl mx-auto border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">💡 How to Use</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-2xl">1️⃣</div>
                <p><strong>Press & Hold</strong><br/>Hold the button down while speaking</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-2xl">2️⃣</div>
                <p><strong>Or Click Toggle</strong><br/>Click once to start, click again to stop</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-2xl">3️⃣</div>
                <p><strong>Listen</strong><br/>Your AI assistant will respond with audio</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
