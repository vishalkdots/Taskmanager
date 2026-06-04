import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { SocketContext } from '../context/SocketContext'
import {
  Users, Send, CheckCircle, ShieldAlert, Plus, Loader,
  BellRing, Pencil, Trash2, X, Save, UserCheck
} from 'lucide-react'
import { api } from '../services/api'

function TeamBuilder() {
  const { user } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)

  const [teams, setTeams] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [teamName, setTeamName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Notification form
  const [selectedTeamForAlert, setSelectedTeamForAlert] = useState('')
  const [alertText, setAlertText] = useState('')

  // Global status message
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // Inline edit state (per-team)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamMembers, setEditTeamMembers] = useState([])
  const [savingTeamId, setSavingTeamId] = useState(null)
  const [deletingTeamId, setDeletingTeamId] = useState(null)

  useEffect(() => { fetchTeamsAndUsers() }, [])

  const showMsg = (msg, err = false) => {
    setMessage(msg)
    setIsError(err)
    setTimeout(() => setMessage(''), 4000)
  }

  const fetchTeamsAndUsers = async () => {
    try {
      const [teamData, userData] = await Promise.all([
        api.get('/teams'),
        api.get('/auth/users')
      ])
      setTeams(teamData)
      const currentUserId = user._id || user.id
      setEmployees(userData.filter(u => u._id !== currentUserId && u.role !== 'admin'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── Create ──
  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!teamName.trim()) return
    setSubmitting(true)
    try {
      const data = await api.post('/teams', { name: teamName, members: selectedMembers })
      setTeams(prev => [...prev, data])
      showMsg(`Team "${data.name}" established successfully!`)
      setTeamName('')
      setSelectedMembers([])
    } catch (err) {
      showMsg(err.message, true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleMemberToggle = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Edit ──
  const startEditTeam = (team) => {
    setEditingTeamId(team._id)
    setEditTeamName(team.name)
    setEditTeamMembers(team.members.map(m => m._id || m))
  }

  const handleSaveTeam = async (teamId) => {
    if (!editTeamName.trim()) return
    setSavingTeamId(teamId)
    try {
      const data = await api.put(`/teams/${teamId}`, {
        name: editTeamName.trim(),
        members: editTeamMembers
      })
      setTeams(prev => prev.map(t => t._id === teamId ? data : t))
      setEditingTeamId(null)
      showMsg(`Team "${data.name}" updated successfully!`)
    } catch (err) {
      showMsg(err.message, true)
    } finally {
      setSavingTeamId(null)
    }
  }

  // ── Delete ──
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Delete team "${teamName}"? This cannot be undone.`)) return
    setDeletingTeamId(teamId)
    try {
      await api.delete(`/teams/${teamId}`)
      setTeams(prev => prev.filter(t => t._id !== teamId))
      if (selectedTeamForAlert === teamId) setSelectedTeamForAlert('')
      showMsg(`Team "${teamName}" removed.`)
    } catch (err) {
      showMsg(err.message, true)
    } finally {
      setDeletingTeamId(null)
    }
  }

  // ── Broadcast ──
  const handleSendNotification = (e) => {
    e.preventDefault()
    if (!selectedTeamForAlert || !alertText.trim()) return

    if (socket && isConnected) {
      socket.emit('notification:send', {
        teamId: selectedTeamForAlert,
        title: 'Team Announcement',
        message: alertText,
        senderName: user.name
      })
      showMsg('Team notification broadcasted successfully!')
      setAlertText('')
      setSelectedTeamForAlert('')
    } else {
      showMsg('Cannot broadcast: WebSocket disconnected.', true)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
    </div>
  )

  const currentUserId = user._id || user.id
  const canManageAll = user?.role === 'admin' || user?.role === 'hr'

  return (
    <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>

      {/* ── LEFT: Create Team + Member picker ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Users size={20} style={{ color: 'var(--color-primary-light)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Workspace Team Builder</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Assemble workspace teams and assign employees.</p>
            </div>
          </div>

          {message && (
            <div className={`metric-badge ${isError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isError ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
              {message}
            </div>
          )}

          <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Team Name</label>
              <input type="text" className="form-input"
                value={teamName} onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. Frontend Engineering Team" required />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Assign Members</label>
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px',
                maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px',
                background: 'rgba(0,0,0,0.04)' }}>
                {employees.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No employees found.</span>
                ) : employees.map(emp => (
                  <label key={emp._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox"
                      checked={selectedMembers.includes(emp._id)}
                      onChange={() => handleMemberToggle(emp._id, selectedMembers, setSelectedMembers)}
                      style={{ cursor: 'pointer' }} />
                    <span>{emp.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({emp.designation || emp.role.toUpperCase()})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                : <><Plus size={16} /> Establish Team</>}
            </button>
          </form>
        </div>

        {/* ── Broadcast Alert ── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
            <BellRing size={18} style={{ color: 'var(--color-warning)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Team Broadcast Center</h3>
          </div>

          <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Select Target Team</label>
              <select className="api-select" style={{ width: '100%' }}
                value={selectedTeamForAlert} onChange={e => setSelectedTeamForAlert(e.target.value)} required>
                <option value="">Choose Team...</option>
                {(canManageAll
                  ? teams
                  : teams.filter(t => (t.leader?._id || t.leader) === currentUserId)
                ).map(t => (
                  <option key={t._id} value={t._id}>{t.name} (Led by: {t.leader?.name || 'N/A'})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notification Message</label>
              <input type="text" className="form-input"
                value={alertText} onChange={e => setAlertText(e.target.value)}
                placeholder="e.g. Critical Bug Hotfix deployed. Please sync workspace!" required />
            </div>

            <button type="submit" className="btn-primary"
              style={{ background: 'var(--gradient-warning)', boxShadow: '0 0 15px rgba(245,158,11,0.3)' }}>
              <Send size={14} /> Broadcast Alert
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Active Teams with Edit / Delete ── */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Active Workspace Teams</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
            {teams.length} team{teams.length !== 1 ? 's' : ''} registered — click <Pencil size={11} style={{ display: 'inline' }} /> to rename or adjust members.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '680px', overflowY: 'auto' }}>
          {teams.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No established teams yet. Create one to get started.
            </span>
          ) : teams.map(t => {
            const isEditing = editingTeamId === t._id
            const isSaving  = savingTeamId === t._id
            const isDeleting = deletingTeamId === t._id
            const canEdit = canManageAll || (t.leader?._id || t.leader) === currentUserId

            return (
              <div key={t._id}
                style={{ padding: '14px', background: 'rgba(0,0,0,0.03)',
                  border: isEditing ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  borderRadius: '10px', transition: 'border 0.2s', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Team header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isEditing ? (
                    <input type="text" className="form-input"
                      style={{ flex: 1, marginRight: '8px', padding: '4px 8px', fontSize: '13px', fontWeight: 700 }}
                      value={editTeamName}
                      onChange={e => setEditTeamName(e.target.value)}
                      autoFocus />
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <UserCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        Led by {t.leader?.name || 'Unknown'} &nbsp;·&nbsp; {t.members.length} member{t.members.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveTeam(t._id)}
                            disabled={isSaving}
                            style={{ background: 'var(--color-success)', border: 'none', borderRadius: '6px',
                              color: 'white', cursor: 'pointer', padding: '4px 10px', fontSize: '11px',
                              display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {isSaving ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={12} /> Save</>}
                          </button>
                          <button
                            onClick={() => setEditingTeamId(null)}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                              borderRadius: '6px', color: 'var(--color-danger)', cursor: 'pointer',
                              padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <X size={12} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditTeam(t)}
                            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                              borderRadius: '6px', color: 'var(--color-primary-light)', cursor: 'pointer',
                              padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Edit team">
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(t._id, t.name)}
                            disabled={isDeleting}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: '6px', color: 'var(--color-danger)', cursor: 'pointer',
                              padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Delete team">
                            {isDeleting ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={12} /> Remove</>}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Member checklist when editing */}
                {isEditing && (
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      UPDATE MEMBERS
                    </label>
                    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px',
                      maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '7px',
                      background: 'rgba(0,0,0,0.03)' }}>
                      {employees.map(emp => (
                        <label key={emp._id} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                          fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox"
                            checked={editTeamMembers.includes(emp._id)}
                            onChange={() => handleMemberToggle(emp._id, editTeamMembers, setEditTeamMembers)}
                            style={{ cursor: 'pointer' }} />
                          <span>{emp.name} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({emp.designation || emp.role.toUpperCase()})</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members pills (read mode) */}
                {!isEditing && t.members.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {t.members.map(m => (
                      <span key={m._id}
                        style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                          background: 'rgba(139,92,246,0.08)', color: 'var(--color-primary-light)',
                          border: '1px solid rgba(139,92,246,0.2)' }}>
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default TeamBuilder
