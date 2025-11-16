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
        aVal = a.managementApproval?.status || 'pending'
        bVal = b.managementApproval?.status || 'pending'
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
                <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : 'draft'}`}>
                  {v.managementApproval?.status || 'pending'}
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
                    <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View</button>
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

