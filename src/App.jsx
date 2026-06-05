import React, { useContext, useState, useEffect } from 'react'
import { AuthContext } from './context/AuthContext'
import { SocketContext } from './context/SocketContext'
import Dashboard from './components/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import ApiExplorer from './components/ApiExplorer'
import ChatRoom from './components/ChatRoom'
import AdminDirectory from './components/AdminDirectory'
import HrSalaryManager from './components/HrSalaryManager'
import AccountantLedger from './components/AccountantLedger'
import TeamBuilder from './components/TeamBuilder'
import ProjectManager from './components/ProjectManager'
import VideoCall from './components/VideoCall'
import {
  LayoutDashboard,
  KanbanSquare,
  Terminal,
  LogOut,
  Wifi,
  WifiOff,
  User,
  Mail,
  Lock,
  Loader,
  MessageSquare,
  Users,
  DollarSign,
  TrendingUp,
  Briefcase,
  Megaphone,
  Bell,
  X,
  FolderKanban,
  Video
} from 'lucide-react'

function App() {
  const { user, loading, login, register, logout } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isRegister, setIsRegister] = useState(false)
  
  // Auth Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('hr')
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Real-time group toast alert
  const [activeAlert, setActiveAlert] = useState(null)

  useEffect(() => {
    if (!socket) return

    const handleReceiveAlert = (alertData) => {
      setActiveAlert(alertData)
    }

    socket.on('notification:receive', handleReceiveAlert)

    return () => {
      socket.off('notification:receive', handleReceiveAlert)
    }
  }, [socket])

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setSubmitting(true)
    
    try {
      if (isRegister) {
        if (!name || !email || !password || !role) {
          throw new Error('All fields are required')
        }
        await register(name, email, password, role)
      } else {
        if (!email || !password) {
          throw new Error('All fields are required')
        }
        await login(email, password)
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-switch tabs if the activeTab is not allowed for the new logged-in user
  useEffect(() => {
    if (user) {
      // Set default tab on login based on role
      if (user?.role === 'admin') setActiveTab('directory')
      else if (user?.role === 'hr') setActiveTab('salary')
      else if (user?.role === 'accountant') setActiveTab('ledger')
      else if (user?.role === 'teamleader') setActiveTab('teambuilder')
      else setActiveTab('dashboard')
    }
  }, [user])

  if (loading) {
    return (
      <div className="auth-wrapper">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading TaskFlow...</p>
        </div>
      </div>
    )
  }

  // Not Logged In -> Render Auth Form
  if (!user) {
    return (
      <div className="auth-wrapper fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Briefcase size={24} />
            </div>
            <h1 className="auth-title">Corporate Portal</h1>
            <p className="auth-subtitle">
              {isRegister ? 'Register your company profile credentials' : 'Sign in to access corporate workspace'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Corporate Role</label>
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  >
                    <option value="hr">HR Staff</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            {authError && <div className="form-error">{authError}</div>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <Loader size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : isRegister ? (
                'Create Profile'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="auth-footer">
            {isRegister ? (
              <>
                Already registered?{' '}
                <a
                  href="#"
                  className="auth-link"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsRegister(false)
                    setAuthError('')
                  }}
                >
                  Sign In
                </a>
              </>
            ) : (
              <>
                New to the platform?{' '}
                <a
                  href="#"
                  className="auth-link"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsRegister(true)
                    setAuthError('')
                  }}
                >
                  Register Account
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render role text helper
  const getRoleDesignation = (roleStr) => {
    switch (roleStr) {
      case 'admin': return 'System Admin'
      case 'hr': return 'HR Manager'
      case 'accountant': return 'Company Accountant'
      case 'teamleader': return 'Team Leader'
      default: return 'Employee'
    }
  }

  return (
    <div className="app-container fade-in">
      
      {/* Floating Team Alert Notification Banner */}
      {activeAlert && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(245, 158, 11, 0.15)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            width: '360px',
            display: 'flex',
            gap: '12px',
            animation: 'slide-up-anim 0.3s ease-out'
          }}
        >
          <div style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center' }}>
            <Megaphone size={24} style={{ animation: 'pulse 1s infinite' }} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: 'white' }}>{activeAlert.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px' }}>{activeAlert.message}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Broadcasted by: {activeAlert.senderName} ({activeAlert.timestamp})
            </div>
          </div>
          <button
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', height: 'fit-content' }}
            onClick={() => setActiveAlert(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Briefcase size={20} />
            </div>
            <span className="logo-text">TaskFlow ERP</span>
          </div>

          <nav className="sidebar-menu">
            {/* System Overview Dashboard (All roles) */}
            <button
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              Dashboard Summary
            </button>

            {/* Admin and HR directory */}
            {(user?.role === 'admin' || user?.role === 'hr') && (
              <button
                className={`menu-item ${activeTab === 'directory' ? 'active' : ''}`}
                onClick={() => setActiveTab('directory')}
              >
                <Users size={18} />
                Staff Directory
              </button>
            )}

            {/* HR and Admin Salary manager */}
            {(user?.role === 'hr' || user?.role === 'admin') && (
              <button
                className={`menu-item ${activeTab === 'salary' ? 'active' : ''}`}
                onClick={() => setActiveTab('salary')}
              >
                <DollarSign size={18} />
                Salary & Payroll
              </button>
            )}

            {/* Accountant and Admin Income Ledger */}
            {(user?.role === 'accountant' || user?.role === 'admin') && (
              <button
                className={`menu-item ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <TrendingUp size={18} />
                Ledger Book
              </button>
            )}

            {/* Admin, HR, and Team Leader — Team Builder */}
            {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'teamleader') && (
              <button
                className={`menu-item ${activeTab === 'teambuilder' ? 'active' : ''}`}
                onClick={() => setActiveTab('teambuilder')}
              >
                <Users size={18} />
                Team Builder
              </button>
            )}

            {/* Project Portfolio (All roles) */}
            <button
              className={`menu-item ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <FolderKanban size={18} />
              Project Portfolio
            </button>

            {/* Video Meeting (All roles) */}
            <button
              className={`menu-item ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
            >
              <Video size={18} />
              Video Meeting
            </button>

            {/* Project Task board (Employees, Team Leaders, and Admins) */}
            {(user?.role === 'employee' || user?.role === 'teamleader' || user?.role === 'admin') && (
              <button
                className={`menu-item ${activeTab === 'kanban' ? 'active' : ''}`}
                onClick={() => setActiveTab('kanban')}
              >
                <KanbanSquare size={18} />
                Project Kanban
              </button>
            )}

            {/* Corporate Chat (All roles) */}
            <button
              className={`menu-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={18} />
              Workspace Chat
            </button>

            {/* API Explorer (All roles) */}
            <button
              className={`menu-item ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
            >
              <Terminal size={18} />
              API Sandbox
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.designation || getRoleDesignation(user?.role)}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header-bar">
          <div>
            <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700 }}>
              {activeTab === 'dashboard' && 'Live Workspace Dashboard'}
              {activeTab === 'projects' && 'Corporate Project Portfolio'}
              {activeTab === 'directory' && 'Corporate Staff Directory'}
              {activeTab === 'salary' && 'Payroll Salary Logger'}
              {activeTab === 'ledger' && 'Company Income Ledger'}
              {activeTab === 'teambuilder' && 'Workspace Team Builder'}
              {activeTab === 'kanban' && 'Real-Time Kanban Board'}
              {activeTab === 'chat' && 'Workspace Chatroom'}
              {activeTab === 'video' && 'Video Meeting'}
              {activeTab === 'api' && 'API Request Laboratory'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              {activeTab === 'dashboard' && 'Live performance logs, activity streams and system indicators.'}
              {activeTab === 'projects' && 'Track project details, assign teams, and delegate workloads.'}
              {activeTab === 'directory' && 'Promote designations, adjust role permissions, and view directory.'}
              {activeTab === 'salary' && 'Log payroll cash outflows and track corporate expenditures.'}
              {activeTab === 'ledger' && 'Credit project incomes, track debits, and balance company revenue.'}
              {activeTab === 'teambuilder' && 'Assemble collaborative workspace groups and broadcast live push alert messages.'}
              {activeTab === 'kanban' && 'Drag-and-drop collaborative tasks sync across active employee sessions.'}
              {activeTab === 'chat' && 'Converse with active team members in real-time.'}
              {activeTab === 'video' && 'Secure video conferencing with screen sharing for your team.'}
              {activeTab === 'api' && 'Mock and test HTTP requests with direct latency auditing.'}
            </p>
          </div>

          <div className="connection-status">
            {isConnected ? (
              <>
                <Wifi size={14} style={{ color: 'var(--color-success)' }} />
                <span>Socket Connected</span>
                <div className="status-dot online"></div>
              </>
            ) : (
              <>
                <WifiOff size={14} style={{ color: 'var(--color-danger)' }} />
                <span>Offline (Reconnecting)</span>
                <div className="status-dot offline"></div>
              </>
            )}
          </div>
        </header>

        {/* Tab views */}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'projects' && <ProjectManager />}
        {activeTab === 'directory' && <AdminDirectory />}
        {activeTab === 'salary' && <HrSalaryManager />}
        {activeTab === 'ledger' && <AccountantLedger />}
        {activeTab === 'teambuilder' && <TeamBuilder />}
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'chat' && <ChatRoom />}
        {activeTab === 'video' && <VideoCall />}
        {activeTab === 'api' && <ApiExplorer />}
      </main>
    </div>
  )
}

export default App
