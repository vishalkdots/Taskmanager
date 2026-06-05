import React, { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { SocketContext } from '../context/SocketContext'
import { AuthContext } from '../context/AuthContext'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  Copy,
  Users,
  MessageSquare,
  Send,
  X,
  ChevronRight
} from 'lucide-react'

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

function VideoCall() {
  const { socket, isConnected } = useContext(SocketContext)
  const { user } = useContext(AuthContext)

  const [roomId, setRoomId] = useState('')
  const [inCall, setInCall] = useState(false)
  const [currentRoom, setCurrentRoom] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState([])
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [peers, setPeers] = useState([])
  const [joinError, setJoinError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')

  const localVideoRef = useRef(null)
  const peerConnections = useRef({})
  const joinedRef = useRef(false)
  const chatEndRef = useRef(null)

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoomId(id)
  }

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setLocalStream(stream)
      return stream
    } catch (err) {
      setJoinError('Camera/mic access denied. Please allow permissions.')
      return null
    }
  }

  const createPeerConnection = useCallback((peerSocketId, stream) => {
    if (peerConnections.current[peerSocketId]) return

    const pc = new RTCPeerConnection(STUN_SERVERS)

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('video:ice-candidate', { to: peerSocketId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const existing = prev.find((rs) => rs.peerSocketId === peerSocketId)
        if (existing) {
          existing.stream = event.streams[0]
          return [...prev]
        }
        return [...prev, { peerSocketId, stream: event.streams[0] }]
      })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupPeer(peerSocketId)
      }
    }

    peerConnections.current[peerSocketId] = pc
    return pc
  }, [socket])

  const cleanupPeer = useCallback((peerSocketId) => {
    if (peerConnections.current[peerSocketId]) {
      peerConnections.current[peerSocketId].close()
      delete peerConnections.current[peerSocketId]
    }
    setRemoteStreams((prev) => prev.filter((rs) => rs.peerSocketId !== peerSocketId))
    setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId))
  }, [])

  const startCall = async () => {
    if (!roomId.trim()) return
    setJoinError('')

    const stream = await getLocalStream()
    if (!stream) return

    setCurrentRoom(roomId.trim().toUpperCase())
    setInCall(true)
  }

  // Step 1: When inCall becomes true, set up socket listeners
  useEffect(() => {
    if (!socket || !inCall) return

    const handleExistingPeers = async (existingPeers) => {
      if (!localStream) return

      setPeers(existingPeers)

      for (const peer of existingPeers) {
        try {
          const pc = createPeerConnection(peer.socketId, localStream)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('video:offer', { to: peer.socketId, offer })
        } catch (err) {
          console.error('Error creating offer for existing peer:', err)
        }
      }
    }

    const handleUserJoined = async ({ socketId, name }) => {
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev
        return [...prev, { socketId, name }]
      })

      if (!localStream) return
      try {
        const pc = createPeerConnection(socketId, localStream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('video:offer', { to: socketId, offer })
      } catch (err) {
        console.error('Error creating offer for new peer:', err)
      }
    }

    const handleOffer = async ({ from, offer }) => {
      if (!localStream) return

      const pc = createPeerConnection(from, localStream)
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('video:answer', { to: from, answer })
      } catch (err) {
        console.error('Error handling offer:', err)
      }
    }

    const handleAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from]
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        } catch (err) {
          console.error('Error handling answer:', err)
        }
      }
    }

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from]
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Error adding ICE candidate:', err)
        }
      }
    }

    const handleUserLeft = ({ socketId }) => {
      cleanupPeer(socketId)
    }

    const handleChatMessage = ({ socketId, name, text, timestamp }) => {
      setChatMessages((prev) => [...prev, { socketId, name, text, timestamp }])
    }

    socket.on('video:existing-peers', handleExistingPeers)
    socket.on('video:user-joined', handleUserJoined)
    socket.on('video:offer', handleOffer)
    socket.on('video:answer', handleAnswer)
    socket.on('video:ice-candidate', handleIceCandidate)
    socket.on('video:user-left', handleUserLeft)
    socket.on('video:chat-message', handleChatMessage)

    return () => {
      socket.off('video:existing-peers', handleExistingPeers)
      socket.off('video:user-joined', handleUserJoined)
      socket.off('video:offer', handleOffer)
      socket.off('video:answer', handleAnswer)
      socket.off('video:ice-candidate', handleIceCandidate)
      socket.off('video:user-left', handleUserLeft)
      socket.off('video:chat-message', handleChatMessage)
    }
  }, [socket, inCall, localStream, createPeerConnection, cleanupPeer])

  // Step 2: After listeners are ready, join the room
  useEffect(() => {
    if (!socket || !inCall || !currentRoom) return
    if (joinedRef.current) return
    joinedRef.current = true

    socket.emit('video:join-room', { roomId: currentRoom })

    return () => {
      if (joinedRef.current && socket) {
        socket.emit('video:leave-room', { roomId: currentRoom })
      }
      joinedRef.current = false
    }
  }, [socket, inCall, currentRoom])

  // Sync local video ref when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const endCall = () => {
    Object.keys(peerConnections.current).forEach((id) => {
      peerConnections.current[id].close()
      delete peerConnections.current[id]
    })
    peerConnections.current = {}

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    setLocalStream(null)
    setRemoteStreams([])
    setPeers([])
    setChatMessages([])
    setShowChat(false)
    setInCall(false)
    setCurrentRoom('')
    setScreenSharing(false)
  }

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setMicEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setCamEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleScreenShare = async () => {
    if (screenSharing) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const videoTrack = stream.getVideoTracks()[0]
      const oldTrack = localStream.getVideoTracks()[0]
      localStream.removeTrack(oldTrack)
      oldTrack.stop()
      localStream.addTrack(videoTrack)

      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(videoTrack)
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
      }
      setScreenSharing(false)
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const videoTrack = displayStream.getVideoTracks()[0]

        videoTrack.onended = () => {
          toggleScreenShare()
        }

        const oldTrack = localStream.getVideoTracks()[0]
        localStream.removeTrack(oldTrack)
        oldTrack.stop()
        localStream.addTrack(videoTrack)

        Object.values(peerConnections.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(videoTrack)
        })

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }
        setScreenSharing(true)
      } catch (err) {
        console.log('Screen share cancelled or failed')
      }
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(currentRoom)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socket || !currentRoom) return
    socket.emit('video:chat-message', { roomId: currentRoom, text: chatInput.trim() })
    setChatInput('')
  }

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  // ---- Lobby Screen ----
  if (!inCall) {
    return (
      <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '32px', maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Video size={28} color="white" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Video Meeting</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              Start or join a secure video call with your colleagues
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label">Meeting Code</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter meeting code (e.g. ABC123)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
                  maxLength={10}
                />
                <button
                  className="btn-primary"
                  style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}
                  onClick={generateRoomId}
                  title="Generate random code"
                >
                  Generate
                </button>
              </div>
            </div>

            {joinError && <div className="form-error">{joinError}</div>}

            <button
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}
              onClick={startCall}
              disabled={!roomId.trim() || !isConnected}
            >
              <Video size={18} />
              {!isConnected ? 'Connecting...' : 'Start / Join Meeting'}
            </button>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
              {isConnected
                ? 'Share the meeting code with colleagues to invite them'
                : 'Waiting for socket connection...'
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---- In-Call UI ----
  return (
    <div className="slide-up" style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      height: 'calc(100vh - 140px)'
    }}>
      {/* Top bar */}
      <div className="glass-card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Video size={14} color="white" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Room: {currentRoom}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {peers.length + 1} participant{peers.length + 1 !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setShowChat(!showChat)}
            style={{
              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)',
              background: showChat ? 'rgba(99,102,241,0.15)' : 'var(--glass-bg)',
              color: showChat ? 'var(--color-primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all 0.2s'
            }}
          >
            <MessageSquare size={14} />
            {showChat ? 'Hide Chat' : 'In-Call Chat'}
          </button>
          <button
            style={{
              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '5px'
            }}
            onClick={copyRoomId}
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* Main area: video grid + optional chat */}
      <div style={{ flex: 1, display: 'flex', gap: '12px', minHeight: 0 }}>
        {/* Video grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(remoteStreams.length + 1, 3)}, 1fr)`,
          gap: '10px',
          minHeight: 0
        }}>
          <div style={{
            position: 'relative', borderRadius: '12px', overflow: 'hidden',
            background: '#1a1a2e', border: '1px solid var(--glass-border)',
            minHeight: '180px'
          }}>
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!camEnabled && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#1a1a2e'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 800, color: 'white'
                }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: '6px', left: '6px',
              fontSize: '10px', fontWeight: 700, color: 'white',
              background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '5px',
              backdropFilter: 'blur(4px)'
            }}>
              You {screenSharing ? '(Sharing Screen)' : ''}
            </div>
          </div>

          {remoteStreams.map((rs) => (
            <div key={rs.peerSocketId} style={{
              position: 'relative', borderRadius: '12px', overflow: 'hidden',
              background: '#1a1a2e', border: '1px solid var(--glass-border)',
              minHeight: '180px'
            }}>
              <video
                ref={(el) => {
                  if (el) el.srcObject = rs.stream
                }}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', bottom: '6px', left: '6px',
                fontSize: '10px', fontWeight: 700, color: 'white',
                background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '5px',
                backdropFilter: 'blur(4px)'
              }}>
                {peers.find((p) => p.socketId === rs.peerSocketId)?.name || 'Peer'}
              </div>
            </div>
          ))}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="glass-card" style={{
            width: '280px', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            padding: '0', overflow: 'hidden'
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                <MessageSquare size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Meeting Chat
              </span>
              <button
                onClick={() => setShowChat(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              {chatMessages.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                  No messages yet. Say hello!
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: '8px',
                  background: msg.socketId === socket?.id
                    ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--glass-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: msg.socketId === socket?.id ? 'var(--color-primary)' : 'var(--text-main)'
                    }}>
                      {msg.socketId === socket?.id ? 'You' : msg.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-main)', wordBreak: 'break-word' }}>{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div style={{
              padding: '8px 10px', borderTop: '1px solid var(--glass-border)',
              display: 'flex', gap: '6px'
            }}>
              <input
                type="text"
                className="form-input"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                style={{ flex: 1, fontSize: '12px', padding: '8px 10px' }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                style={{
                  padding: '8px 10px', borderRadius: '8px', border: 'none',
                  background: chatInput.trim() ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.05)',
                  color: chatInput.trim() ? 'white' : 'var(--text-muted)',
                  cursor: chatInput.trim() ? 'pointer' : 'default'
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '12px', flexShrink: 0
      }}>
        <button onClick={toggleMic} style={{
          width: '44px', height: '44px', borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: micEnabled ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.2)',
          color: micEnabled ? 'var(--text-main)' : 'var(--color-danger)',
          border: `1px solid ${micEnabled ? 'var(--glass-border)' : 'rgba(239,68,68,0.3)'}`,
          transition: 'all 0.2s'
        }}>
          {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        <button onClick={toggleCam} style={{
          width: '44px', height: '44px', borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: camEnabled ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.2)',
          color: camEnabled ? 'var(--text-main)' : 'var(--color-danger)',
          border: `1px solid ${camEnabled ? 'var(--glass-border)' : 'rgba(239,68,68,0.3)'}`,
          transition: 'all 0.2s'
        }}>
          {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        <button onClick={toggleScreenShare} style={{
          width: '44px', height: '44px', borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: screenSharing ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
          color: screenSharing ? 'var(--color-success)' : 'var(--text-main)',
          border: `1px solid ${screenSharing ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)'}`,
          transition: 'all 0.2s'
        }}>
          <Monitor size={18} />
        </button>

        <button onClick={endCall} style={{
          width: '52px', height: '52px', borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-danger)', color: 'white',
          transition: 'all 0.2s',
          boxShadow: '0 0 20px rgba(239,68,68,0.3)'
        }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}

export default VideoCall
