import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { DollarSign, ShieldAlert, CheckCircle, Plus, Loader, TrendingUp, Trash2 } from 'lucide-react'
import { api } from '../services/api'

function AccountantLedger() {
  const { token, user } = useContext(AuthContext)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Form fields
  const [type, setType] = useState('income')
  const [category, setCategory] = useState('project_income')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  
  // Status message
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const logData = await api.get('/financials')
      setLogs(logData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePostTransaction = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    
    setSubmitting(true)
    setMessage('')
    setIsError(false)

    try {
      const data = await api.post('/financials', {
        type,
        category,
        amount: Number(amount),
        description
      })

      setLogs((prev) => [data, ...prev])
      setMessage('Transaction logged successfully!')
      setAmount('')
      setDescription('')
    } catch (err) {
      setIsError(true)
      setMessage(err.message)
    } finally {
      setSubmitting(false)
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

  // Calculate telemetry values
  const totalIncome = logs.filter((l) => l.type === 'income').reduce((acc, curr) => acc + curr.amount, 0)
  const totalExpense = logs.filter((l) => l.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0)
  const netProfit = totalIncome - totalExpense

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader className="logo-icon" style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Ledger Overview Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Company Revenue</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--color-success)' }}>
            ${totalIncome.toLocaleString()}
          </h2>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Expenditures</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--color-danger)' }}>
            ${totalExpense.toLocaleString()}
          </h2>
        </div>
        <div className="glass-card" style={{ borderLeft: `4px solid ${netProfit >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)'}` }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Net Profit/Loss</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: netProfit >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
            ${netProfit.toLocaleString()}
          </h2>
        </div>
      </section>

      {/* Inputs and Ledger logs list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Forms Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-secondary)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Project Financial Logger</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Log client payments and project resource overheads.</p>
            </div>
          </div>

          {message && (
            <div className={`metric-badge ${isError ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isError ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
              {message}
            </div>
          )}

          <form onSubmit={handlePostTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Flow Type</label>
                <select
                  className="api-select"
                  style={{ width: '100%' }}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value)
                    setCategory(e.target.value === 'income' ? 'project_income' : 'project_expense')
                  }}
                >
                  <option value="income">Credit (+ Income)</option>
                  <option value="expense">Debit (- Expense)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ledger Category</label>
                {type === 'income' ? (
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="project_income">Project Contract Income</option>
                    <option value="investment">Capital Investment Inflow</option>
                  </select>
                ) : (
                  <select
                    className="api-select"
                    style={{ width: '100%' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="project_expense">Project Resource Overhead</option>
                    <option value="investment">Capital Investment Outflow</option>
                    <option value="advance">Operational Advance Payment</option>
                  </select>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Transaction Value (USD)</label>
              <input
                type="number"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 15000"
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
                placeholder="e.g. Milestone 2 payment for Web App Project"
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
                  Record Flow
                </>
              )}
            </button>
          </form>
        </div>

        {/* Ledger Transaction Log */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Financial Transaction Logs</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Ledger audit trail for cash flows.</p>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No logs on record.</p>
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
                        Payroll: {log.employee.name}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                      <span style={{ fontWeight: 800, color: log.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {log.type === 'income' ? '+' : '-'}${log.amount.toLocaleString()}
                      </span>
                      <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Logged by: {log.createdBy ? log.createdBy.name : 'System'}
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
    </div>
  )
}

export default AccountantLedger
