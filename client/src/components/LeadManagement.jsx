import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { CreateQuotationModal } from './CreateQuotationModal'
import './LeadManagement.css'
import './LoadingComponents.css'
import { Spinner, SkeletonCard, SkeletonTableRow, ButtonLoader, PageSkeleton } from './LoadingComponents'

function LeadManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [leads, setLeads] = useState([])
  const [quotationCounts, setQuotationCounts] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [editingLead, setEditingLead] = useState(null)
  const [formData, setFormData] = useState({
    customerName: '',
    projectTitle: '',
    enquiryNumber: '',
    enquiryDate: '',
    scopeSummary: '',
    submissionDueDate: ''
  })
  const [myOnly, setMyOnly] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [historyLead, setHistoryLead] = useState(null)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visitData, setVisitData] = useState({
    visitAt: '',
    siteLocation: '',
    engineerName: '',
    workProgressSummary: '',
    safetyObservations: '',
    qualityMaterialCheck: '',
    issuesFound: '',
    actionItems: '',
    weatherConditions: '',
    description: ''
  })
  const [notify, setNotify] = useState({ open: false, title: '', message: '', onOk: null })
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [selectedLeadForQuotation, setSelectedLeadForQuotation] = useState(null)
  const [showQuotationsListModal, setShowQuotationsListModal] = useState(false)
  const [quotationsForLead, setQuotationsForLead] = useState([])
  const [selectedLeadForList, setSelectedLeadForList] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('leadViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [expandedQuotationRows, setExpandedQuotationRows] = useState({}) // Track which rows have expanded quotations
  const [leadQuotationsMap, setLeadQuotationsMap] = useState({}) // Store quotations per lead ID
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setCurrentUser(userData)
    const loadData = async () => {
      setIsLoading(true)
      await fetchLeads()
      setIsLoading(false)
    }
    void loadData()
  }, [])

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('leadViewMode', viewMode)
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

  const fetchLeads = async () => {
    try {
      const response = await api.get('/api/leads')
      setLeads(response.data)
      
      // Fetch quotations and count per lead
      try {
        const qResponse = await api.get('/api/quotations')
        const allQuotations = Array.isArray(qResponse.data) ? qResponse.data : []
        const counts = {}
        allQuotations.forEach(q => {
          const qLeadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
          if (qLeadId) {
            counts[qLeadId] = (counts[qLeadId] || 0) + 1
          }
        })
        setQuotationCounts(counts)
      } catch (error) {
        console.error('Error fetching quotations:', error)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setLoadingAction(editingLead ? 'update-lead' : 'create-lead')
    setIsSubmitting(true)
    try {
      if (editingLead) {
        await api.put(`/api/leads/${editingLead._id}`, formData)
      } else {
        await api.post('/api/leads', formData)
      }
      await fetchLeads()
      setShowModal(false)
      setFormData({ customerName: '', projectTitle: '', enquiryNumber: '', enquiryDate: '', scopeSummary: '', submissionDueDate: '' })
      setEditingLead(null)
      setNotify({ open: true, title: 'Success', message: editingLead ? 'Lead updated successfully.' : 'Lead created successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not save this lead. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  // Lead approvals removed; handled at Quotation level

  const convertToProject = async (leadId) => {
    if (isSubmitting) return
    setLoadingAction(`convert-${leadId}`)
    setIsSubmitting(true)
    try {
      await api.post(`/api/leads/${leadId}/convert`, {})
      await fetchLeads()
      setNotify({ open: true, title: 'Converted', message: 'Lead converted to project successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Convert Failed', message: error.response?.data?.message || 'We could not convert this lead. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const handleEditLead = (lead) => {
    setEditingLead(lead)
    setFormData({
      customerName: lead.customerName || '',
      projectTitle: lead.projectTitle || '',
      enquiryNumber: lead.enquiryNumber || '',
      enquiryDate: lead.enquiryDate ? lead.enquiryDate.substring(0, 10) : '',
      scopeSummary: lead.scopeSummary || '',
      submissionDueDate: lead.submissionDueDate ? lead.submissionDueDate.substring(0, 10) : ''
    })
    setShowModal(true)
  }

  const handleDeleteLead = async (leadId) => {
    if (!confirm('Delete this lead?')) return
    if (isSubmitting) return
    setLoadingAction(`delete-${leadId}`)
    setIsSubmitting(true)
    try {
      await api.delete(`/api/leads/${leadId}`)
      await fetchLeads()
      setNotify({ open: true, title: 'Deleted', message: 'Lead deleted successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Delete Failed', message: error.response?.data?.message || 'We could not delete this lead. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      submitted: 'blue',
      approved: 'green',
      rejected: 'red',
      converted: 'purple'
    }
    return colors[status] || 'gray'
  }

  const canCreateLead = () => {
    return currentUser?.roles?.some(role => ['supervisor', 'sales_engineer', 'estimation_engineer'].includes(role))
  }

  // Handler for View Quotations in table view (accordion)
  const handleViewQuotationsTable = async (lead) => {
    const leadId = lead._id
    const isExpanded = expandedQuotationRows[leadId]
    
    if (isExpanded) {
      // Collapse: remove from expanded rows
      setExpandedQuotationRows(prev => {
        const next = { ...prev }
        delete next[leadId]
        return next
      })
    } else {
      // Expand: fetch quotations if not already loaded
      if (!leadQuotationsMap[leadId]) {
        try {
          const qRes = await api.get('/api/quotations')
          const allQ = Array.isArray(qRes.data) ? qRes.data : []
          const list = allQ.filter(q => {
            const qLeadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
            return qLeadId === leadId
          })
          setLeadQuotationsMap(prev => ({ ...prev, [leadId]: list }))
        } catch (e) {
          setNotify({ open: true, title: 'Load Failed', message: 'We could not load the quotations. Please try again.' })
          return
        }
      }
      setExpandedQuotationRows(prev => ({ ...prev, [leadId]: true }))
    }
  }

  // Helper function to render lead actions (used in both card and table views)
  const renderLeadActions = (lead, isTableView = false) => (
    <div className="lead-actions">
      {lead.status === 'draft' && (
        <>
          {(currentUser?.roles?.includes('sales_engineer') || currentUser?.roles?.includes('estimation_engineer') || lead.createdBy?._id === currentUser?.id) && (
            <button 
              onClick={() => handleEditLead(lead)} 
              className="save-btn"
              disabled={isSubmitting}
            >
              Edit
            </button>
          )}
          {currentUser?.roles?.includes('project_engineer') && (
            <button onClick={() => { setEditingLead(lead); setShowVisitModal(true); }} className="assign-btn">
              New Site Visit
            </button>
          )}
          {lead.createdBy?._id === currentUser?.id && (
            <button 
              onClick={() => handleDeleteLead(lead._id)} 
              className="cancel-btn"
              disabled={isSubmitting}
            >
              <ButtonLoader loading={loadingAction === `delete-${lead._id}`}>
                {isSubmitting && loadingAction === `delete-${lead._id}` ? 'Deleting...' : 'Delete'}
              </ButtonLoader>
            </button>
          )}
        </>
      )}
      <button
        className="assign-btn"
        onClick={async () => {
          const token = localStorage.getItem('token')
          try {
            const res = await api.get(`/api/leads/${lead._id}`)
            const data = res.data
            const visitsRes = await api.get(`/api/leads/${lead._id}/site-visits`)
            const visits = visitsRes.data
            const detail = { ...data, siteVisits: visits }
            localStorage.setItem('leadDetail', JSON.stringify(detail))
            localStorage.setItem('leadId', lead._id)
            window.location.href = '/lead-detail'
          } catch (e) {
            setNotify({ open: true, title: 'Open Failed', message: 'We could not open the lead detail. Please try again.' })
          }
        }}
      >
        View
      </button>
      {currentUser?.roles?.includes('estimation_engineer') && (
        <button
          className="save-btn"
          onClick={() => {
            setSelectedLeadForQuotation(lead._id)
            setShowQuotationModal(true)
          }}
        >
          Create Quotation
        </button>
      )}
      <button
        className="link-btn"
        onClick={async () => {
          if (isTableView) {
            // Table view: use accordion
            handleViewQuotationsTable(lead)
          } else {
            // Card view: use modal
            try {
              const qRes = await api.get('/api/quotations')
              const allQ = Array.isArray(qRes.data) ? qRes.data : []
              const list = allQ.filter(q => {
                const qLeadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
                return qLeadId === lead._id
              })
              if (list.length === 0) {
                setNotify({ open: true, title: 'No Quotations', message: 'No quotations found for this lead.' })
                return
              }
              setQuotationsForLead(list)
              setSelectedLeadForList(lead)
              setShowQuotationsListModal(true)
            } catch (e) {
              setNotify({ open: true, title: 'Open Failed', message: 'We could not load the quotations. Please try again.' })
            }
          }
        }}
      >
        View Quotations
      </button>
      {lead.status === 'approved' && (
        <button 
          onClick={() => convertToProject(lead._id)} 
          className="convert-btn"
          disabled={isSubmitting}
        >
          <ButtonLoader loading={loadingAction === `convert-${lead._id}`}>
            {isSubmitting && loadingAction === `convert-${lead._id}` ? 'Converting...' : 'Convert to Project'}
          </ButtonLoader>
        </button>
      )}
    </div>
  )

  // Approvals removed from lead module

  // Calculate filtered leads count
  const filteredLeads = leads.filter(lead => {
    // Apply "My Leads" filter
    if (myOnly && lead.createdBy?._id !== currentUser?.id) return false
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (lead.projectTitle || lead.name || '').toLowerCase().includes(term) ||
        (lead.customerName || '').toLowerCase().includes(term) ||
        (lead.enquiryNumber || '').toLowerCase().includes(term) ||
        (lead.scopeSummary || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    return true
  })
  const totalLeads = leads.length
  const displayedLeads = filteredLeads.length

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [myOnly, search])

  return (
    <div className="lead-management">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Lead Management</h1>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(myOnly || search) ? `${displayedLeads} of ${totalLeads}` : totalLeads} {totalLeads === 1 ? 'Lead' : 'Leads'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myOnly} onChange={() => setMyOnly(!myOnly)} />
            My Leads
          </label>
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
                transition: 'all 0.2s ease'
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
                transition: 'all 0.2s ease'
              }}
            >
              Table
            </button>
          </div>
          {canCreateLead() && (
            <button className="add-btn" onClick={() => setShowModal(true)}>
              Add New Lead
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        viewMode === 'card' ? (
          <div className="leads-grid">
            {Array.from({ length: itemsPerPage }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : (
          <div className="table" style={{ marginTop: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Project Title</th>
                  <th>Enquiry #</th>
                  <th>Status</th>
                  <th>Quotations</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <SkeletonTableRow key={idx} columns={7} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : viewMode === 'card' ? (
        <div className="leads-grid">
          {paginatedLeads.map(lead => (
          <div key={lead._id} className="lead-card">
            <div className="lead-header">
              <h3>{lead.projectTitle || lead.name}</h3>
              <span className={`status-badge ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
            </div>
            
            <div className="lead-details">
              {(lead.customerName || lead.projectTitle) && (
                <>
                  <p><strong>Customer:</strong> {lead.customerName}</p>
                  <p><strong>Project Title:</strong> {lead.projectTitle}</p>
                  <p><strong>Enquiry #:</strong> {lead.enquiryNumber}</p>
                  <p><strong>Enquiry Date:</strong> {lead.enquiryDate ? new Date(lead.enquiryDate).toLocaleDateString() : 'N/A'}</p>
                  <p><strong>Scope:</strong> {lead.scopeSummary}</p>
                  <p><strong>Submission Due:</strong> {lead.submissionDueDate ? new Date(lead.submissionDueDate).toLocaleDateString() : 'N/A'}</p>
                </>
              )}
              {/* Removed legacy fields in UI */}
              <p><strong>Quotations:</strong> {quotationCounts[lead._id] || 0}</p>
              <p><strong>Created by:</strong> {lead.createdBy?._id === currentUser?.id ? 'You' : lead.createdBy?.name}</p>
              {lead.createdBy?._id !== currentUser?.id && (
              <button className="link-btn" onClick={() => setProfileUser(lead.createdBy)}>
                  View Profile
                </button>
              )}
            </div>

            {/* Lead approvals removed; use Quotation approvals instead */}

            {renderLeadActions(lead)}
            {/* Highlight own leads */}
            {lead.createdBy?._id === currentUser?.id && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-color)' }}>
                Your lead
              </div>
            )}
            {lead.edits?.length > 0 && (
              <button className="link-btn" onClick={() => setHistoryLead(lead)}>
                View Edit History
              </button>
            )}
          </div>
        ))}
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Project Title</th>
                <th>Customer</th>
                <th>Enquiry #</th>
                <th>Enquiry Date</th>
                <th>Submission Due</th>
                <th>Status</th>
                <th>Quotations</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map(lead => (
                  <>
                    <tr key={lead._id}>
                      <td data-label="Project Title">{lead.projectTitle || lead.name || 'N/A'}</td>
                      <td data-label="Customer">{lead.customerName || 'N/A'}</td>
                      <td data-label="Enquiry #">{lead.enquiryNumber || 'N/A'}</td>
                      <td data-label="Enquiry Date">{lead.enquiryDate ? new Date(lead.enquiryDate).toLocaleDateString() : 'N/A'}</td>
                      <td data-label="Submission Due">{lead.submissionDueDate ? new Date(lead.submissionDueDate).toLocaleDateString() : 'N/A'}</td>
                      <td data-label="Status">
                        <span className={`status-badge ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td data-label="Quotations">{quotationCounts[lead._id] || 0}</td>
                      <td data-label="Created By">
                        {lead.createdBy?._id === currentUser?.id ? 'You' : (lead.createdBy?.name || 'N/A')}
                        {lead.createdBy?._id !== currentUser?.id && lead.createdBy && (
                          <button className="link-btn" onClick={() => setProfileUser(lead.createdBy)} style={{ marginLeft: '6px' }}>
                            View Profile
                          </button>
                        )}
                      </td>
                      <td data-label="Actions">
                        {renderLeadActions(lead, true)}
                        {lead.edits?.length > 0 && (
                          <button className="link-btn" onClick={() => setHistoryLead(lead)} style={{ marginTop: '4px', display: 'block' }}>
                            View Edit History
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedQuotationRows[lead._id] && (
                      <tr key={`${lead._id}-quotations`} className="history-row accordion-row">
                        <td colSpan={9} style={{ padding: '0' }}>
                          <div className="history-panel accordion-content" style={{ padding: '16px' }}>
                            <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Quotations ({(leadQuotationsMap[lead._id] || []).length})</h4>
                            {(leadQuotationsMap[lead._id] || []).length === 0 ? (
                              <p style={{ margin: 0, color: 'var(--text-muted)' }}>No quotations found for this lead.</p>
                            ) : (
                              <div className="table">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Offer Ref</th>
                                      <th>Offer Date</th>
                                      <th>Grand Total</th>
                                      <th>Status</th>
                                      <th>Created By</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(leadQuotationsMap[lead._id] || []).map((q) => (
                                      <tr key={q._id}>
                                        <td data-label="Offer Ref">{q.offerReference || 'N/A'}</td>
                                        <td data-label="Offer Date">{q.offerDate ? new Date(q.offerDate).toLocaleDateString() : 'N/A'}</td>
                                        <td data-label="Grand Total">{(q.priceSchedule?.currency || 'AED')} {Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                                        <td data-label="Status">{q.managementApproval?.status || 'pending'}</td>
                                        <td data-label="Created By">{q.createdBy?._id === currentUser?.id ? 'You' : (q.createdBy?.name || 'N/A')}</td>
                                        <td data-label="Actions">
                                          <button
                                            className="save-btn"
                                            onClick={() => {
                                              try {
                                                localStorage.setItem('quotationId', q._id)
                                                localStorage.setItem('quotationDetail', JSON.stringify(q))
                                                localStorage.setItem('leadId', lead._id)
                                              } catch {}
                                              window.location.href = '/quotation-detail'
                                            }}
                                          >
                                            View
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredLeads.length > 0 && (
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
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  cursor: 'pointer'
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLead ? 'Edit Lead' : 'Create New Lead'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="lead-form">
              {(currentUser?.roles?.includes('sales_engineer') || currentUser?.roles?.includes('estimation_engineer')) && (
                <>
                  <div className="form-group">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Project Title *</label>
                    <input
                      type="text"
                      value={formData.projectTitle}
                      onChange={(e) => setFormData({...formData, projectTitle: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Enquiry Number *</label>
                    <input
                      type="text"
                      value={formData.enquiryNumber}
                      onChange={(e) => setFormData({...formData, enquiryNumber: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Enquiry Date *</label>
                    <input
                      type="date"
                      value={formData.enquiryDate}
                      onChange={(e) => setFormData({...formData, enquiryDate: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Scope Summary *</label>
                    <textarea
                      value={formData.scopeSummary}
                      onChange={(e) => setFormData({...formData, scopeSummary: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Submission Due Date *</label>
                    <input
                      type="date"
                      value={formData.submissionDueDate}
                      onChange={(e) => setFormData({...formData, submissionDueDate: e.target.value})}
                      required
                    />
                  </div>
                </>
              )}
              {/* Removed legacy input fields from modal as requested */}
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="save-btn"
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'create-lead' || loadingAction === 'update-lead'}>
                    {isSubmitting ? (editingLead ? 'Saving...' : 'Creating...') : (editingLead ? 'Save Changes' : 'Create Lead')}
                  </ButtonLoader>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVisitModal && editingLead && (
        <div className="modal-overlay" onClick={() => setShowVisitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Site Visit</h2>
              <button onClick={() => setShowVisitModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (isSubmitting) return
              setLoadingAction('create-site-visit')
              setIsSubmitting(true)
              try {
                await api.post(`/api/leads/${editingLead._id}/site-visits`, visitData)
                setShowVisitModal(false)
                setVisitData({ visitAt: '', siteLocation: '', engineerName: '', workProgressSummary: '', safetyObservations: '', qualityMaterialCheck: '', issuesFound: '', actionItems: '', weatherConditions: '', description: '' })
                setNotify({ open: true, title: 'Saved', message: 'Site visit saved successfully.' })
              } catch (error) {
                setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not save the site visit. Please try again.' })
              } finally {
                setIsSubmitting(false)
                setLoadingAction(null)
              }
            }} className="lead-form">
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" value={editingLead?.projectTitle || editingLead?.name || ''} readOnly />
              </div>
              <div className="form-group">
                <label>Date and Time of Visit *</label>
                <input type="datetime-local" value={visitData.visitAt} onChange={e => setVisitData({ ...visitData, visitAt: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Site Location *</label>
                <input type="text" value={visitData.siteLocation} onChange={e => setVisitData({ ...visitData, siteLocation: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Engineer / Inspector Name *</label>
                <input type="text" value={visitData.engineerName} onChange={e => setVisitData({ ...visitData, engineerName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Work Progress Summary *</label>
                <textarea value={visitData.workProgressSummary} onChange={e => setVisitData({ ...visitData, workProgressSummary: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Safety Observations</label>
                <textarea value={visitData.safetyObservations} onChange={e => setVisitData({ ...visitData, safetyObservations: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Quality and Material Check</label>
                <textarea value={visitData.qualityMaterialCheck} onChange={e => setVisitData({ ...visitData, qualityMaterialCheck: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Issues / Non-Conformities Found</label>
                <textarea value={visitData.issuesFound} onChange={e => setVisitData({ ...visitData, issuesFound: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Action Items / Follow-up</label>
                <textarea value={visitData.actionItems} onChange={e => setVisitData({ ...visitData, actionItems: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Weather Conditions</label>
                <input type="text" value={visitData.weatherConditions} onChange={e => setVisitData({ ...visitData, weatherConditions: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Detailed Description / Remarks *</label>
                <textarea value={visitData.description} onChange={e => setVisitData({ ...visitData, description: e.target.value })} required />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowVisitModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Visit</button>
              </div>
            </form>
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

      {historyLead && (
        <div className="modal-overlay history" onClick={() => setHistoryLead(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit History</h2>
              <button onClick={() => setHistoryLead(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {historyLead.edits && historyLead.edits.length > 0 ? (
                historyLead.edits.slice().reverse().map((edit, idx) => (
                  <div key={idx} className="edit-item">
                    <div className="edit-header">
                      <span>By {edit.editedBy?._id === currentUser?.id ? 'You' : edit.editedBy?.name}</span>
                      <span>{new Date(edit.editedAt).toLocaleString()}</span>
                      {edit.editedBy?._id !== currentUser?.id && (
                        <button className="link-btn" onClick={() => setProfileUser(edit.editedBy)}>View Profile</button>
                      )}
                    </div>
                    <ul className="changes-list">
                      {edit.changes.map((c, i) => (
                        <li key={i}><strong>{c.field}:</strong> {String(c.from || '')} → {String(c.to || '')}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p>No edits recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {notify.open && (
        <div className="modal-overlay" onClick={() => {
          if (notify.onOk) {
            notify.onOk()
          }
          setNotify({ open: false, title: '', message: '' })
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{notify.title || 'Notice'}</h2>
              <button onClick={() => {
                if (notify.onOk) {
                  notify.onOk()
                }
                setNotify({ open: false, title: '', message: '' })
              }} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>{notify.message}</p>
              <div className="form-actions">
                <button type="button" className="save-btn" onClick={() => {
                  if (notify.onOk) {
                    notify.onOk()
                  }
                  setNotify({ open: false, title: '', message: '' })
                }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuotationsListModal && selectedLeadForList && (
        <div className="modal-overlay" onClick={() => {
          setShowQuotationsListModal(false)
          setSelectedLeadForList(null)
          setQuotationsForLead([])
        }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h2>Quotations for {selectedLeadForList.projectTitle || selectedLeadForList.name || 'Lead'}</h2>
              <button onClick={() => {
                setShowQuotationsListModal(false)
                setSelectedLeadForList(null)
                setQuotationsForLead([])
              }} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {quotationsForLead.length === 0 ? (
                <p>No quotations found for this lead.</p>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Offer Ref</th>
                        <th>Offer Date</th>
                        <th>Grand Total</th>
                        <th>Status</th>
                        <th>Created By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationsForLead.map((q) => (
                        <tr key={q._id}>
                          <td data-label="Offer Ref">{q.offerReference || 'N/A'}</td>
                          <td data-label="Offer Date">{q.offerDate ? new Date(q.offerDate).toLocaleDateString() : 'N/A'}</td>
                          <td data-label="Grand Total">{(q.priceSchedule?.currency || 'AED')} {Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                          <td data-label="Status">{q.managementApproval?.status || 'pending'}</td>
                          <td data-label="Created By">{q.createdBy?._id === currentUser?.id ? 'You' : (q.createdBy?.name || 'N/A')}</td>
                          <td data-label="Actions">
                            <button
                              className="save-btn"
                              onClick={() => {
                                try {
                                  localStorage.setItem('quotationId', q._id)
                                  localStorage.setItem('quotationDetail', JSON.stringify(q))
                                  localStorage.setItem('leadId', selectedLeadForList._id)
                                } catch {}
                                window.location.href = '/quotation-detail'
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateQuotationModal
        isOpen={showQuotationModal}
        onClose={() => {
          setShowQuotationModal(false)
          setSelectedLeadForQuotation(null)
        }}
        onSave={async (payload, editing) => {
          try {
            if (editing) {
              await api.put(`/api/quotations/${editing._id}`, payload)
              setShowQuotationModal(false)
              setSelectedLeadForQuotation(null)
              setNotify({ open: true, title: 'Success', message: 'Quotation updated successfully.' })
            } else {
              await api.post('/api/quotations', payload)
              setShowQuotationModal(false)
              setSelectedLeadForQuotation(null)
              setNotify({ 
                open: true, 
                title: 'Success', 
                message: 'Quotation created successfully.',
                onOk: () => {
                  navigate('/quotations')
                }
              })
            }
          } catch (error) {
            setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not save this quotation. Please try again.' })
          }
        }}
        preSelectedLeadId={selectedLeadForQuotation}
        leads={leads}
      />
    </div>
  )
}

export default LeadManagement