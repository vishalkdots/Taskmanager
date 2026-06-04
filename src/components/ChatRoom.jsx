import React, { useState, useEffect, useRef, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { SocketContext } from '../context/SocketContext'
import { Send, Users, MessageSquare, Clock } from 'lucide-react'

function ChatRoom() {
  const { user } = useContext(AuthContext)
  const { chatMessages, sendChatMessage, onlineUsers } = useContext(SocketContext)
  const [text, setText] = useState('')
  const messagesEndRef = useRef(null)

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendChatMessage(text)
    setText('')
  }

  // Format message time
  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const currentUserId = user._id || user.id

  return (
    <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px', height: 'calc(100vh - 160px)' }}>
      {/* Chat Messages Panel */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '16px', overflow: 'hidden' }}>
        
        {/* Messages Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <MessageSquare size={20} style={{ color: 'var(--color-primary-light)' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Workspace Chatroom</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Real-time communication across workspace collaborators</p>
          </div>
        </div>

        {/* Scrollable messages container */}
        <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {chatMessages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: 'var(--text-muted)' }}>
              <MessageSquare size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '13px' }}>No messages yet. Say hello to start the conversation!</p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const senderId = msg.sender && typeof msg.sender === 'object' ? msg.sender._id : msg.sender
              const isMe = senderId === currentUserId
              const senderName = msg.sender && typeof msg.sender === 'object' ? msg.sender.name : 'Unknown User'

              return (
                <div
                  key={msg._id || Math.random()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    width: '100%',
                    gap: '4px'
                  }}
                >
                  {/* Sender Name (above bubble) */}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '0 4px' }}>
                    {isMe ? 'You' : senderName}
                  </span>

                  {/* Bubble Row */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', maxWidth: '75%', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    {/* User Initials Circle */}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isMe ? 'var(--gradient-primary)' : 'var(--gradient-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700,
                        justifyContent: 'center',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      {senderName.charAt(0).toUpperCase()}
                    </div>

                    {/* Bubble Content */}
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                        border: isMe ? 'none' : '1px solid var(--glass-border)',
                        color: isMe ? 'white' : 'var(--text-main)',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        boxShadow: isMe ? 'var(--shadow-glow-purple)' : 'none',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>

                  {/* Timestamp (below bubble) */}
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', padding: '0 4px', marginTop: '2px' }}>
                    <Clock size={8} />
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
          <input
            type="text"
            className="api-url-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message here..."
            style={{ borderRadius: 'var(--radius-md)' }}
            maxLength={500}
            required
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 20px', borderRadius: 'var(--radius-md)' }}>
            <Send size={16} />
            Send
          </button>
        </form>
      </div>

      {/* Online Users Side Panel */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <Users size={18} style={{ color: 'var(--color-success)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Online Members</h3>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onlineUsers.map((member) => (
            <div
              key={member.socketId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--gradient-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }} title={member.name}>
                  {member.name}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--color-success)', fontWeight: 500 }}>Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ChatRoom
