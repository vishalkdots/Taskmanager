import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { DollarSign, ShieldAlert, CheckCircle, Plus, Loader, Trash2 } from 'lucide-react'
import { api } from '../services/api'

function HrSalaryManager() {
  const { token, user } = useContext(AuthContext)
  const [employees, setEmployees] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Form fields
  const [category, setCategory] = useState('salary')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  
  // Status message
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Registration Form fields for HR
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('employee') // employee, teamleader, accountant
  const [regSalary, setRegSalary] = useState('0')
  const [regDesignation, setRegDesignation] = useState('Developer')
  const [regSubmitting, setRegSubmitting] = useState(false)
  const [regMessage, setRegMessage] = useState('')
  const [regIsError, setRegIsError] = useState(false)

  useEffect(() => {
    fetchEmployeesAndLogs()
  }, [])

  const fetchEmployeesAndLogs = async () => {
    try {
      const empData = await api.get('/auth/users')
      const logData = await api.get('/financials')
      setEmployees(empData)
      setLogs(logData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePostExpense = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    
    setSubmitting(true)
    setMessage('')
    setIsError(false)

    try {
      const data = await api.post('/financials', {
        type: 'expense',
        category,
        amount: Number(amount),
        description,
        employee: (category === 'salary' || category === 'advance') ? selectedEmployee : null
      })

      setLogs((prev) => [data, ...prev])
      setMessage('Expense log saved successfully!')
      setAmount('')
      setDescription('')
      setSelectedEmployee('')
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterEmployee = async (e) => {
    e.preventDefault()
    if (!regName || !regEmail || !regPassword || !regRole) {
      setRegIsError(true)
      setRegMessage('All fields are required')
      return
    }

    if (regRole === 'admin') {
      setRegIsError(true)
      setRegMessage('HR Staff cannot register System Administrator accounts.')
      return
    }

    setRegSubmitting(true)
    setRegMessage('')
    setRegIsError(false)

    try {
      const data = await api.post('/auth/create-user', {
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        salary: Number(regSalary),
        designation: regDesignation
      })

      setEmployees((prev) => [...prev, data])
      setRegMessage(`Successfully registered employee profile: ${data.name}`)
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setRegRole('employee')
      setRegSalary('0')
      setRegDesignation('Developer')
    } catch (err) {
      setRegIsError(true)
      setRegMessage(err.message || 'Failed to register employee profile')
    } finally {
      setRegSubmitting(false)
    }
  }

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this financial ledger entry?')) return
    try {
      await api.delete(`/financials/${logId}`)
      setLogs((prev) => prev.filter((log) => log._id !== logId))
      setMessage('Ledger entry deleted successfully!')
      setIsError(false)
    } catch (err) {
      setIsError(true)
      setMessage(err.message || 'Failed to delete ledger entry')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Log and Register forms stacked */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Log Form card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <DollarSign size={20} style={{ color: 'var(--color-success)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>HR Expenditure Logger</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Log payroll salaries and office resource expenses.</p>
            </div>
          </div>

          {message && (
            <div className={`metric-badge ${isError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isError ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
              {message}
            </div>
          )}

          <form onSubmit={handlePostExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Expense Category</label>
              <select
                className="api-select"
                style={{ width: '100%' }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="salary">Employee Payroll (Salary)</option>
                <option value="advance">Employee Salary Advance</option>
                <option value="office_expense">Office & Resource Expenditure</option>
              </select>
            </div>

            {(category === 'salary' || category === 'advance') && (
              <div className="form-group">
                <label className="form-label">Recipient Employee</label>
                <select
                  className="api-select"
                  style={{ width: '100%' }}
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  required
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Transaction Amount (USD)</label>
              <input
                type="number"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Log Note / Description</label>
              <textarea
                className="form-input"
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. May 2026 Monthly Salary payout"
                style={{ resize: 'vertical' }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : (
                <>
                  <Plus size={16} />
                  Log Transaction
                </>
              )}
            </button>
          </form>
        </div>

        {/* Register New Employee card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Plus size={20} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Register New Employee Profile</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Create an employee, team leader, or accountant profile.</p>
            </div>
          </div>

          {regMessage && (
            <div className={`metric-badge ${regIsError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {regIsError ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
              {regMessage}
            </div>
          )}

          <form onSubmit={handleRegisterEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jane Smith"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="jane.smith@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Starting Annual Salary ($ USD)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 50000"
                value={regSalary}
                onChange={(e) => setRegSalary(e.target.value)}
                style={{ width: '100%' }}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Staff Role Designation</label>
              <select
                className="api-select"
                style={{ width: '100%' }}
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
                required
              >
                <option value="employee">Employee / Project Staff</option>
                <option value="teamleader">Team Leader</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Job Designation / Post</label>
              <select
                className="api-select"
                style={{ width: '100%' }}
                value={regDesignation}
                onChange={(e) => setRegDesignation(e.target.value)}
                required
              >
                <option value="Developer">Developer</option>
                <option value="Senior Developer">Senior Developer</option>
                <option value="Junior Developer">Junior Developer</option>
                <option value="UI/UX Designer">UI/UX Designer</option>
                <option value="QA Tester">QA Tester</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Project Manager">Project Manager</option>
                <option value="System Architect">System Architect</option>
                <option value="HR Specialist">HR Specialist</option>
                <option value="Company Accountant">Company Accountant</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={regSubmitting}>
              {regSubmitting ? (
                <Loader size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : (
                <>
                  <Plus size={16} />
                  Register Employee
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* Financial History card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Corporate Ledger History</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Recent ledger items logged by HR and accounting.</p>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '820px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No transactions recorded.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {log.category.toUpperCase().replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {log.description}
                  </span>
                  {log.employee && (
                    <span style={{ fontSize: '10px', color: 'var(--color-primary-light)' }}>
                      To: {log.employee.name}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                    <span style={{ fontWeight: 800, color: log.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {log.type === 'income' ? '+' : '-'}${log.amount.toLocaleString()}
                    </span>
                    <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      By: {log.createdBy ? log.createdBy.name : 'System'}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteLog(log._id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                      title="Delete Entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default HrSalaryManager
