import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Users, ShieldAlert, CheckCircle, Loader, UserPlus, Pencil, X, Save } from 'lucide-react'
import { api } from '../services/api'

function AdminDirectory() {
  const { user } = useContext(AuthContext)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // Creation Form State
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('employee')
  const [formSalary, setFormSalary] = useState('0')
  const [formDesignation, setFormDesignation] = useState('Developer')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [formIsError, setFormIsError] = useState(false)

  // Inline edit buffers (keyed by employee ID)
  const [salaries, setSalaries] = useState({})
  const [designations, setDesignations] = useState({})
  const [names, setNames] = useState({})
  const [emails, setEmails] = useState({})

  // Which employee row is in "edit info" mode
  const [editingInfoId, setEditingInfoId] = useState(null)

  useEffect(() => { fetchEmployees() }, [])

  const fetchEmployees = async () => {
    try {
      const data = await api.get('/auth/users')
      setEmployees(data)
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showMsg = (msg, isErr = false) => {
    setMessage(msg)
    setIsError(isErr)
    setTimeout(() => setMessage(''), 4000)
  }

  // Save role / salary / designation changes
  const handlePromotion = async (employeeId, newRole, newSalary, newDesignation) => {
    setUpdatingId(employeeId)
    try {
      const data = await api.put(`/auth/users/${employeeId}/role`, {
        role: newRole,
        salary: Number(newSalary),
        designation: newDesignation
      })
      setEmployees(prev => prev.map(e => e._id === employeeId ? data : e))
      showMsg(`Updated ${data.name} — ${data.designation} | Salary: $${data.salary.toLocaleString()}`)
    } catch (err) {
      showMsg(err.message, true)
    } finally {
      setUpdatingId(null)
    }
  }

  // Save name / email changes
  const handleInfoUpdate = async (employeeId) => {
    const newName = names[employeeId]
    const newEmail = emails[employeeId]
    if (!newName?.trim() && !newEmail?.trim()) {
      setEditingInfoId(null)
      return
    }
    setUpdatingId(employeeId)
    try {
      const data = await api.put(`/auth/users/${employeeId}/info`, {
        name: newName,
        email: newEmail
      })
      setEmployees(prev => prev.map(e => e._id === employeeId ? data : e))
      setNames(prev => { const n = { ...prev }; delete n[employeeId]; return n })
      setEmails(prev => { const n = { ...prev }; delete n[employeeId]; return n })
      setEditingInfoId(null)
      showMsg(`Profile updated: ${data.name} (${data.email})`)
    } catch (err) {
      showMsg(err.message, true)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!formName || !formEmail || !formPassword || !formRole) {
      setFormIsError(true)
      setFormMessage('All fields are required')
      return
    }
    setFormSubmitting(true)
    setFormMessage('')
    setFormIsError(false)
    try {
      const data = await api.post('/auth/create-user', {
        name: formName, email: formEmail, password: formPassword,
        role: formRole, salary: Number(formSalary), designation: formDesignation
      })
      setEmployees(prev => [...prev, data])
      setFormMessage(`Registered ${data.name} as ${data.designation} (${data.role.toUpperCase()})`)
      setFormName(''); setFormEmail(''); setFormPassword('')
      setFormRole('employee'); setFormSalary('0'); setFormDesignation('Developer')
    } catch (err) {
      setFormIsError(true)
      setFormMessage(err.message || 'Failed to create user profile')
    } finally {
      setFormSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
    </div>
  )

  const isAdminUser = user?.role === 'admin'
  const isHrUser = user?.role === 'hr'

  return (
    <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', alignItems: 'start' }}>

      {/* ── Create Staff Account ── */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <UserPlus size={20} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Register New Staff Account</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Initialize a new profile with system credentials.</p>
          </div>
        </div>

        {formMessage && (
          <div className={`metric-badge ${formIsError ? 'error' : 'success'}`}
            style={{ padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {formIsError ? <ShieldAlert size={16} /> : <CheckCircle size={16} />}
            <span>{formMessage}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Full Name', type: 'text', val: formName, set: setFormName, ph: 'e.g. John Doe' },
            { label: 'Email Address', type: 'email', val: formEmail, set: setFormEmail, ph: 'you@company.com' },
            { label: 'Temporary Password', type: 'password', val: formPassword, set: setFormPassword, ph: '••••••••' },
            { label: 'Starting Annual Salary ($)', type: 'number', val: formSalary, set: setFormSalary, ph: '60000', min: '0' }
          ].map(f => (
            <div className="form-group" key={f.label}>
              <label className="form-label">{f.label}</label>
              <input type={f.type} className="form-input" placeholder={f.ph}
                value={f.val} onChange={e => f.set(e.target.value)}
                style={{ width: '100%' }} min={f.min} required />
            </div>
          ))}

          <div className="form-group">
            <label className="form-label">Access Role</label>
            <select className="api-select" style={{ width: '100%' }} value={formRole}
              onChange={e => setFormRole(e.target.value)} required>
              <option value="employee">Employee / Project Staff</option>
              <option value="teamleader">Team Leader</option>
              <option value="accountant">Accountant</option>
              <option value="hr">HR Staff</option>
              {isAdminUser && <option value="admin">System Administrator</option>}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Job Designation / Post</label>
            <select className="api-select" style={{ width: '100%' }} value={formDesignation}
              onChange={e => setFormDesignation(e.target.value)} required>
              {['Developer','Senior Developer','Junior Developer','UI/UX Designer',
                'QA Tester','DevOps Engineer','Project Manager','System Architect',
                'HR Specialist','Company Accountant'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary" disabled={formSubmitting}>
            {formSubmitting ? <Loader size={18} style={{ animation: 'spin 1.5s linear infinite' }} /> : 'Create Account'}
          </button>
        </form>
      </div>

      {/* ── Employee Directory Table ── */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <Users size={20} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Corporate Employee Directory</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Click <Pencil size={11} style={{ display: 'inline', marginInline: '2px' }} /> to edit name/email inline. Tab through fields to update salary &amp; designation.
            </p>
          </div>
        </div>

        {message && (
          <div className={`metric-badge ${isError ? 'error' : 'success'}`}
            style={{ padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isError ? <ShieldAlert size={16} /> : <CheckCircle size={16} />}
            <span>{message}</span>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 8px' }}>Name</th>
                <th style={{ padding: '10px 8px' }}>Email</th>
                <th style={{ padding: '10px 8px' }}>Designation</th>
                <th style={{ padding: '10px 8px' }}>Role</th>
                <th style={{ padding: '10px 8px' }}>Salary ($)</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Change Role</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const currentSalary   = salaries[emp._id]     !== undefined ? salaries[emp._id]     : (emp.salary || 0)
                const currentDesg     = designations[emp._id] !== undefined ? designations[emp._id] : (emp.designation || 'Developer')
                const currentName     = names[emp._id]        !== undefined ? names[emp._id]        : emp.name
                const currentEmail    = emails[emp._id]       !== undefined ? emails[emp._id]       : emp.email
                const isSelf          = emp._id === (user._id || user.id)
                const isAdminTarget   = emp.role === 'admin'
                const locked          = isSelf || (isHrUser && isAdminTarget)
                const infoEditing     = editingInfoId === emp._id

                return (
                  <tr key={emp._id}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', transition: 'background 0.15s' }}
                    className="presence-user-row">

                    {/* Name */}
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-main)', minWidth: '130px' }}>
                      {infoEditing && !locked ? (
                        <input type="text" className="form-input"
                          style={{ width: '120px', padding: '4px 6px', fontSize: '12px' }}
                          value={currentName}
                          onChange={e => setNames({ ...names, [emp._id]: e.target.value })} />
                      ) : (
                        <span>
                          {emp.name}
                          {isSelf && (
                            <span style={{ fontSize: '9px', color: 'var(--color-primary-light)',
                              background: 'rgba(139,92,246,0.12)', padding: '1px 5px',
                              borderRadius: '4px', marginLeft: '6px' }}>You</span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px', minWidth: '160px' }}>
                      {infoEditing && !locked ? (
                        <input type="email" className="form-input"
                          style={{ width: '150px', padding: '4px 6px', fontSize: '12px' }}
                          value={currentEmail}
                          onChange={e => setEmails({ ...emails, [emp._id]: e.target.value })} />
                      ) : emp.email}
                    </td>

                    {/* Designation */}
                    <td style={{ padding: '12px 8px' }}>
                      <input type="text" className="form-input"
                        style={{ width: '130px', padding: '4px 6px', fontSize: '12px' }}
                        value={currentDesg}
                        onChange={e => setDesignations({ ...designations, [emp._id]: e.target.value })}
                        onBlur={() => {
                          if (currentDesg !== (emp.designation || 'Developer'))
                            handlePromotion(emp._id, emp.role, currentSalary, currentDesg)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && currentDesg !== (emp.designation || 'Developer'))
                            handlePromotion(emp._id, emp.role, currentSalary, currentDesg)
                        }}
                        disabled={locked}
                        title="Edit designation — press Enter or click away to save"
                      />
                    </td>

                    {/* System Role Badge */}
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '30px',
                        background: emp.role === 'admin' ? 'rgba(239,68,68,0.12)' :
                          emp.role === 'hr' ? 'rgba(16,185,129,0.12)' :
                          emp.role === 'accountant' ? 'rgba(6,182,212,0.12)' :
                          emp.role === 'teamleader' ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.05)',
                        color: emp.role === 'admin' ? 'var(--color-danger)' :
                          emp.role === 'hr' ? 'var(--color-success)' :
                          emp.role === 'accountant' ? 'var(--color-secondary)' :
                          emp.role === 'teamleader' ? 'var(--color-warning)' : 'var(--text-muted)',
                        border: '1px solid currentColor'
                      }}>{emp.role.toUpperCase()}</span>
                    </td>

                    {/* Salary */}
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>$</span>
                        <input type="number" className="form-input"
                          style={{ width: '80px', padding: '4px 6px', fontSize: '12px' }}
                          value={currentSalary}
                          onChange={e => setSalaries({ ...salaries, [emp._id]: e.target.value })}
                          onBlur={() => {
                            if (Number(currentSalary) !== (emp.salary || 0))
                              handlePromotion(emp._id, emp.role, currentSalary, currentDesg)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && Number(currentSalary) !== (emp.salary || 0))
                              handlePromotion(emp._id, emp.role, currentSalary, currentDesg)
                          }}
                          disabled={locked}
                          title="Edit salary — press Enter or click away to save"
                        />
                      </div>
                    </td>

                    {/* Change Access Role */}
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {updatingId === emp._id ? (
                        <Loader size={13} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
                      ) : (
                        <select className="api-select"
                          style={{ padding: '4px 6px', fontSize: '11px', width: 'auto' }}
                          value={emp.role}
                          onChange={e => handlePromotion(emp._id, e.target.value, currentSalary, currentDesg)}
                          disabled={locked}>
                          <option value="employee">Employee</option>
                          <option value="teamleader">Team Leader</option>
                          <option value="accountant">Accountant</option>
                          <option value="hr">HR Staff</option>
                          {isAdminUser && <option value="admin">Admin</option>}
                        </select>
                      )}
                    </td>

                    {/* Edit Info toggle */}
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {!locked && (
                        infoEditing ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleInfoUpdate(emp._id)}
                              style={{ background: 'var(--color-success)', border: 'none', borderRadius: '6px',
                                color: 'white', cursor: 'pointer', padding: '4px 8px', fontSize: '11px',
                                display: 'flex', alignItems: 'center', gap: '3px' }}
                              title="Save name & email">
                              <Save size={12} /> Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingInfoId(null)
                                setNames(prev => { const n={...prev}; delete n[emp._id]; return n })
                                setEmails(prev => { const n={...prev}; delete n[emp._id]; return n })
                              }}
                              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '6px', color: 'var(--color-danger)', cursor: 'pointer',
                                padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                              title="Cancel">
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingInfoId(emp._id)
                              setNames(prev => ({ ...prev, [emp._id]: emp.name }))
                              setEmails(prev => ({ ...prev, [emp._id]: emp.email }))
                            }}
                            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                              borderRadius: '6px', color: 'var(--color-primary-light)', cursor: 'pointer',
                              padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Edit name & email">
                            <Pencil size={12} /> Edit
                          </button>
                        )
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminDirectory
