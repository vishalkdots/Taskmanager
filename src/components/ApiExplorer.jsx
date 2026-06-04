import React, { useState, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { SocketContext } from '../context/SocketContext'
import {
  Send,
  History,
  PlayCircle,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader
} from 'lucide-react'

function ApiExplorer() {
  const { token } = useContext(AuthContext)
  const { sendClientLog } = useContext(SocketContext)

  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('http://localhost:5000/api/tasks')
  const [headers, setHeaders] = useState(
    JSON.stringify({ 'Content-Type': 'application/json' }, null, 2)
  )
  const [body, setBody] = useState(
    JSON.stringify({ title: 'New Task from API Explorer', description: 'Testing task api.' }, null, 2)
  )

  // Response output state
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [statusText, setStatusText] = useState('')
  const [latency, setLatency] = useState(null)
  const [responseOutput, setResponseOutput] = useState('')
  const [responseHeaders, setResponseHeaders] = useState({})
  
  // Tabs for Editor (Headers, Body)
  const [activeTab, setActiveTab] = useState('body')

  // History state
  const [history, setHistory] = useState([
    {
      id: 1,
      method: 'GET',
      url: 'http://localhost:5000/',
      timestamp: new Date().toLocaleTimeString()
    }
  ])

  // Quick tests templates
  const quickTests = [
    {
      name: 'Server Health Check',
      desc: 'Verify if node backend is running',
      method: 'GET',
      url: 'http://localhost:5000/',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    },
    {
      name: 'Get Tasks List',
      desc: 'Fetch current logged in user\'s tasks',
      method: 'GET',
      url: 'http://localhost:5000/api/tasks',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || '<YOUR_JWT_TOKEN>'}`
      },
      body: ''
    },
    {
      name: 'Create Workspace Task',
      desc: 'Deploy a new task to DB via POST',
      method: 'POST',
      url: 'http://localhost:5000/api/tasks',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || '<YOUR_JWT_TOKEN>'}`
      },
      body: {
        title: 'Task via API Explorer',
        description: 'Created using the built-in HTTP request client.',
        priority: 'high',
        category: 'Bugfix'
      }
    },
    {
      name: 'Register Account',
      desc: 'Create new user profile via AUTH router',
      method: 'POST',
      url: 'http://localhost:5000/api/auth/register',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'API Tester',
        email: `tester_${Math.floor(Math.random() * 1000)}@example.com`,
        password: 'password123'
      }
    }
  ]

  const loadQuickTest = (test) => {
    setMethod(test.method)
    setUrl(test.url)
    
    // Auto-update authorization header if template is tasks but token is updated
    let finalHeaders = { ...test.headers }
    if (test.url.includes('/api/tasks') && token) {
      finalHeaders['Authorization'] = `Bearer ${token}`
    }
    setHeaders(JSON.stringify(finalHeaders, null, 2))
    
    setBody(test.body ? JSON.stringify(test.body, null, 2) : '')
  }

  const handleSendRequest = async (e) => {
    if (e) e.preventDefault()
    if (!url) return

    setLoading(true)
    setStatus(null)
    setStatusText('')
    setLatency(null)
    setResponseOutput('')
    setResponseHeaders({})

    const startTime = Date.now()

    try {
      // Parse Headers
      let parsedHeaders = {}
      if (headers.trim()) {
        parsedHeaders = JSON.parse(headers)
      }

      // Prepare request payload
      const requestOptions = {
        method,
        headers: parsedHeaders
      }

      if (['POST', 'PUT', 'DELETE'].includes(method) && body.trim()) {
        requestOptions.body = body
      }

      const response = await fetch(url, requestOptions)
      const endTime = Date.now()
      const reqLatency = endTime - startTime
      setLatency(reqLatency)
      setStatus(response.status)
      setStatusText(response.statusText)

      // Get Headers
      const resHeaders = {}
      response.headers.forEach((val, key) => {
        resHeaders[key] = val
      })
      setResponseHeaders(resHeaders)

      // Parse output
      let outputText = ''
      try {
        const json = await response.json()
        outputText = JSON.stringify(json, null, 2)
      } catch (err) {
        outputText = await response.text()
      }

      setResponseOutput(outputText)

      // Save to History
      setHistory((prev) => [
        {
          id: Date.now(),
          method,
          url,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9) // Limit to 10
      ])

      // Push activity log to WebSocket stream
      sendClientLog(
        `HTTP API call executed: [${method}] ${url} -> Status: ${response.status} (${reqLatency}ms)`
      )
    } catch (err) {
      const endTime = Date.now()
      setLatency(endTime - startTime)
      setStatus(500)
      setStatusText('Fetch Error')
      setResponseOutput(`Network request failed:\n${err.message}`)
      
      sendClientLog(`HTTP API call failed: [${method}] ${url} -> Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="slide-up api-explorer-layout">
      {/* Top Grid: API Client Request Form */}
      <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="api-request-bar">
            <select
              className="api-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>

            <input
              type="text"
              className="api-url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter endpoint URL (e.g. http://localhost:5000/api/tasks)"
              required
            />

            <button type="submit" className="btn-send" disabled={loading}>
              {loading ? (
                <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : (
                <>
                  <Send size={16} />
                  Send
                </>
              )}
            </button>
          </div>

          {/* Request Config Tabs */}
          <div>
            <div className="api-tabs">
              <button
                type="button"
                className={`api-tab ${activeTab === 'body' ? 'active' : ''}`}
                onClick={() => setActiveTab('body')}
              >
                Request Body
              </button>
              <button
                type="button"
                className={`api-tab ${activeTab === 'headers' ? 'active' : ''}`}
                onClick={() => setActiveTab('headers')}
              >
                Headers
              </button>
            </div>

            <div className="api-tab-content">
              {activeTab === 'body' ? (
                <div className="form-group">
                  <textarea
                    className="code-viewer"
                    rows="6"
                    style={{ background: '#090d16', color: '#c084fc', border: '1px solid var(--glass-border)', outline: 'none', resize: 'vertical' }}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='{\n  "key": "value"\n}'
                  />
                </div>
              ) : (
                <div className="form-group">
                  <textarea
                    className="code-viewer"
                    rows="6"
                    style={{ background: '#090d16', color: '#38bdf8', border: '1px solid var(--glass-border)', outline: 'none', resize: 'vertical' }}
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    placeholder='{\n  "Content-Type": "application/json"\n}'
                  />
                </div>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Response Panel and Sidebar Quick Tests */}
      <div className="api-history-grid">
        {/* Left: Response Output */}
        <div className="glass-card api-results-panel">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Response Payload</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
              Execution details and returned JSON records.
            </p>
          </div>

          {/* Status Metrics */}
          {status !== null && (
            <div className="api-metrics-row">
              <div className={`metric-badge ${status >= 200 && status < 300 ? 'success' : 'error'}`}>
                {status >= 200 && status < 300 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                Status: {status} {statusText}
              </div>

              <div className="metric-badge latency">
                <Clock size={14} />
                Latency: {latency} ms
              </div>
            </div>
          )}

          {/* Code Output Viewer */}
          <pre className="code-viewer" style={{ minHeight: '200px' }}>
            {loading ? (
              <span style={{ color: 'var(--text-muted)' }}>Executing network request...</span>
            ) : responseOutput ? (
              responseOutput
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Submit a request to fetch API responses</span>
            )}
          </pre>
        </div>

        {/* Right: Quick Tests Sandbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick templates */}
          <div className="glass-card quick-test-section">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Quick Sandbox Templates</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                Pre-configured endpoint payloads.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {quickTests.map((test, index) => (
                <button
                  key={index}
                  className="quick-test-btn"
                  onClick={() => loadQuickTest(test)}
                >
                  <div className="quick-test-header">
                    <span className="quick-test-name">{test.name}</span>
                    <span className={`quick-test-method ${test.method.toLowerCase()}`}>
                      {test.method}
                    </span>
                  </div>
                  <span className="quick-test-desc">{test.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Call History */}
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <History size={16} />
              Session History
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {history.map((hist) => (
                <div
                  key={hist.id}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                  onClick={() => {
                    setMethod(hist.method)
                    setUrl(hist.url)
                  }}
                >
                  <span style={{ display: 'flex', gap: '6px', overflow: 'hidden' }}>
                    <strong style={{ color: hist.method === 'GET' ? 'var(--color-success)' : 'var(--color-primary-light)' }}>
                      {hist.method}
                    </strong>
                    <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '140px' }} title={hist.url}>
                      {hist.url.replace('http://localhost:5000', '')}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{hist.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiExplorer
