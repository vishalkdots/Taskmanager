import React, { createContext, useState, useEffect } from 'react'
import { api } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('userInfo')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        setToken(parsed.token)
      } catch (err) {
        localStorage.removeItem('userInfo')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.post('/auth/login', { email, password })

      setUser(data)
      setToken(data.token)
      localStorage.setItem('userInfo', JSON.stringify(data))
      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const register = async (name, email, password, role) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.post('/auth/register', { name, email, password, role })

      setUser(data)
      setToken(data.token)
      localStorage.setItem('userInfo', JSON.stringify(data))
      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('userInfo')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  )
}
