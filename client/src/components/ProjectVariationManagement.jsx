import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import './LeadManagement.css'
import logo from '../assets/logo/WBES_Logo.png'

function ProjectVariationManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [variations, setVariations] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('createdAt_desc')
  const [editModal, setEditModal] = useState({ open: false, variation: null, form: null, mode: 'edit' })
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, variation: null })
  const [approvalsView, setApprovalsView] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, variation: null, action: null, note: '' })
  const [sendApprovalConfirmModal, setSendApprovalConfirmModal] = useState({ open: false, variation: null })
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('variationViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const defaultCompany = useMemo(() => ({
    logo,
    name: 'WBES',
    address: 'Dubai, UAE',
    phone: '+971-00-000-0000',
    email: 'info@wbes.example'
  }), [])

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user')) || null)
    void fetchVariations()
    void fetchProjects()
  }, [])

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('variationViewMode', viewMode)
  }, [viewMode])

  // Adjust itemsPerPage when switching views to ensure grid-friendly values for card view
  useEffect(() => {
    if (viewMode === 'card' && ![6, 9, 12, 15, 18, 21, 24].includes(itemsPerPage)) {
      // Find the nearest card-friendly value (multiple of 3)
      const cardValues = [6, 9, 12, 15, 18, 21, 24]
      const nearest = cardValues.reduce((prev, curr) => 
        Math.abs(curr - itemsPerPage) < Math.abs(prev - itemsPerPage) ? curr : prev
      )
      setItemsPerPage(nearest)
    } else if (viewMode === 'table' && ![5, 10, 20, 50].includes(itemsPerPage)) {
      // Find the nearest table-friendly value
      const tableValues = [5, 10, 20, 50]
      const nearest = tableValues.reduce((prev, curr) => 
        Math.abs(curr - itemsPerPage) < Math.abs(prev - itemsPerPage) ? curr : prev
      )
      setItemsPerPage(nearest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]) // Only run when viewMode changes, not when itemsPerPage changes

  const fetchVariations = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await api.get('/api/project-variations')
      setVariations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching variations:', err)
      setVariations([])
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/projects')
      setProjects(Array.isArray(res.data) ? res.data : [])
    } catch {}
  }

  const sendForApproval = async (variation) => {
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/project-variations/${variation._id}/approve`, { status: 'pending' })
      await fetchVariations()
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: e.response?.data?.message || 'We could not send for approval. Please try again.' })
    }
  }

  const approveVariation = async (variation, status, note) => {
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/project-variations/${variation._id}/approve`, { status, note })
      await fetchVariations()
      setApprovalModal({ open: false, variation: null, action: null, note: '' })
      setNotify({ open: true, title: status === 'approved' ? 'Variation Approved' : 'Variation Rejected', message: `The variation has been ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: e.response?.data?.message || 'We could not update approval. Please try again.' })
    }
  }

  // Filter variations
  const filteredVariations = variations.filter(v => {
    // Apply project filter
    if (selectedProjectFilter) {
      const variationProjectId = typeof v.parentProject === 'object' ? v.parentProject?._id : v.parentProject
      if (variationProjectId !== selectedProjectFilter) return false
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (v.offerReference || '').toLowerCase().includes(term) ||
        (v.projectTitle || v.parentProject?.name || '').toLowerCase().includes(term) ||
        (v.lead?.customerName || '').toLowerCase().includes(term) ||
        (v.createdBy?.name || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    return true
  })

  // Sort variations
  const sortedVariations = [...filteredVariations].sort((a, b) => {
    const [key, direction] = sortKey.split('_')
    let aVal, bVal
    
    switch (key) {
      case 'variationNumber':
        aVal = a.variationNumber || 0
        bVal = b.variationNumber || 0
        break
      case 'grandTotal':
        aVal = a.priceSchedule?.grandTotal || 0
        bVal = b.priceSchedule?.grandTotal || 0
        break
      case 'status':
        aVal = a.managementApproval?.status || 'draft'
        bVal = b.managementApproval?.status || 'draft'
        break
      case 'createdAt':
      default:
        aVal = new Date(a.createdAt || 0).getTime()
        bVal = new Date(b.createdAt || 0).getTime()
        break
    }
    
    if (direction === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  // Pagination calculations
  const totalPages = Math.ceil(sortedVariations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedVariations = sortedVariations.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedProjectFilter, sortKey])

  const totalVariations = variations.length
  const displayedVariations = filteredVariations.length

  return (
    <div className="lead-management">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Project Variations</h1>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(search || selectedProjectFilter) ? `${displayedVariations} of ${totalVariations}` : totalVariations} {totalVariations === 1 ? 'Variation' : 'Variations'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="">All Projects</option>
            {projects.map(proj => (
              <option key={proj._id} value={proj._id}>
                {proj.name}
              </option>
            ))}
          </select>
          <input 
            placeholder="Search..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '14px',
              minWidth: '200px'
            }}
          />
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
            <button
              onClick={() => setViewMode('card')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: viewMode === 'card' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'card' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Card
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'table' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="leads-grid">
          {paginatedVariations.map(v => (
            <div key={v._id} className="lead-card">
              <div className="lead-header">
                <h3>Variation #{v.variationNumber}</h3>
                <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : v.managementApproval?.status === 'pending' ? 'blue' : 'draft'}`}>
                  {v.managementApproval?.status || 'draft'}
                </span>
              </div>
              <div className="lead-details">
                <p><strong>Project:</strong> {v.parentProject?.name || 'N/A'}</p>
                <p><strong>Offer Ref:</strong> {v.offerReference || 'N/A'}</p>
                <p><strong>Grand Total:</strong> {(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
                <p><strong>Created By:</strong> {v.createdBy?.name || 'N/A'}</p>
                <p><strong>Created At:</strong> {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="lead-actions">
                <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View Details</button>
                {v.managementApproval?.status === 'pending' ? (
                  <span className="status-badge blue" style={{ marginLeft: '8px' }}>Approval Pending</span>
                ) : (
                  (v.managementApproval?.status !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id)) && (
                    <button className="save-btn" onClick={() => setSendApprovalConfirmModal({ open: true, variation: v })} style={{ marginLeft: '8px' }}>Send for Approval</button>
                  )
                )}
                <button className="link-btn" onClick={() => setApprovalsView(v)} style={{ marginLeft: '8px' }}>View Approvals/Rejections</button>
                {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && v.managementApproval?.status === 'pending' && (
                  <>
                    <button className="approve-btn" onClick={() => setApprovalModal({ open: true, variation: v, action: 'approved', note: '' })} style={{ marginLeft: '8px' }}>Approve</button>
                    <button className="reject-btn" onClick={() => setApprovalModal({ open: true, variation: v, action: 'rejected', note: '' })} style={{ marginLeft: '8px' }}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Variation #</th>
                <th>Project</th>
                <th>Offer Ref</th>
                <th>Status</th>
                <th>Grand Total</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVariations.map(v => (
                <tr key={v._id}>
                  <td data-label="Variation #">{v.variationNumber}</td>
                  <td data-label="Project">{v.parentProject?.name || 'N/A'}</td>
                  <td data-label="Offer Ref">{v.offerReference || 'N/A'}</td>
                  <td data-label="Status">
                    <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : 'draft'}`}>
                      {v.managementApproval?.status || 'pending'}
                    </span>
                  </td>
                  <td data-label="Grand Total">{(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                  <td data-label="Created By">{v.createdBy?.name || 'N/A'}</td>
                  <td data-label="Created At">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View</button>
                      {v.managementApproval?.status === 'pending' ? (
                        <span className="status-badge blue">Approval Pending</span>
                      ) : (
                        (v.managementApproval?.status !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id)) && (
                          <button className="save-btn" onClick={() => setSendApprovalConfirmModal({ open: true, variation: v })}>Send for Approval</button>
                        )
                      )}
                      <button className="link-btn" onClick={() => setApprovalsView(v)}>View Approvals/Rejections</button>
                      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && v.managementApproval?.status === 'pending' && (
                        <>
                          <button className="approve-btn" onClick={() => setApprovalModal({ open: true, variation: v, action: 'approved', note: '' })}>Approve</button>
                          <button className="reject-btn" onClick={() => setApprovalModal({ open: true, variation: v, action: 'rejected', note: '' })}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredVariations.length > 0 && (
        <div className="pagination-container" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '24px',
          padding: '16px',
          background: 'var(--card)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              Items per page:
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const newValue = Number(e.target.value)
                  setItemsPerPage(newValue)
                  setCurrentPage(1)
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--card)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              >
                {viewMode === 'card' ? (
                  <>
                    <option value={6}>6</option>
                    <option value={9}>9</option>
                    <option value={12}>12</option>
                    <option value={15}>15</option>
                    <option value={18}>18</option>
                    <option value={21}>21</option>
                    <option value={24}>24</option>
                  </>
                ) : (
                  <>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </>
                )}
              </select>
            </label>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Showing {startIndex + 1} to {Math.min(endIndex, sortedVariations.length)} of {sortedVariations.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: currentPage === 1 ? 'var(--bg)' : 'var(--card)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              Previous
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: currentPage === pageNum ? 'var(--primary)' : 'var(--card)',
                      color: currentPage === pageNum ? 'white' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: currentPage === pageNum ? 600 : 400
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: currentPage === totalPages ? 'var(--bg)' : 'var(--card)',
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {approvalsView && (
        <div className="modal-overlay history" onClick={() => setApprovalsView(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approvals & Rejections</h2>
              <button onClick={() => setApprovalsView(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {(() => {
                const v = approvalsView
                const rawLogs = Array.isArray(v.managementApproval?.logs) ? v.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
                const cycles = []
                let current = null
                for (const entry of rawLogs) {
                  if (entry.status === 'pending') {
                    if (current) cycles.push(current)
                    current = {
                      requestedAt: entry.at,
                      requestedBy: entry.requestedBy,
                      requestNote: entry.note,
                      decidedAt: null,
                      decidedBy: null,
                      decisionNote: null,
                      decisionStatus: 'pending'
                    }
                  } else if (entry.status === 'approved' || entry.status === 'rejected') {
                    if (!current) {
                      current = { requestedAt: null, requestedBy: null, requestNote: null, decidedAt: null, decidedBy: null, decisionNote: null, decisionStatus: null }
                    }
                    if (!current.decidedAt) {
                      current.decidedAt = entry.at
                      current.decidedBy = entry.decidedBy
                      current.decisionNote = entry.note
                      current.decisionStatus = entry.status
                      cycles.push(current)
                      current = null
                    } else {
                      cycles.push({ requestedAt: null, requestedBy: null, requestNote: null, decidedAt: entry.at, decidedBy: entry.decidedBy, decisionNote: entry.note, decisionStatus: entry.status })
                    }
                  }
                }
                if (current) cycles.push(current)

                if (cycles.length === 0 && (v.managementApproval?.requestedBy || v.managementApproval?.approvedBy)) {
                  cycles.push({
                    requestedAt: v.updatedAt || v.createdAt,
                    requestedBy: v.managementApproval?.requestedBy,
                    requestNote: v.managementApproval?.comments,
                    decidedAt: v.managementApproval?.approvedAt,
                    decidedBy: v.managementApproval?.approvedBy,
                    decisionNote: v.managementApproval?.comments,
                    decisionStatus: v.managementApproval?.status
                  })
                }

                if (cycles.length === 0) return <p>No approval records.</p>

                return (
                  <div>
                    {cycles.map((c, idx) => (
                      <div key={idx} className="edit-item" style={{ marginTop: idx === 0 ? 0 : 12 }}>
                        <div className="edit-header">
                          <span>Approval Cycle {idx + 1} — {c.decisionStatus ? c.decisionStatus.toUpperCase() : 'PENDING'}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<> by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                            {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)}
                          </div>
                          {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                          <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<> by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
                            {c.decidedBy?._id && c.decidedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.decidedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)} {c.decisionStatus && <span style={{ marginLeft: 6, textTransform: 'uppercase' }}>({c.decisionStatus})</span>}
                          </div>
                          {c.decisionNote && <div><strong>Decision note:</strong> {c.decisionNote}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Variation' : 'Reject Variation'}</h2>
              <button onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  if (!approvalModal.variation || !approvalModal.action) return
                  await approveVariation(approvalModal.variation, approvalModal.action, approvalModal.note)
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendApprovalConfirmModal.open && sendApprovalConfirmModal.variation && (
        <div className="modal-overlay" onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send for Approval</h2>
              <button onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to send this variation for management approval?
              </p>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Once sent, the variation will be marked as "Pending Approval" and managers or administrators will be able to review and approve or reject it.
              </p>
              {sendApprovalConfirmModal.variation && (
                <div style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Variation #{sendApprovalConfirmModal.variation.variationNumber}</p>
                  {sendApprovalConfirmModal.variation.projectTitle && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{sendApprovalConfirmModal.variation.projectTitle}</p>
                  )}
                  {sendApprovalConfirmModal.variation.parentProject?.name && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Project: {sendApprovalConfirmModal.variation.parentProject.name}</p>
                  )}
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  if (sendApprovalConfirmModal.variation) {
                    setSendApprovalConfirmModal({ open: false, variation: null })
                    await sendForApproval(sendApprovalConfirmModal.variation)
                  }
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profileUser && (
        <div className="modal-overlay profile" onClick={() => setProfileUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Profile</h2>
              <button onClick={() => setProfileUser(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={profileUser?.name || ''} readOnly />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="text" value={profileUser?.email || ''} readOnly />
              </div>
            </div>
          </div>
        </div>
      )}

      {notify.open && (
        <div className="modal-overlay" onClick={() => setNotify({ open: false, title: '', message: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{notify.title || 'Notice'}</h2>
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

export default ProjectVariationManagement

