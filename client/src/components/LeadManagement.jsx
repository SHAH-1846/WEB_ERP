import { useState, useEffect } from 'react'
import axios from 'axios'
import './LeadManagement.css'

function LeadManagement() {
  const [leads, setLeads] = useState([])
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
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setCurrentUser(userData)
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('http://localhost:5000/api/leads', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setLeads(response.data)
    } catch (error) {
      console.error('Error fetching leads:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      if (editingLead) {
        await axios.put(`http://localhost:5000/api/leads/${editingLead._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        await axios.post('http://localhost:5000/api/leads', formData, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      fetchLeads()
      setShowModal(false)
      setFormData({ customerName: '', projectTitle: '', enquiryNumber: '', enquiryDate: '', scopeSummary: '', submissionDueDate: '' })
      setEditingLead(null)
    } catch (error) {
      setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not save this lead. Please try again.' })
    }
  }

  // Lead approvals removed; handled at Quotation level

  const convertToProject = async (leadId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`http://localhost:5000/api/leads/${leadId}/convert`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
      setNotify({ open: true, title: 'Converted', message: 'Lead converted to project successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Convert Failed', message: error.response?.data?.message || 'We could not convert this lead. Please try again.' })
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
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`http://localhost:5000/api/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
    } catch (error) {
      setNotify({ open: true, title: 'Delete Failed', message: error.response?.data?.message || 'We could not delete this lead. Please try again.' })
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

  // Approvals removed from lead module

  return (
    <div className="lead-management">
      <div className="header">
        <h1>Lead Management</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myOnly} onChange={() => setMyOnly(!myOnly)} />
            My Leads
          </label>
          {canCreateLead() && (
            <button className="add-btn" onClick={() => setShowModal(true)}>
              Add New Lead
            </button>
          )}
        </div>
      </div>

      <div className="leads-grid">
        {leads
          .filter(lead => !myOnly || lead.createdBy?._id === currentUser?.id)
          .map(lead => (
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
              <p><strong>Created by:</strong> {lead.createdBy?._id === currentUser?.id ? 'You' : lead.createdBy?.name}</p>
              {lead.createdBy?._id !== currentUser?.id && (
              <button className="link-btn" onClick={() => setProfileUser(lead.createdBy)}>
                  View Profile
                </button>
              )}
            </div>

            {/* Lead approvals removed; use Quotation approvals instead */}

            <div className="lead-actions">
              {lead.status === 'draft' && (
                <>
                  {(currentUser?.roles?.includes('sales_engineer') || currentUser?.roles?.includes('estimation_engineer') || lead.createdBy?._id === currentUser?.id) && (
                    <button onClick={() => handleEditLead(lead)} className="save-btn">
                      Edit
                    </button>
                  )}
                  {currentUser?.roles?.includes('project_engineer') && (
                    <button onClick={() => { setEditingLead(lead); setShowVisitModal(true); }} className="assign-btn">
                      New Site Visit
                    </button>
                  )}
                  {lead.createdBy?._id === currentUser?.id && (
                    <button onClick={() => handleDeleteLead(lead._id)} className="cancel-btn">
                      Delete
                    </button>
                  )}
                </>
              )}
              <button
                className="assign-btn"
                onClick={async () => {
                  // open detail view in a new window for now
                  const token = localStorage.getItem('token')
                  try {
                    const res = await axios.get(`http://localhost:5000/api/leads/${lead._id}`, { headers: { Authorization: `Bearer ${token}` } })
                    const data = res.data
                    const visitsRes = await axios.get(`http://localhost:5000/api/leads/${lead._id}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
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
              <button
                className="link-btn"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    const qRes = await axios.get('http://localhost:5000/api/quotations', { headers: { Authorization: `Bearer ${token}` } })
                    const allQ = Array.isArray(qRes.data) ? qRes.data : []
                    const list = allQ.filter(q => {
                      const qLeadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
                      return qLeadId === lead._id
                    })
                    if (list.length === 0) {
                      setNotify({ open: true, title: 'No Quotations', message: 'No quotations found for this lead.' })
                      return
                    }
                    const q = list[0]
                    try {
                      localStorage.setItem('quotationId', q._id)
                      localStorage.setItem('quotationDetail', JSON.stringify(q))
                      localStorage.setItem('leadId', lead._id)
                    } catch {}
                    window.location.href = '/quotation-detail'
                  } catch (e) {
                    setNotify({ open: true, title: 'Open Failed', message: 'We could not open the quotation. Please try again.' })
                  }
                }}
              >
                View Quotation
              </button>
              {lead.status === 'approved' && (
                <button onClick={() => convertToProject(lead._id)} className="convert-btn">
                  Convert to Project
                </button>
              )}
            </div>
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
                <button type="submit" className="save-btn">
                  {editingLead ? 'Save Changes' : 'Create Lead'}
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
              try {
                const token = localStorage.getItem('token')
                await axios.post(`http://localhost:5000/api/leads/${editingLead._id}/site-visits`, visitData, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                setShowVisitModal(false)
                setVisitData({ visitAt: '', siteLocation: '', engineerName: '', workProgressSummary: '', safetyObservations: '', qualityMaterialCheck: '', issuesFound: '', actionItems: '', weatherConditions: '', description: '' })
                setNotify({ open: true, title: 'Saved', message: 'Site visit saved successfully.' })
              } catch (error) {
                setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not save the site visit. Please try again.' })
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

export default LeadManagement