import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { SocketContext } from '../context/SocketContext'
import { api } from '../services/api'
import {
  Plus,
  Trash2,
  Paperclip,
  Clock,
  CheckCircle,
  FileText,
  AlertTriangle,
  FolderOpen,
  X,
  Upload,
  Loader,
  User as UserIcon
} from 'lucide-react'

function KanbanBoard() {
  const { token, user } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)

  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulseTasks, setPulseTasks] = useState({}) // taskId -> boolean

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  
  // New Task Form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [category, setCategory] = useState('Feature')
  const [assignedTo, setAssignedTo] = useState('')
  const [formError, setFormError] = useState('')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Fetch tasks and users on mount
  useEffect(() => {
    fetchTasks()
    fetchUsers()
  }, [])

  // Socket updates listener
  useEffect(() => {
    if (!socket) return

    const handleTaskSocketUpdate = (data) => {
      const { action, task } = data
      
      // Verify task belongs to this user or is assigned to them
      const taskCreatorId = task.user && typeof task.user === 'object' ? task.user._id : task.user
      const taskAssigneeId = task.assignedTo && typeof task.assignedTo === 'object' ? task.assignedTo._id : task.assignedTo
      const currentUserId = user._id || user.id
      
      if (taskCreatorId !== currentUserId && taskAssigneeId !== currentUserId) return

      if (action === 'create') {
        setTasks((prev) => {
          // Avoid duplicates
          if (prev.some((t) => t._id === task._id)) return prev
          return [...prev, task]
        })
        // Highlight new task
        triggerPulse(task._id)
      } else if (action === 'update') {
        setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)))
        // Highlight updated task
        triggerPulse(task._id)
        
        // If the updated task is currently selected, update selectedTask view
        setSelectedTask((prev) => {
          if (prev && prev._id === task._id) return task
          return prev
        })
      }
    }

    const handleTaskSocketRemoved = (taskId) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId))
      setSelectedTask((prev) => {
        if (prev && prev._id === taskId) return null
        return prev
      })
    }

    socket.on('task:update', handleTaskSocketUpdate)
    socket.on('task:removed', handleTaskSocketRemoved)

    return () => {
      socket.off('task:update', handleTaskSocketUpdate)
      socket.off('task:removed', handleTaskSocketRemoved)
    }
  }, [socket, user])

  const triggerPulse = (taskId) => {
    setPulseTasks((prev) => ({ ...prev, [taskId]: true }))
    setTimeout(() => {
      setPulseTasks((prev) => ({ ...prev, [taskId]: false }))
    }, 1500)
  }

  const fetchTasks = async () => {
    try {
      const data = await api.get('/tasks')
      setTasks(data)
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const data = await api.get('/auth/users')
      setUsers(data)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  // Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim()) return

    try {
      const newTask = await api.post('/tasks', {
        title,
        description,
        priority,
        category,
        assignedTo: assignedTo || null
      })

      // Update state & notify other connections
      setTasks((prev) => [...prev, newTask])
      if (socket && isConnected) {
        socket.emit('task:create', newTask)
      }

      // Reset Form
      setTitle('')
      setDescription('')
      setPriority('medium')
      setCategory('Feature')
      setAssignedTo('')
      setShowAddModal(false)
    } catch (err) {
      setFormError(err.message)
    }
  }

  // Update Task Status
  const updateTaskStatus = async (taskId, newStatus) => {
    const task = tasks.find((t) => t._id === taskId)
    if (!task || task.status === newStatus) return

    try {
      const updatedTask = await api.put(`/tasks/${taskId}`, { status: newStatus })

      setTasks((prev) => prev.map((t) => (t._id === taskId ? updatedTask : t)))
      triggerPulse(taskId)

      if (socket && isConnected) {
        socket.emit('task:update', updatedTask)
      }
    } catch (err) {
      console.error('Error updating task status:', err)
    }
  }

  // Update Task Assignee
  const handleAssigneeChange = async (taskId, userId) => {
    try {
      const updatedTask = await api.put(`/tasks/${taskId}`, { assignedTo: userId || null })

      setSelectedTask(updatedTask)
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updatedTask : t)))
      triggerPulse(taskId)

      if (socket && isConnected) {
        socket.emit('task:update', updatedTask)
      }
    } catch (err) {
      console.error('Error updating task assignee:', err)
    }
  }

  // Delete Task
  const handleDeleteTask = async (taskItem, e) => {
    if (e) e.stopPropagation()
    const confirmDelete = window.confirm(`Are you sure you want to delete "${taskItem.title}"?`)
    if (!confirmDelete) return

    try {
      await api.delete(`/tasks/${taskItem._id}`)

      setTasks((prev) => prev.filter((t) => t._id !== taskItem._id))
      if (socket && isConnected) {
        socket.emit('task:delete', {
          taskId: taskItem._id,
          title: taskItem.title,
          userName: user.name
        })
      }
      if (selectedTask && selectedTask._id === taskItem._id) {
        setShowDetailModal(false)
        setSelectedTask(null)
      }
    } catch (err) {
      console.error('Delete task failed:', err)
    }
  }

  // File upload change
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedTask) return

    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const updatedTask = await api.upload(`/tasks/${selectedTask._id}/upload`, formData)

      setSelectedTask(updatedTask)
      setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)))
      
      if (socket && isConnected) {
        socket.emit('task:update', updatedTask)
      }
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      updateTaskStatus(taskId, targetStatus)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    )
  }

  // Filter Tasks by column status
  const getTasksByStatus = (status) => tasks.filter((t) => t.status === status)

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          Create New Task
        </button>
      </div>

      {/* Kanban Board columns wrapper */}
      <div className="kanban-container">
        {/* Pending / To-Do Column */}
        <div
          className="kanban-col pending"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'pending')}
        >
          <div className="kanban-col-header">
            <span className="kanban-col-title">
              <Clock size={16} />
              To Do
            </span>
            <span className="col-badge">{getTasksByStatus('pending').length}</span>
          </div>

          <div className="kanban-list">
            {getTasksByStatus('pending').map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isPulsing={pulseTasks[task._id]}
                onClick={() => {
                  setSelectedTask(task)
                  setShowDetailModal(true)
                }}
                onDragStart={(e) => handleDragStart(e, task._id)}
                onDelete={(e) => handleDeleteTask(task, e)}
              />
            ))}
          </div>
        </div>

        {/* In-Progress Column */}
        <div
          className="kanban-col in-progress"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'in-progress')}
        >
          <div className="kanban-col-header">
            <span className="kanban-col-title">
              <FolderOpen size={16} />
              In Progress
            </span>
            <span className="col-badge">{getTasksByStatus('in-progress').length}</span>
          </div>

          <div className="kanban-list">
            {getTasksByStatus('in-progress').map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isPulsing={pulseTasks[task._id]}
                onClick={() => {
                  setSelectedTask(task)
                  setShowDetailModal(true)
                }}
                onDragStart={(e) => handleDragStart(e, task._id)}
                onDelete={(e) => handleDeleteTask(task, e)}
              />
            ))}
          </div>
        </div>

        {/* Done Column */}
        <div
          className="kanban-col done"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'done')}
        >
          <div className="kanban-col-header">
            <span className="kanban-col-title">
              <CheckCircle size={16} />
              Completed
            </span>
            <span className="col-badge">{getTasksByStatus('done').length}</span>
          </div>

          <div className="kanban-list">
            {getTasksByStatus('done').map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isPulsing={pulseTasks[task._id]}
                onClick={() => {
                  setSelectedTask(task)
                  setShowDetailModal(true)
                }}
                onDragStart={(e) => handleDragStart(e, task._id)}
                onDelete={(e) => handleDeleteTask(task, e)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: ADD TASK */}
      {showAddModal && (
        <div className="modal-overlay fade-in">
          <div className="modal-content slide-up">
            <button className="modal-close" onClick={() => setShowAddModal(false)}>
              <X size={18} />
            </button>
            <h3 className="modal-title">Create Workspace Task</h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Design Database Schema"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Task Description</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Details and implementation requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Feature">Feature Dev</option>
                    <option value="Bugfix">Bug Fix</option>
                    <option value="Refactor">Refactoring</option>
                    <option value="Docs">Documentation</option>
                  </select>
                </div>
              </div>

              {/* Assignee Selection dropdown */}
              <div className="form-group">
                <label className="form-label">Assign Task To</label>
                <select
                  className="api-select"
                  style={{ width: '100%' }}
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Unassigned (Open task)</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <button type="submit" className="btn-primary">
                Deploy Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TASK DETAIL & ATTACHMENT UPLOADER */}
      {showDetailModal && selectedTask && (
        <div className="modal-overlay fade-in">
          <div className="modal-content slide-up">
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>
              <X size={18} />
            </button>
            
            <div style={{ marginBottom: '16px' }}>
              <span className={`task-badge priority-${selectedTask.priority}`} style={{ marginRight: '8px' }}>
                {selectedTask.priority.toUpperCase()}
              </span>
              <span className="task-category">{selectedTask.category}</span>
            </div>

            <h3 className="modal-title" style={{ marginBottom: '8px' }}>{selectedTask.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.5', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '16px' }}>
              {selectedTask.description || 'No description provided.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Created By:</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {selectedTask.user && typeof selectedTask.user === 'object' ? selectedTask.user.name : 'Unknown'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Assignee:</span>
                <select
                  className="api-select"
                  style={{ padding: '4px 8px', fontSize: '12px', width: '100%', background: 'rgba(0,0,0,0.2)' }}
                  value={selectedTask.assignedTo ? (selectedTask.assignedTo._id || selectedTask.assignedTo) : ''}
                  onChange={(e) => handleAssigneeChange(selectedTask._id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</span>
              <select
                className="api-select"
                style={{ padding: '6px 12px', width: 'auto', fontSize: '12px' }}
                value={selectedTask.status}
                onChange={(e) => updateTaskStatus(selectedTask._id, e.target.value)}
              >
                <option value="pending">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Completed</option>
              </select>

              <button
                className="btn-logout"
                style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                onClick={() => handleDeleteTask(selectedTask)}
              >
                <Trash2 size={12} />
                Delete Task
              </button>
            </div>

            {/* Task Attachments Suite */}
            <div className="attachments-section">
              <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={14} />
                Task Attachments ({selectedTask.attachments ? selectedTask.attachments.length : 0})
              </h4>
              
              <div className="attachments-list">
                {selectedTask.attachments && selectedTask.attachments.map((file, idx) => (
                  <div key={idx} className="attachment-item">
                    <a
                      href={`https://taskmanager-api-6gbm.onrender.com${file.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-info"
                    >
                      <FileText size={14} style={{ minWidth: '14px' }} />
                      <span className="attachment-name" title={file.originalName}>
                        {file.originalName}
                      </span>
                    </a>
                    <span className="attachment-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>

              {/* Upload Handler */}
              <div className="file-upload-wrapper">
                <label className="file-upload-label">
                  {uploading ? (
                    <>
                      <Loader size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                      Uploading Attachment...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Upload New Attachment
                    </>
                  )}
                  <input
                    type="file"
                    className="file-upload-input"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                {uploadError && <p className="form-error" style={{ marginTop: '4px' }}>{uploadError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sub-Component: TaskCard
function TaskCard({ task, isPulsing, onClick, onDragStart, onDelete }) {
  const getInitials = (userObj) => {
    if (!userObj || !userObj.name) return ''
    return userObj.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  const assigneeName = task.assignedTo && typeof task.assignedTo === 'object' ? task.assignedTo.name : ''
  const assigneeInitials = task.assignedTo ? getInitials(task.assignedTo) : ''

  return (
    <div
      className={`task-card ${isPulsing ? 'pulse-highlight' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task._id)}
      onClick={onClick}
    >
      <div className="task-card-header">
        <h4 className="task-card-title">{task.title}</h4>
      </div>

      <p className="task-card-desc">
        {task.description || 'No description.'}
      </p>

      <div className="task-card-footer">
        <div className="task-meta-left">
          <span className={`task-badge priority-${task.priority}`}>
            {task.priority}
          </span>
          <span className="task-category">{task.category}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Assignee Initials Circle */}
          {assigneeInitials ? (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--gradient-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '9px',
                fontWeight: 800,
                border: '1px solid var(--glass-border)'
              }}
              title={`Assigned to: ${assigneeName}`}
            >
              {assigneeInitials}
            </div>
          ) : (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '9px',
                border: '1px solid var(--glass-border)'
              }}
              title="Unassigned Task"
            >
              <UserIcon size={10} />
            </div>
          )}

          <div className="task-actions">
            {task.attachments && task.attachments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>
                <Paperclip size={11} />
                <span>{task.attachments.length}</span>
              </div>
            )}
            <button className="task-btn delete-btn" onClick={onDelete}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KanbanBoard
