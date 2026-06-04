import React, { useContext, useEffect, useState } from 'react'
import { SocketContext } from '../context/SocketContext'
import { AuthContext } from '../context/AuthContext'
import { api } from '../services/api'
import {
  Cpu,
  Database,
  Users,
  Activity,
  Clock,
  Server,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  CheckSquare
} from 'lucide-react'

function Dashboard() {
  const { user, token } = useContext(AuthContext)
  const { telemetry, onlineUsers, activityLogs } = useContext(SocketContext)
  
  // Local DB Stats
  const [dbUsers, setDbUsers] = useState([])
  const [financials, setFinancials] = useState([])
  const [tasks, setTasks] = useState([])

  const [cpuHistory, setCpuHistory] = useState(Array(15).fill(0))
  const [memHistory, setMemHistory] = useState(Array(15).fill(0))

  useEffect(() => {
    if (telemetry && telemetry.timestamp !== '--:--:--') {
      setCpuHistory((prev) => [...prev.slice(1), telemetry.cpu])
      setMemHistory((prev) => [...prev.slice(1), telemetry.memory])
    }
  }, [telemetry])

  // Fetch corporate context based on role
  useEffect(() => {
    if (token) {
      // All logged in users can see staff directory stats
      api.get('/auth/users')
        .then((data) => setDbUsers(Array.isArray(data) ? data : []))
        .catch((err) => console.error(err))

      // Admins, HR and Accountants see corporate ledger stats
      if (user && ['admin', 'hr', 'accountant'].includes(user.role || 'employee')) {
        api.get('/financials')
          .then((data) => setFinancials(Array.isArray(data) ? data : []))
          .catch((err) => console.error(err))
      }

      // Employees, Team Leaders, and Admins see tasks
      if (user && ['employee', 'teamleader', 'admin'].includes(user.role || 'employee')) {
        api.get('/tasks')
          .then((data) => setTasks(Array.isArray(data) ? data : []))
          .catch((err) => console.error(err))
      }
    }
  }, [token, user])

  const handleToggleTaskComplete = async (taskObj) => {
    try {
      const data = await api.put(`/tasks/${taskObj._id}`, { status: 'done' })
      setTasks((prev) => prev.map((t) => (t._id === taskObj._id ? data : t)))
      if (socket) {
        socket.emit('task:update', data)
      }
    } catch (err) {
      alert(err.message || 'Failed to complete task')
    }
  }

  // Format uptime (seconds to hh:mm:ss)
  const formatUptime = (seconds) => {
    if (!seconds) return '00:00:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Draw SVG sparkline path
  const getSvgPath = (history) => {
    const width = 500
    const height = 140
    const padding = 5
    const points = history.map((val, idx) => {
      const x = padding + (idx / (history.length - 1)) * (width - 2 * padding)
      const y = height - padding - (val / 100) * (height - 2 * padding)
      return `${x},${y}`
    })
    return `M ${points.join(' L ')}`
  }

  const getAreaPath = (history) => {
    const width = 500
    const height = 140
    const padding = 5
    const path = getSvgPath(history)
    if (!path) return ''
    const rightX = width - padding
    const bottomY = height - padding
    const leftX = padding
    return `${path} L ${rightX},${bottomY} L ${leftX},${bottomY} Z`
  }

  // Role summary calculations
  const renderRoleSummaryCards = () => {
    const totalStaff = dbUsers.length
    const hrsCount = dbUsers.filter(u => u.role === 'hr').length
    const accCount = dbUsers.filter(u => u.role === 'accountant').length
    const tlCount = dbUsers.filter(u => u.role === 'teamleader').length
    const empCount = dbUsers.filter(u => u.role === 'employee').length

    const totalSalaries = financials.filter(f => f.category === 'salary').reduce((acc, c) => acc + c.amount, 0)
    const totalOfficeExpenses = financials.filter(f => f.category === 'office_expense').reduce((acc, c) => acc + c.amount, 0)
    
    const totalIncomes = financials.filter(f => f.type === 'income').reduce((acc, c) => acc + c.amount, 0)
    const totalExpenses = financials.filter(f => f.type === 'expense').reduce((acc, c) => acc + c.amount, 0)
    const netProfit = totalIncomes - totalExpenses

    const pendingTasks = tasks.filter(t => t.status === 'pending').length
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length
    const completedTasks = tasks.filter(t => t.status === 'done').length

    const myUserId = user._id || user.id
    const myAssignedTasks = tasks.filter(t => t.assignedTo && (t.assignedTo._id === myUserId || t.assignedTo === myUserId))
    const myCompletedTasks = myAssignedTasks.filter(t => t.status === 'done').length
    const myPendingTasks = myAssignedTasks.filter(t => t.status === 'pending' || t.status === 'in-progress').length

    switch (user?.role || 'employee') {
      case 'admin':
        return (
          <>
            <div className="glass-card tel-card cpu">
              <div className="tel-header">
                <span>Employee Registry</span>
                <Users size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="tel-value">{totalStaff} Members</div>
              <div className="tel-sub">HR: {hrsCount} | Acc: {accCount} | TL: {tlCount} | Staff: {empCount}</div>
            </div>
            <div className="glass-card tel-card mem">
              <div className="tel-header">
                <span>Company Ledger Balance</span>
                <TrendingUp size={16} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className="tel-value" style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ${netProfit.toLocaleString()}
              </div>
              <div className="tel-sub">Credit: ${totalIncomes.toLocaleString()} | Debit: ${totalExpenses.toLocaleString()}</div>
            </div>
            <div className="glass-card tel-card conn">
              <div className="tel-header">
                <span>Workspace Tasks</span>
                <Layers size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="tel-value">{tasks.length} Cards</div>
              <div className="tel-sub">Todo: {pendingTasks} | Active: {inProgressTasks} | Done: {completedTasks}</div>
            </div>
          </>
        )
      case 'hr':
        return (
          <>
            <div className="glass-card tel-card cpu">
              <div className="tel-header">
                <span>Payroll Overhead</span>
                <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="tel-value">${totalSalaries.toLocaleString()}</div>
              <div className="tel-sub">Total company payroll logged</div>
            </div>
            <div className="glass-card tel-card mem">
              <div className="tel-header">
                <span>Office Expenditures</span>
                <TrendingUp size={16} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className="tel-value">${totalOfficeExpenses.toLocaleString()}</div>
              <div className="tel-sub">Resources & facilities overhead logs</div>
            </div>
            <div className="glass-card tel-card conn">
              <div className="tel-header">
                <span>Active Staff Directory</span>
                <Users size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="tel-value">{totalStaff} Accounts</div>
              <div className="tel-sub">Regular employee base: {empCount}</div>
            </div>
          </>
        )
      case 'accountant':
        return (
          <>
            <div className="glass-card tel-card cpu">
              <div className="tel-header">
                <span>Gross Income credit</span>
                <DollarSign size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="tel-value">${totalIncomes.toLocaleString()}</div>
              <div className="tel-sub">Total contract milestone payments</div>
            </div>
            <div className="glass-card tel-card mem">
              <div className="tel-header">
                <span>Gross Expenses debit</span>
                <TrendingUp size={16} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div className="tel-value" style={{ color: 'var(--color-danger)' }}>-${totalExpenses.toLocaleString()}</div>
              <div className="tel-sub">Payroll salaries & resources overhead</div>
            </div>
            <div className="glass-card tel-card conn">
              <div className="tel-header">
                <span>Company Margin Profit</span>
                <Award size={16} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className="tel-value" style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ${netProfit.toLocaleString()}
              </div>
              <div className="tel-sub">Profit threshold status: {netProfit >= 0 ? 'Surplus' : 'Deficit'}</div>
            </div>
          </>
        )
      case 'teamleader':
        return (
          <>
            <div className="glass-card tel-card cpu">
              <div className="tel-header">
                <span>Team Board Progress</span>
                <Layers size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="tel-value">{tasks.length} Cards</div>
              <div className="tel-sub">Total group tasks overseen</div>
            </div>
            <div className="glass-card tel-card mem">
              <div className="tel-header">
                <span>Task Board Completions</span>
                <CheckSquare size={16} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className="tel-value">{completedTasks} Done</div>
              <div className="tel-sub">Completed task threshold ratio</div>
            </div>
            <div className="glass-card tel-card conn">
              <div className="tel-header">
                <span>Active Backlogs</span>
                <Activity size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="tel-value">{pendingTasks + inProgressTasks} Active</div>
              <div className="tel-sub">To do: {pendingTasks} | In progress: {inProgressTasks}</div>
            </div>
          </>
        )
      default: // employee
        return (
          <>
            <div className="glass-card tel-card cpu">
              <div className="tel-header">
                <span>Assigned Tasks</span>
                <Layers size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="tel-value">{myAssignedTasks.length} Cards</div>
              <div className="tel-sub">Tasks explicitly designated to you</div>
            </div>
            <div className="glass-card tel-card mem">
              <div className="tel-header">
                <span>Personal Completions</span>
                <CheckSquare size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="tel-value" style={{ color: 'var(--color-success)' }}>{myCompletedTasks} Done</div>
              <div className="tel-sub">Tasks successfully finished by you</div>
            </div>
            <div className="glass-card tel-card conn">
              <div className="tel-header">
                <span>Pending Overheads</span>
                <Activity size={16} style={{ color: 'var(--color-warning)' }} />
              </div>
              <div className="tel-value" style={{ color: 'var(--color-warning)' }}>{myPendingTasks} Active</div>
              <div className="tel-sub">In progress or to-do tasks remaining</div>
            </div>
          </>
        )
    }
  }

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Executive/Role Summary Grid */}
      <h3 style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '-8px' }}>
        Designation Summary: {(user?.role || 'employee').toUpperCase()} View
      </h3>
      <section className="telemetry-grid">
        {renderRoleSummaryCards()}
        
        {/* Host uptime telemetry (shared across all dashboards) */}
        <div className="glass-card tel-card uptime">
          <div className="tel-header">
            <span>Active Server Uptime</span>
            <Clock size={16} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="tel-value" style={{ fontSize: '20px', padding: '6px 0' }}>
            {formatUptime(telemetry.uptime)}
          </div>
          <div className="tel-sub">Host Node process running time</div>
        </div>
      </section>

      {/* Telemetry charts & Online User grid */}
      <div className="dashboard-content-layout">
        {/* Left Side: Server Graphs */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyBetween: 'true' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
              <Server size={18} style={{ color: 'var(--color-primary-light)' }} />
              Live Host Metrics Telemetry
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Real-time monitoring of Node CPU thread loads and server system RAM.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
            {/* CPU Chart */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>CPU Load Profile</span>
                <span style={{ color: 'var(--text-muted)' }}>Live: {telemetry.cpu}%</span>
              </div>
              <div className="chart-wrapper" style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                <svg viewBox="0 0 500 140" className="svg-chart">
                  <line x1="0" y1="35" x2="500" y2="35" className="chart-grid-line" />
                  <line x1="0" y1="70" x2="500" y2="70" className="chart-grid-line" />
                  <line x1="0" y1="105" x2="500" y2="105" className="chart-grid-line" />
                  <path d={getAreaPath(cpuHistory)} className="chart-area" fill="var(--color-primary)" />
                  <path d={getSvgPath(cpuHistory)} className="chart-line cpu" />
                </svg>
              </div>
            </div>

            {/* RAM Chart */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>Memory Load Profile</span>
                <span style={{ color: 'var(--text-muted)' }}>Live: {telemetry.memory}%</span>
              </div>
              <div className="chart-wrapper" style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                <svg viewBox="0 0 500 140" className="svg-chart">
                  <line x1="0" y1="35" x2="500" y2="35" className="chart-grid-line" />
                  <line x1="0" y1="70" x2="500" y2="70" className="chart-grid-line" />
                  <line x1="0" y1="105" x2="500" y2="105" className="chart-grid-line" />
                  <path d={getAreaPath(memHistory)} className="chart-area" fill="var(--color-secondary)" />
                  <path d={getSvgPath(memHistory)} className="chart-line memory" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Active Workspace Users */}
        <div className="glass-card presence-panel">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
              <Users size={18} style={{ color: 'var(--color-success)' }} />
              Workspace Members ({telemetry.activeConnections || 0})
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Currently active socket sessions.
            </p>
          </div>

          <div className="presence-list">
            {onlineUsers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Connecting to socket presence...
              </p>
            ) : (
              onlineUsers.map((member) => (
                <div key={member.socketId} className="presence-user">
                  <div className="presence-user-left">
                    <div className="presence-dot"></div>
                    <div>
                      <div className="presence-name">{member.name}</div>
                      <div className="presence-email">
                        {member.designation || (member.role ? member.role.toUpperCase() : 'STAFF')}
                      </div>
                    </div>
                  </div>
                  <div className="presence-time">
                    {member.socketId.substring(0, 4)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Employee Interactive Tasks Checklist */}
      {user && ['employee', 'teamleader', 'admin'].includes(user.role) && (
        <section className="glass-card slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
              <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
              My Assigned Work Checklist
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Review active tasks designated to you and mark them off when complete.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.filter(t => t.assignedTo && (t.assignedTo._id === (user._id || user.id) || t.assignedTo === (user._id || user.id)) && t.status !== 'done').length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '8px', textAlign: 'center' }}>
                🎉 No pending tasks assigned to you. All caught up!
              </p>
            ) : (
              tasks
                .filter(t => t.assignedTo && (t.assignedTo._id === (user._id || user.id) || t.assignedTo === (user._id || user.id)) && t.status !== 'done')
                .map((t) => (
                  <div
                    key={t._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    className="presence-user-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        onChange={() => handleToggleTaskComplete(t)}
                        title="Mark Complete"
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{t.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.description || 'No description.'} {t.project ? `| Project: ${t.project.name}` : ''}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {t.category}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background:
                            t.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' :
                            t.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' :
                            'rgba(6, 182, 212, 0.15)',
                          color:
                            t.priority === 'high' ? 'var(--color-danger)' :
                            t.priority === 'medium' ? 'var(--color-warning)' :
                            'var(--color-secondary)'
                        }}
                      >
                        {t.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      )}

      {/* Activity logs & system actions feed */}
      <section className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
            <Activity size={18} style={{ color: 'var(--color-warning)' }} />
            Live System Activity Audit Log
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            WebSocket server message traffic and event frames streaming in real-time.
          </p>
        </div>

        <div className="activity-stream">
          {activityLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>
              Waiting for activity logs...
            </p>
          ) : (
            [...activityLogs].reverse().map((log) => (
              <div key={log.id} className={`activity-item ${log.type}`}>
                <div className="activity-meta">
                  <span style={{ fontWeight: 700 }}>
                    [{log.type.toUpperCase()}] By: {log.user}
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                <div className="activity-msg">{log.message}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
