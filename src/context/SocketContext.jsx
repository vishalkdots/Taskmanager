import React, { createContext, useEffect, useState, useContext, useRef } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './AuthContext'
import { api } from '../services/api'

export const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const { user, token } = useContext(AuthContext)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [telemetry, setTelemetry] = useState({
    cpu: 0,
    memory: 0,
    uptime: 0,
    freeMemGb: '0.00',
    totalMemGb: '0.00',
    activeConnections: 0,
    timestamp: '--:--:--'
  })
  const [activityLogs, setActivityLogs] = useState([])
  const [chatMessages, setChatMessages] = useState([])

  // Fetch chat message history when token changes (login occurs)
  useEffect(() => {
    if (token) {
      api.get('/chat')
        .then((data) => setChatMessages(data))
        .catch((err) => console.error('Chat history fetch error:', err))
    } else {
      setChatMessages([])
    }
  }, [token])

  useEffect(() => {
    // Create new socket connection
    const newSocket = io('https://taskmanager-api-6gbm.onrender.com', {
      transports: ['websocket', 'polling']
    })

    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      console.log('Websocket connected to backend')
      if (user) {
        newSocket.emit('presence:join', user)
      }
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Listen to real-time events
    newSocket.on('presence:list', (users) => {
      setOnlineUsers(users)
    })

    newSocket.on('system:telemetry', (stats) => {
      setTelemetry(stats)
    })

    newSocket.on('system:history', (logs) => {
      setActivityLogs(logs)
    })

    newSocket.on('system:activity', (log) => {
      setActivityLogs((prev) => {
        const updated = [...prev, log]
        if (updated.length > 50) updated.shift()
        return updated
      })
    })

    newSocket.on('chat:message', (msg) => {
      setChatMessages((prev) => {
        // Prevent duplicate messages just in case
        if (prev.some((m) => m._id === msg._id)) return prev
        return [...prev, msg]
      })
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const prevUserRef = useRef(user)

  // Sync presence when user login state changes
  useEffect(() => {
    if (socket && isConnected) {
      if (user) {
        socket.emit('presence:join', user)
      } else if (prevUserRef.current) {
        // Only reconnect if transitioning from logged-in to logged-out
        socket.disconnect()
        socket.connect()
      }
    }
    prevUserRef.current = user
  }, [user, socket, isConnected])

  const sendClientLog = (message) => {
    if (socket && isConnected) {
      socket.emit('client:log', {
        message,
        user: user ? user.name : 'Guest'
      })
    }
  }

  const sendChatMessage = (text) => {
    if (socket && isConnected && text.trim()) {
      socket.emit('chat:message', { text })
    }
  }

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      onlineUsers,
      telemetry,
      activityLogs,
      chatMessages,
      sendClientLog,
      sendChatMessage
    }}>
      {children}
    </SocketContext.Provider>
  )
}
