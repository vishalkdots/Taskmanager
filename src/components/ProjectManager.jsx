import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { SocketContext } from '../context/SocketContext'
import { api } from '../services/api'
import {
  Briefcase,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  Loader,
  FolderPlus,
  Trash2,
  Play,
  CheckSquare,
  AlertCircle,
  ShieldAlert,
  Pencil,
  X,
  Save
} from 'lucide-react'

function ProjectManager() {
  const { user } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)

  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  // Selected project for details view
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  // Create Project form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [budget, setBudget] = useState('')
  const [assignedTeam, setAssignedTeam] = useState('')
  
  // Create Task form state (associated to selected project)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskCategory, setTaskCategory] = useState('Feature')
  const [taskAssignedTo, setTaskAssignedTo] = useState('')

  // Message states
  const [projMsg, setProjMsg] = useState('')
  const [projIsError, setProjIsError] = useState(false)
  const [projSubmitting, setProjSubmitting] = useState(false)

  const [taskMsg, setTaskMsg] = useState('')
  const [taskIsError, setTaskIsError] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  // Inline project editing state
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [editProjName, setEditProjName] = useState('')
  const [editProjBudget, setEditProjBudget] = useState('')
  const [editProjClient, setEditProjClient] = useState('')
  const [editProjDesc, setEditProjDesc] = useState('')
  const [editProjAssignedTeam, setEditProjAssignedTeam] = useState('')
  const [savingProjectId, setSavingProjectId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Listen to live task updates from socket
  useEffect(() => {
    if (!socket) return

    const handleTaskChange = () => {
      // Re-fetch tasks and projects to compute correct statuses
      fetchTasksAndProjects()
    }

    socket.on('task:update', handleTaskChange)
    socket.on('task:removed', handleTaskChange)

    return () => {
      socket.off('task:update', handleTaskChange)
      socket.off('task:removed', handleTaskChange)
    }
  }, [socket])

  const fetchData = async () => {
    try {
      const projData = await api.get('/projects')
      const teamData = await api.get('/teams')
      const taskData = await api.get('/tasks')
      setProjects(projData)
      setTeams(teamData)
      setTasks(taskData)
    } catch (err) {
      console.error('Error fetching project dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTasksAndProjects = async () => {
    try {
      const projData = await api.get('/projects')
      const taskData = await api.get('/tasks')
      setProjects(projData)
      setTasks(taskData)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setProjSubmitting(true)
    setProjMsg('')
    setProjIsError(false)

    try {
      const data = await api.post('/projects', {
        name,
        description,
        client,
        budget: budget ? Number(budget) : 0,
        assignedTeam: assignedTeam || null
      })

      setProjects((prev) => [data, ...prev])
      setProjMsg(`Project "${data.name}" created successfully!`)
      setName('')
      setDescription('')
      setClient('')
      setBudget('')
      setAssignedTeam('')
    } catch (err) {
      setProjIsError(true)
      setProjMsg(err.message || 'Failed to create project')
    } finally {
      setProjSubmitting(false)
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? Tasks will be disassociated but not deleted.')) return

    try {
      await api.delete(`/projects/${projectId}`)
      setProjects((prev) => prev.filter((p) => p._id !== projectId))
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null)
      }
    } catch (err) {
      alert(err.message || 'Failed to delete project')
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim() || !selectedProjectId) return

    setTaskSubmitting(true)
    setTaskMsg('')
    setTaskIsError(false)

    try {
      const data = await api.post('/tasks', {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        category: taskCategory,
        assignedTo: taskAssignedTo || null,
        project: selectedProjectId
      })

      setTasks((prev) => [...prev, data])
      setTaskMsg(`Task delegated successfully!`)
      setTaskTitle('')
      setTaskDesc('')
      setTaskPriority('medium')
      setTaskCategory('Feature')
      setTaskAssignedTo('')

      // Broadcast task creation
      if (socket) {
        socket.emit('task:create', data)
      }

      // Re-fetch to compute auto status transitions
      await fetchTasksAndProjects()
    } catch (err) {
      setTaskIsError(true)
      setTaskMsg(err.message || 'Failed to delegate task')
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleProjectStatusChange = async (projectId, newStatus) => {
    try {
      const data = await api.put(`/projects/${projectId}`, { status: newStatus })
      setProjects((prev) => prev.map((p) => (p._id === projectId ? data : p)))
    } catch (err) {
      alert(err.message || 'Failed to update project status')
    }
  }

  const startEditProject = (proj, e) => {
    e.stopPropagation()
    setEditingProjectId(proj._id)
    setEditProjName(proj.name)
    setEditProjBudget(proj.budget ?? 0)
    setEditProjClient(proj.client || '')
    setEditProjDesc(proj.description || '')
    setEditProjAssignedTeam(proj.assignedTeam?._id || proj.assignedTeam || '')
  }

  const handleSaveProjectEdit = async (projectId, e) => {
    e.stopPropagation()
    if (!editProjName.trim()) return
    setSavingProjectId(projectId)
    try {
      const data = await api.put(`/projects/${projectId}`, {
        name: editProjName.trim(),
        budget: Number(editProjBudget) || 0,
        client: editProjClient.trim(),
        description: editProjDesc.trim(),
        assignedTeam: editProjAssignedTeam || null
      })
      setProjects(prev => prev.map(p => p._id === projectId ? data : p))
      setEditingProjectId(null)
      if (selectedProjectId === projectId) {
        // keep selected in sync
      }
    } catch (err) {
      alert(err.message || 'Failed to update project')
    } finally {
      setSavingProjectId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    )
  }

  const selectedProject = projects.find((p) => p._id === selectedProjectId)
  const projectTasks = selectedProjectId ? tasks.filter((t) => t.project && t.project._id === selectedProjectId) : []
  
  // Calculate completed stats
  const completedTasksCount = projectTasks.filter((t) => t.status === 'done').length
  const totalTasksCount = projectTasks.length
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0

  // Find team members for selected project assignment
  const eligibleAssignees = selectedProject?.assignedTeam?.members || []

  // Check role eligibility
  const isManager = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'teamleader'

  return (
    <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: isManager ? '1fr 2fr' : '1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* LEFT COLUMN: Project Creation (Admins & TLs only) */}
      {isManager && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <FolderPlus size={20} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Initialize Corporate Project</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Setup milestones, assign budget and teams.</p>
            </div>
          </div>

          {projMsg && (
            <div className={`metric-badge ${projIsError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {projIsError ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
              <span style={{ fontSize: '12px' }}>{projMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Phoenix E-Commerce App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Corp Inc."
                value={client}
                onChange={(e) => setClient(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Budget Allocation (USD)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 25000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  style={{ width: '100%' }}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign Team</label>
                <select
                  className="api-select"
                  style={{ width: '100%' }}
                  value={assignedTeam}
                  onChange={(e) => setAssignedTeam(e.target.value)}
                >
                  <option value="">Select Team...</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} ({t.leader?.name || 'No Leader'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project Description</label>
              <textarea
                className="form-input"
                placeholder="Details on requirements and objectives..."
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={projSubmitting}>
              {projSubmitting ? (
                <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : (
                'Create Project'
              )}
            </button>
          </form>
        </div>
      )}

      {/* RIGHT COLUMN: Projects Directory & Progress Monitoring */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Project Lists Grid */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Corporate Portfolio</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Select a project to review details, tasks, and progress indicators.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                No active projects initialized.
              </p>
            ) : (
              projects.map((proj) => {
                const projTasksList = tasks.filter((t) => t.project && t.project._id === proj._id)
                const doneCount = projTasksList.filter((t) => t.status === 'done').length
                const totalCount = projTasksList.length
                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
                const isEditing = editingProjectId === proj._id
                const isSaving = savingProjectId === proj._id

                return (
                  <div
                    key={proj._id}
                    onClick={() => !isEditing && setSelectedProjectId(proj._id)}
                    style={{
                      border: selectedProjectId === proj._id ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                      padding: '16px',
                      borderRadius: '12px',
                      cursor: isEditing ? 'default' : 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                      transition: 'transform 0.2s, border 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                    className="presence-user-row"
                  >
                    {/* Project Name + Status + Edit toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: 700 }}
                          value={editProjName}
                          onChange={e => setEditProjName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '14px', flex: 1 }}>{proj.name}</span>
                      )}
                      <span
                        style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', flexShrink: 0,
                          background: proj.status === 'completed' ? 'rgba(16,185,129,0.15)' :
                            proj.status === 'in-progress' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                          color: proj.status === 'completed' ? 'var(--color-success)' :
                            proj.status === 'in-progress' ? 'var(--color-warning)' : 'var(--text-muted)',
                          border: '1px solid currentColor'
                        }}
                      >
                        {proj.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Budget / Client / Description — editable */}
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>BUDGET ($)</label>
                            <input type="number" className="form-input"
                              style={{ width: '100%', padding: '4px 8px', fontSize: '12px' }}
                              value={editProjBudget}
                              onChange={e => setEditProjBudget(e.target.value)} min="0" />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>CLIENT</label>
                            <input type="text" className="form-input"
                              style={{ width: '100%', padding: '4px 8px', fontSize: '12px' }}
                              value={editProjClient}
                              onChange={e => setEditProjClient(e.target.value)}
                              placeholder="Client name" />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>DESCRIPTION</label>
                          <textarea className="form-input"
                            style={{ width: '100%', padding: '4px 8px', fontSize: '12px', resize: 'vertical', minHeight: '48px' }}
                            value={editProjDesc}
                            onChange={e => setEditProjDesc(e.target.value)}
                            placeholder="Project objectives..." />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>ASSIGN TEAM</label>
                          <select className="api-select"
                            style={{ width: '100%', padding: '4px 8px', fontSize: '12px' }}
                            value={editProjAssignedTeam}
                            onChange={e => setEditProjAssignedTeam(e.target.value)}>
                            <option value="">No Team Assigned</option>
                            {teams.map(t => (
                              <option key={t._id} value={t._id}>
                                {t.name} {t.leader?.name ? `(Led by ${t.leader.name})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => handleSaveProjectEdit(proj._id, e)}
                            disabled={isSaving}
                            style={{ flex: 1, background: 'var(--color-success)', border: 'none', borderRadius: '6px',
                              color: 'white', cursor: 'pointer', padding: '6px', fontSize: '12px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {isSaving ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <><Save size={12} /> Save Changes</>}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingProjectId(null) }}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                              borderRadius: '6px', color: 'var(--color-danger)', cursor: 'pointer',
                              padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Budget: ${proj.budget.toLocaleString()}</span>
                          <span>Client: {proj.client || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>Team: {proj.assignedTeam ? proj.assignedTeam.name : 'Unassigned'}</span>
                          <span>Owner: {proj.createdBy?.name || 'System'}</span>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {!isEditing && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>Progress</span>
                          <span>{pct}% ({doneCount}/{totalCount} tasks)</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%', width: `${pct}%`,
                              background: pct === 100 ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                              borderRadius: '3px', transition: 'width 0.4s'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isEditing && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {isManager && (
                          <button
                            onClick={(e) => startEditProject(proj, e)}
                            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                              borderRadius: '6px', color: 'var(--color-primary-light)', cursor: 'pointer',
                              padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Edit project details">
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj._id) }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)',
                              cursor: 'pointer', padding: '3px 4px', display: 'flex', alignItems: 'center' }}
                            title="Delete Project">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Selected Project Detailed Information, Tasklist & Task delegation */}
        {selectedProject && (
          <div className="glass-card slide-up" style={{ display: 'grid', gridTemplateColumns: isManager ? '1fr 1fr' : '1fr', gap: '24px' }}>
            
            {/* Project Details & Status Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-primary-light)', fontWeight: 800 }}>PROJECT CONTEXT</span>
                <h4 style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)' }}>{selectedProject.name}</h4>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p>{selectedProject.description || 'No description provided.'}</p>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 600 }}>CLIENT</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedProject.client || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: 600 }}>BUDGET</span>
                    <strong style={{ color: 'var(--text-main)' }}>${selectedProject.budget.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {isManager && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Override Project Status</label>
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={selectedProject.status}
                    onChange={(e) => handleProjectStatusChange(selectedProject._id, e.target.value)}
                  >
                    <option value="planning">Planning Mode</option>
                    <option value="in-progress">In-Progress</option>
                    <option value="completed">Completed / Archival</option>
                  </select>
                </div>
              )}

              {/* Tasks List */}
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
                  PROJECT TASKLIST ({completedTasksCount}/{totalTasksCount} done)
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {projectTasks.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '6px' }}>
                      No tasks assigned to this project yet.
                    </p>
                  ) : (
                    projectTasks.map((t) => (
                      <div
                        key={t._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                            {t.title}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            To: {t.assignedTo ? t.assignedTo.name : 'Unassigned'} | Priority: {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: t.status === 'done' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: t.status === 'done' ? 'var(--color-success)' : 'var(--text-muted)'
                          }}
                        >
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Delegate & Assign Work form (Admins & TLs only) */}
            {isManager && (
              <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 800 }}>DELEGATE WORK TASK</span>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>Assign tasks to {selectedProject.assignedTeam ? selectedProject.assignedTeam.name : 'the project team'}</h4>
                </div>

                {taskMsg && (
                  <div className={`metric-badge ${taskIsError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {taskIsError ? <ShieldAlert size={12} /> : <CheckCircle size={12} />}
                    <span style={{ fontSize: '12px' }}>{taskMsg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Task Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Integrate payment gateways"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select
                        className="api-select"
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                      >
                        <option value="Feature">Feature</option>
                        <option value="Bug">Bug Fix</option>
                        <option value="Design">UI Design</option>
                        <option value="Testing">QA Testing</option>
                        <option value="DevOps">Deploy/CI-CD</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="api-select"
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High Priority</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign To Team Member</label>
                    <select
                      className="api-select"
                      style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                      value={taskAssignedTo}
                      onChange={(e) => setTaskAssignedTo(e.target.value)}
                      required
                    >
                      <option value="">Select Member...</option>
                      {eligibleAssignees.map((m) => (
                        <option key={m._id} value={m._id}>{m.name} ({m.designation || m.role.toUpperCase()})</option>
                      ))}
                      {eligibleAssignees.length === 0 && selectedProject.assignedTeam?.leader && (
                        <option value={selectedProject.assignedTeam.leader._id}>
                          {selectedProject.assignedTeam.leader.name} (LEADER)
                        </option>
                      )}
                      {eligibleAssignees.length === 0 && (
                        <option disabled>No team assigned. Set team above first.</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Task Details</label>
                    <textarea
                      className="form-input"
                      placeholder="Objectives and definition of done..."
                      rows="2"
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      style={{ resize: 'vertical', padding: '6px 10px', fontSize: '13px' }}
                    />
                  </div>

                  <button type="submit" className="btn-primary" disabled={taskSubmitting || !selectedProject.assignedTeam}>
                    {taskSubmitting ? (
                      <Loader size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                    ) : (
                      'Delegate Task'
                    )}
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  )
}

export default ProjectManager
