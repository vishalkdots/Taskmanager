import React, { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { SocketContext } from '../context/SocketContext'
import { AuthContext } from '../context/AuthContext'
import {
  Monitor,
  MonitorOff,
  MousePointer,
  Keyboard,
  X,
  Check,
  Loader,
  Maximize2,
  Minimize2
} from 'lucide-react'

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

function RemoteDesktop() {
  const { socket, isConnected, onlineUsers } = useContext(SocketContext)
  const { user } = useContext(AuthContext)

  const [activeSessions, setActiveSessions] = useState([])
  const [incomingRequest, setIncomingRequest] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlMode, setControlMode] = useState(false)

  const remoteVideoRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const pcRef = useRef(null)
  const screenStreamRef = useRef(null)
  const controlCanvasRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    const handleAccessRequest = ({ fromSocketId, fromUserId, fromName }) => {
      setIncomingRequest({ fromSocketId, fromUserId, fromName })
    }

    const handleAccessResponse = ({ fromSocketId, fromName, accepted }) => {
      if (accepted) {
        setActiveSessions((prev) => [
          ...prev,
          {
            peerSocketId: fromSocketId,
            peerName: fromName,
            role: 'controller',
            connected: false
          }
        ])
        startScreenViewer(fromSocketId)
      }
    }

    const handleRemoteOffer = async ({ from, offer }) => {
      const session = activeSessions.find(s => s.peerSocketId === from)
      if (!session || session.role !== 'target') return

      const pc = new RTCPeerConnection(STUN_SERVERS)
      pcRef.current = pc

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current)
        })
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('remote:ice-candidate', { to: from, candidate: event.candidate })
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('remote:answer', { to: from, answer })

      setActiveSessions((prev) =>
        prev.map(s => s.peerSocketId === from ? { ...s, connected: true } : s)
      )
    }

    const handleRemoteAnswer = async ({ from, answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
        setActiveSessions((prev) =>
          prev.map(s => s.peerSocketId === from ? { ...s, connected: true } : s)
        )
      }
    }

    const handleRemoteIceCandidate = async ({ from, candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Remote ICE error:', err)
        }
      }
    }

    const handleControlEvent = ({ type, data }) => {
      simulateControl(type, data)
    }

    socket.on('remote:access-request', handleAccessRequest)
    socket.on('remote:access-response', handleAccessResponse)
    socket.on('remote:offer', handleRemoteOffer)
    socket.on('remote:answer', handleRemoteAnswer)
    socket.on('remote:ice-candidate', handleRemoteIceCandidate)
    socket.on('remote:control-event', handleControlEvent)

    return () => {
      socket.off('remote:access-request', handleAccessRequest)
      socket.off('remote:access-response', handleAccessResponse)
      socket.off('remote:offer', handleRemoteOffer)
      socket.off('remote:answer', handleRemoteAnswer)
      socket.off('remote:ice-candidate', handleRemoteIceCandidate)
      socket.off('remote:control-event', handleControlEvent)
    }
  }, [socket, activeSessions])

  const simulateControl = (type, data) => {
    console.log(`[Remote Control] ${type}:`, data)
  }

  const startScreenViewer = async (peerSocketId) => {
    const pc = new RTCPeerConnection(STUN_SERVERS)
    pcRef.current = pc

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0]
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
      setActiveSessions((prev) =>
        prev.map(s => s.peerSocketId === peerSocketId ? { ...s, connected: true } : s)
      )
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('remote:ice-candidate', { to: peerSocketId, candidate: event.candidate })
      }
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('remote:offer', { to: peerSocketId, offer })
    } catch (err) {
      console.error('Error creating remote offer:', err)
    }
  }

  const requestAccess = (targetUser) => {
    if (!socket) return
    socket.emit('remote:request-access', { toUserId: targetUser._id })
  }

  const respondToRequest = (accepted) => {
    if (!socket || !incomingRequest) return

    socket.emit('remote:respond-access', {
      toSocketId: incomingRequest.fromSocketId,
      accepted
    })

    if (accepted) {
      startScreenSharing(incomingRequest.fromSocketId)
    }

    setIncomingRequest(null)
  }

  const startScreenSharing = async (controllerSocketId) => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })
      screenStreamRef.current = displayStream

      displayStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing()
      }

      setActiveSessions((prev) => [
        ...prev,
        {
          peerSocketId: controllerSocketId,
          peerName: incomingRequest?.fromName || 'Controller',
          role: 'target',
          connected: false
        }
      ])
    } catch (err) {
      console.error('Screen share failed:', err)
    }
  }

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    setActiveSessions([])
  }

  const endRemoteSession = (session) => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (session.role === 'target') {
      stopScreenSharing()
    }
    setActiveSessions([])
    setControlMode(false)
  }

  const handleCanvasMouseMove = (e) => {
    if (!controlMode || !socket || !activeSessions[0]) return
    const rect = controlCanvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    socket.emit('remote:control-event', {
      toSocketId: activeSessions[0].peerSocketId,
      type: 'mousemove',
      data: { x, y }
    })
  }

  const handleCanvasClick = (e) => {
    if (!controlMode || !socket || !activeSessions[0]) return
    const rect = controlCanvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    socket.emit('remote:control-event', {
      toSocketId: activeSessions[0].peerSocketId,
      type: 'click',
      data: { x, y, button: e.button }
    })
  }

  const handleCanvasKeyDown = (e) => {
    if (!controlMode || !socket || !activeSessions[0]) return
    socket.emit('remote:control-event', {
      toSocketId: activeSessions[0].peerSocketId,
      type: 'keydown',
      data: { key: e.key, code: e.code, altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }
    })
  }

  const handleCanvasKeyUp = (e) => {
    if (!controlMode || !socket || !activeSessions[0]) return
    socket.emit('remote:control-event', {
      toSocketId: activeSessions[0].peerSocketId,
      type: 'keyup',
      data: { key: e.key, code: e.code }
    })
  }

  const onlineExceptMe = onlineUsers.filter(
    (u) => u._id && user?._id && u._id.toString() !== user._id.toString()
  )

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Incoming request popup */}
      {incomingRequest && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-card" style={{ padding: '28px', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'var(--gradient-warning)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Monitor size={26} color="white" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Remote Access Request</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '8px 0 20px' }}>
              <strong style={{ color: 'var(--text-main)' }}>{incomingRequest.fromName}</strong> wants to view and control your screen. Do you want to allow this?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => respondToRequest(false)}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--glass-border)',
                  background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)',
                  cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <X size={16} /> Deny
              </button>
              <button
                onClick={() => respondToRequest(true)}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none',
                  background: 'var(--gradient-success)', color: 'white',
                  cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Check size={16} /> Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active remote sessions */}
      {activeSessions.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '12px',
          height: fullscreen ? 'calc(100vh - 100px)' : 'auto'
        }}>
          <div className="glass-card" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'var(--gradient-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Monitor size={14} color="white" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>
                {activeSessions[0].role === 'controller'
                  ? `Viewing ${activeSessions[0].peerName}'s Screen`
                  : `Sharing screen with ${activeSessions[0].peerName}`
                }
              </span>
              {activeSessions[0].connected && (
                <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>● Connected</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {activeSessions[0].role === 'controller' && (
                <>
                  <button
                    onClick={() => setControlMode(!controlMode)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                      background: controlMode ? 'rgba(99,102,241,0.15)' : 'var(--glass-bg)',
                      color: controlMode ? 'var(--color-primary)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    <MousePointer size={14} />
                    {controlMode ? 'Control: ON' : 'Control: OFF'}
                  </button>
                  <button
                    onClick={() => setFullscreen(!fullscreen)}
                    style={{
                      padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)', color: 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </>
              )}
              <button
                onClick={() => endRemoteSession(activeSessions[0])}
                style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}
              >
                <X size={14} /> End Session
              </button>
            </div>
          </div>

          {/* Remote screen viewer */}
          {activeSessions[0].role === 'controller' && (
            <div
              ref={controlCanvasRef}
              tabIndex={0}
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
              onKeyDown={handleCanvasKeyDown}
              onKeyUp={handleCanvasKeyUp}
              style={{
                flex: 1, borderRadius: '12px', overflow: 'hidden',
                background: '#0a0a1a', border: controlMode ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                position: 'relative', minHeight: '300px',
                outline: 'none',
                cursor: controlMode ? 'crosshair' : 'default'
              }}
            >
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {!activeSessions[0].connected && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(10,10,26,0.8)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <Loader size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '12px' }}>
                      Waiting for {activeSessions[0].peerName} to share their screen...
                    </p>
                  </div>
                </div>
              )}
              {controlMode && activeSessions[0].connected && (
                <div style={{
                  position: 'absolute', top: '8px', left: '8px',
                  padding: '4px 10px', borderRadius: '6px',
                  background: 'rgba(99,102,241,0.85)',
                  color: 'white', fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                  <MousePointer size={12} />
                  Remote Control Active — Click & type on this screen
                </div>
              )}
            </div>
          )}

          {/* Target user sees this */}
          {activeSessions[0].role === 'target' && (
            <div className="glass-card" style={{
              padding: '40px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
            }}>
              <Monitor size={40} style={{ color: 'var(--color-success)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Screen Sharing Active</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                You are sharing your screen with <strong>{activeSessions[0].peerName}</strong>.
                They can see your screen in real-time.
              </p>
              <button
                onClick={() => endRemoteSession(activeSessions[0])}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none',
                  background: 'var(--gradient-danger)', color: 'white',
                  cursor: 'pointer', fontWeight: 600, marginTop: '8px'
                }}
              >
                Stop Sharing
              </button>
            </div>
          )}
        </div>
      )}

      {/* User list - only show when no active session */}
      {activeSessions.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'var(--gradient-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Monitor size={22} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Remote Desktop Access</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Select an online colleague to request screen access
                </p>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
              {onlineExceptMe.length} colleague{onlineExceptMe.length !== 1 ? 's' : ''} online
            </p>

            {onlineExceptMe.length === 0 ? (
              <div style={{
                padding: '24px', textAlign: 'center', borderRadius: '10px',
                border: '1px dashed var(--glass-border)',
                color: 'var(--text-muted)', fontSize: '13px'
              }}>
                No other colleagues online. Wait for someone to connect.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {onlineExceptMe.map((member) => (
                  <div key={member.socketId} className="presence-user" style={{ padding: '12px 14px' }}>
                    <div className="presence-user-left">
                      <div className="presence-dot"></div>
                      <div>
                        <div className="presence-name">{member.name}</div>
                        <div className="presence-email">
                          {member.designation || member.role?.toUpperCase() || 'STAFF'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => requestAccess(member)}
                      style={{
                        padding: '8px 14px', borderRadius: '8px', border: 'none',
                        background: 'var(--gradient-primary)', color: 'white',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Monitor size={14} />
                      Request Access
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>How it works</h4>
            <ol style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '2', paddingLeft: '16px' }}>
              <li>Click <strong>Request Access</strong> on a colleague who is online</li>
              <li>They get a popup asking to Allow or Deny your request</li>
              <li>If allowed, their screen streams to you in real-time</li>
              <li>Toggle <strong>Control Mode</strong> to send mouse/keyboard inputs</li>
              <li>Move your mouse and click on the remote screen to interact</li>
            </ol>
            <p style={{ color: 'var(--color-warning)', fontSize: '11px', marginTop: '8px' }}>
              Note: Full OS-level control requires a native app. Screen viewing and browser-level input relay are supported.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default RemoteDesktop
