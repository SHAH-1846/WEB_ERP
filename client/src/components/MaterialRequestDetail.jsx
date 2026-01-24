import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Spinner, ButtonLoader } from './LoadingComponents'

function MaterialRequestDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('id')
  
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [reviewModal, setReviewModal] = useState({ open: false, status: '', notes: '' })
  const [currentUser, setCurrentUser] = useState(null)

  const isAdmin = currentUser?.roles?.includes('admin')
  const isManager = currentUser?.roles?.includes('manager')
  const isInventoryManager = currentUser?.roles?.includes('inventory_manager')
  const canReview = isAdmin || isManager || isInventoryManager
  const canFulfill = isAdmin || isManager || isInventoryManager || currentUser?.roles?.includes('store_keeper')

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      setCurrentUser(userData)
    } catch {
      setCurrentUser(null)
    }
  }, [])

  useEffect(() => {
    if (requestId) {
      fetchRequest()
    }
  }, [requestId])

  const fetchRequest = async () => {
    try {
      const res = await api.get(`/api/material-requests/${requestId}`)
      setRequest(res.data)
    } catch (error) {
      console.error('Error fetching material request:', error)
      setNotify({ open: true, title: 'Error', message: 'Failed to load material request.' })
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    if (!reviewModal.status) {
      setNotify({ open: true, title: 'Error', message: 'Please select a review status.' })
      return
    }

    setSaving(true)
    try {
      await api.patch(`/api/material-requests/${requestId}/review`, {
        status: reviewModal.status,
        reviewNotes: reviewModal.notes
      })
      setNotify({ open: true, title: 'Success', message: 'Request reviewed successfully.' })
      setReviewModal({ open: false, status: '', notes: '' })
      fetchRequest()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to review request.' })
    } finally {
      setSaving(false)
    }
  }

  const handleFulfill = async () => {
    if (!confirm('Mark this request as fulfilled?')) return
    
    setSaving(true)
    try {
      await api.patch(`/api/material-requests/${requestId}/fulfill`, {})
      setNotify({ open: true, title: 'Success', message: 'Request marked as fulfilled.' })
      fetchRequest()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to fulfill request.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this material request?')) return
    
    setSaving(true)
    try {
      await api.patch(`/api/material-requests/${requestId}/cancel`, {})
      setNotify({ open: true, title: 'Success', message: 'Request cancelled.' })
      fetchRequest()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to cancel request.' })
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'rgba(251,191,36,0.1)', color: '#f59e0b' },
      approved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
      partially_approved: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
      fulfilled: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
      cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' }
    }
    const s = styles[status] || styles.pending
    return (
      <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: s.bg, color: s.color }}>
        {status?.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const styles = {
      low: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
      normal: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      high: { bg: 'rgba(251,191,36,0.1)', color: '#f59e0b' },
      urgent: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' }
    }
    const s = styles[priority] || styles.normal
    return (
      <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: s.bg, color: s.color }}>
        {priority?.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading material request...</p>
      </div>
    )
  }

  if (!request) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '48px', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>📭</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '16px' }}>Request Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>The material request you are looking for does not exist or you don't have permission to view it.</p>
          <button className="save-btn" style={{ marginTop: '24px' }} onClick={() => navigate('/material-requests')}>Back to Material Requests</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <button className="link-btn" onClick={() => navigate(-1)} style={{ marginBottom: '8px' }}>← Back</button>
          <h2 style={{ margin: 0, color: 'var(--text)' }}>Material Request {request.requestNumber}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Created on {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {getPriorityBadge(request.priority)}
          {getStatusBadge(request.status)}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {canReview && request.status === 'pending' && (
          <button className="save-btn" onClick={() => setReviewModal({ open: true, status: '', notes: '' })}>Review Request</button>
        )}
        {canFulfill && ['approved', 'partially_approved'].includes(request.status) && (
          <button className="save-btn" style={{ background: '#6366f1' }} onClick={handleFulfill} disabled={saving}>
            <ButtonLoader loading={saving}>Mark as Fulfilled</ButtonLoader>
          </button>
        )}
        {(request.requestedBy?._id === currentUser?.id || isAdmin || isManager) && ['pending', 'approved'].includes(request.status) && (
          <button className="cancel-btn" onClick={handleCancel} disabled={saving}>Cancel Request</button>
        )}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Project & Requester Info */}
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📋 Request Details</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project</label>
            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{request.projectId?.name || 'N/A'}</div>
          </div>

          {request.purpose && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Purpose</label>
              <div style={{ color: 'var(--text)' }}>{request.purpose}</div>
            </div>
          )}

          {request.requiredDate && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Required By</label>
              <div style={{ color: 'var(--text)' }}>{new Date(request.requiredDate).toLocaleDateString()}</div>
            </div>
          )}

          {request.notes && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Additional Notes</label>
              <div style={{ color: 'var(--text)', fontSize: '14px' }}>{request.notes}</div>
            </div>
          )}
        </div>

        {/* Requester Info */}
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>👤 Requester Information</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Name</label>
            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{request.requesterName || request.requestedBy?.name || 'N/A'}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email</label>
            <div style={{ color: 'var(--text)' }}>
              <a href={`mailto:${request.requesterEmail || request.requestedBy?.email}`} style={{ color: 'var(--primary)' }}>
                {request.requesterEmail || request.requestedBy?.email || 'N/A'}
              </a>
            </div>
          </div>

          {request.requesterPhone && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone</label>
              <div style={{ color: 'var(--text)' }}>
                <a href={`tel:${request.requesterPhone}`} style={{ color: 'var(--primary)' }}>{request.requesterPhone}</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Requested Materials */}
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📦 Requested Materials ({request.items?.length || 0})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>#</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>Material Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>SKU</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>Quantity</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>UOM</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {request.items?.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{index + 1}</td>
                  <td style={{ padding: '12px', color: 'var(--text)', fontWeight: '500' }}>{item.materialName}</td>
                  <td style={{ padding: '12px', color: 'var(--primary)', fontSize: '13px' }}>{item.sku || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: 'var(--text)' }}>{item.quantity}</td>
                  <td style={{ padding: '12px', color: 'var(--text)' }}>{item.uom}</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>{item.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow History */}
      {(request.reviewedBy || request.fulfilledBy) && (
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📝 Workflow History</h3>
          
          {request.reviewedBy && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                  {request.status === 'rejected' ? '❌ Rejected' : request.status === 'approved' ? '✅ Approved' : '⚠️ Partially Approved'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(request.reviewedAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                By {request.reviewedBy?.name || 'N/A'}
              </div>
              {request.reviewNotes && (
                <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text)' }}>{request.reviewNotes}</div>
              )}
            </div>
          )}

          {request.fulfilledBy && (
            <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text)' }}>📦 Fulfilled</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(request.fulfilledAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                By {request.fulfilledBy?.name || 'N/A'}
              </div>
              {request.fulfillmentNotes && (
                <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text)' }}>{request.fulfillmentNotes}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.open && (
        <div className="modal-overlay" onClick={() => setReviewModal({ open: false, status: '', notes: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Review Request {request.requestNumber}</h2>
              <button onClick={() => setReviewModal({ open: false, status: '', notes: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Items Requested:</label>
                <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--text)' }}>
                  {request.items?.map((item, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      {item.quantity} {item.uom} - {item.materialName} {item.sku && `(${item.sku})`}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="form-group">
                <label>Decision *</label>
                <select value={reviewModal.status} onChange={e => setReviewModal({ ...reviewModal, status: e.target.value })}>
                  <option value="">-- Select --</option>
                  <option value="approved">Approve</option>
                  <option value="partially_approved">Partially Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              <div className="form-group">
                <label>Review Notes</label>
                <textarea 
                  value={reviewModal.notes} 
                  onChange={e => setReviewModal({ ...reviewModal, notes: e.target.value })}
                  placeholder="Add notes about your decision..."
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setReviewModal({ open: false, status: '', notes: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={handleReview} disabled={saving}>
                  <ButtonLoader loading={saving}>{saving ? 'Submitting...' : 'Submit Review'}</ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notify.open && (
        <div className="modal-overlay" onClick={() => setNotify({ open: false, title: '', message: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{notify.title}</h2>
              <button onClick={() => setNotify({ open: false, title: '', message: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>{notify.message}</p>
              <div className="form-actions">
                <button type="button" className="save-btn" onClick={() => setNotify({ open: false, title: '', message: '' })}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialRequestDetail
