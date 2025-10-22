import { useEffect, useState } from 'react'
import './LeadManagement.css'
import './LeadDetail.css'
import { setTheme } from '../utils/theme'

function LeadDetail() {
  const [lead, setLead] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [showLeadHistory, setShowLeadHistory] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [visitEditData, setVisitEditData] = useState({
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
  const [visitHistoryOpen, setVisitHistoryOpen] = useState({})
  const [profileUser, setProfileUser] = useState(null)
  const [editLeadOpen, setEditLeadOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })
  const [leadEditData, setLeadEditData] = useState({
    customerName: '',
    projectTitle: '',
    enquiryNumber: '',
    enquiryDate: '',
    scopeSummary: '',
    submissionDueDate: ''
  })
  const [newVisitOpen, setNewVisitOpen] = useState(false)
  const [newVisitData, setNewVisitData] = useState({
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

  useEffect(() => {
    async function load() {
      try {
        const storedUser = localStorage.getItem('user')
        if (storedUser) setCurrentUser(JSON.parse(storedUser))
        let storedLead = null
        const stored = localStorage.getItem('leadDetail')
        if (stored) {
          storedLead = JSON.parse(stored)
          setLead(storedLead)
        }
        let id = localStorage.getItem('leadId') || storedLead?._id
        if (id) {
          const token = localStorage.getItem('token')
          const leadRes = await fetch(`http://localhost:5000/api/leads/${id}`, { headers: { Authorization: `Bearer ${token}` }})
          const leadData = await leadRes.json()
          const visitsRes = await fetch(`http://localhost:5000/api/leads/${id}/site-visits`, { headers: { Authorization: `Bearer ${token}` }})
          const visitsData = await visitsRes.json()
          setLead({ ...leadData, siteVisits: visitsData })
        }
      } catch {}
    }
    load()
  }, [])

  useEffect(() => {
    setTheme(isDark)
  }, [isDark])

  if (!lead) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Lead Details</h2>
      <p>Nothing to display.</p>
    </div>
  )

  return (
    <div className="lead-detail">
      <div className="ld-header">
        <div className="ld-title">
          <div className="title-row">
            <h1>{lead.projectTitle || lead.name}</h1>
          </div>
          <span className="ld-subtitle">Enquiry #{lead.enquiryNumber || 'N/A'}</span>
        </div>
        <div className="ld-sticky-actions">
          <span className={`status-pill ${lead.status}`}>{lead.status}</span>
          <button className="theme-toggle-dash" onClick={() => setIsDark(!isDark)}>
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
          {currentUser?.roles?.includes('project_engineer') && (
            <button
              className="save-btn"
              onClick={() => setNewVisitOpen(true)}
            >
              New Site Visit
            </button>
          )}
          {lead.status === 'draft' && (currentUser?.roles?.includes('sales_engineer') || currentUser?.roles?.includes('estimation_engineer') || currentUser?.id === lead.createdBy?._id) && (
            <button
              className="save-btn"
              onClick={() => {
                setLeadEditData({
                  customerName: lead.customerName || '',
                  projectTitle: lead.projectTitle || '',
                  enquiryNumber: lead.enquiryNumber || '',
                  enquiryDate: lead.enquiryDate ? lead.enquiryDate.substring(0,10) : '',
                  scopeSummary: lead.scopeSummary || '',
                  submissionDueDate: lead.submissionDueDate ? lead.submissionDueDate.substring(0,10) : ''
                })
                setEditLeadOpen(true)
              }}
            >
              Edit Lead
            </button>
          )}
          {lead.status === 'draft' && currentUser?.id === lead.createdBy?._id && (
            <button
              className="cancel-btn"
              onClick={async () => {
                if (!confirm('Delete this lead?')) return
                try {
                  const token = localStorage.getItem('token')
                  // Ensure no site visits
                  const resVisits = await fetch(`http://localhost:5000/api/leads/${lead._id}/site-visits`, {
                    headers: { Authorization: `Bearer ${token}` }
                  })
                  const visits = await resVisits.json()
                  if (Array.isArray(visits) && visits.length > 0) {
                    alert('Cannot delete lead with existing site visits')
                    return
                  }
                  const res = await fetch(`http://localhost:5000/api/leads/${lead._id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.message || 'Error deleting lead')
                  }
                  alert('Lead deleted')
                  window.location.href = '/'
                } catch (e) {
                  alert(e.message || 'Error deleting lead')
                }
              }}
            >
              Delete Lead
            </button>
          )}
          {lead.status === 'draft' && currentUser?.roles?.includes('estimation_engineer') && (
            <button
              className="save-btn"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token')
                  // If estimation engineer, ensure at least one site visit exists
                  const resVisits = await fetch(`http://localhost:5000/api/leads/${lead._id}/site-visits`, {
                    headers: { Authorization: `Bearer ${token}` }
                  })
                  const visits = await resVisits.json()
                  if (!Array.isArray(visits) || visits.length === 0) {
                    alert('Please add a site visit before submitting for approval')
                    return
                  }

                  const res = await fetch(`http://localhost:5000/api/leads/${lead._id}/submit`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.message || 'Error submitting lead')
                  }
                  const updated = await res.json()
                  setLead(prev => ({ ...prev, status: updated.status }))
                  alert('Lead submitted for approval')
                } catch (e) {
                  alert(e.message || 'Error submitting lead')
                }
              }}
            >
              Submit for Approval
            </button>
          )}
          {lead.edits?.length > 0 && (
            <button className="link-btn" onClick={() => setShowLeadHistory(!showLeadHistory)}>
              {showLeadHistory ? 'Hide Lead Edit History' : 'View Lead Edit History'}
            </button>
          )}
        </div>
      </div>

      <div className="ld-grid">
        <div className="ld-card ld-section">
          <h3>Lead Overview</h3>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Field">Customer</td>
                  <td data-label="Value">{lead.customerName || 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Field">Project Title</td>
                  <td data-label="Value">{lead.projectTitle || 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Field">Enquiry Date</td>
                  <td data-label="Value">{lead.enquiryDate ? new Date(lead.enquiryDate).toLocaleDateString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Field">Submission Due</td>
                  <td data-label="Value">{lead.submissionDueDate ? new Date(lead.submissionDueDate).toLocaleDateString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Field">Scope</td>
                  <td data-label="Value">{lead.scopeSummary || 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Field">Created By</td>
                  <td data-label="Value">{lead.createdBy?.name || 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Lead edit history (toggle) */}
      {showLeadHistory && lead.edits?.length > 0 && (
        <div className="ld-card ld-section">
          <h3>Edit History</h3>
          <div className="edits-list">
            {lead.edits.slice().reverse().map((edit, idx) => (
              <div key={idx} className="edit-item">
                <div className="edit-header">
                  <span>By {edit.editedBy?._id === currentUser?.id ? 'You' : (edit.editedBy?.name || 'N/A')}</span>
                  <span>{new Date(edit.editedAt).toLocaleString()}</span>
                  {edit.editedBy?._id !== currentUser?.id && edit.editedBy && (
                    <button className="link-btn" onClick={() => setProfileUser(edit.editedBy)}>View Profile</button>
                  )}
                </div>
                <ul className="changes-list">
                  {edit.changes.map((c, i) => (
                    <li key={i}><strong>{c.field}:</strong> {String(c.from || '')} → {String(c.to || '')}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {lead.siteVisits?.length > 0 && (
        <div className="ld-card ld-section">
          <h3>Site Visits ({lead.siteVisits.length})</h3>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Engineer</th>
                  <th>Location</th>
                  <th>Progress</th>
                  <th>Added By</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lead.siteVisits.map((v) => (
                  <>
                    <tr key={v._id}>
                      <td data-label="Date & Time">{v.visitAt ? new Date(v.visitAt).toLocaleString() : 'N/A'}</td>
                      <td data-label="Engineer">{v.engineerName || 'N/A'}</td>
                      <td data-label="Location">{v.siteLocation || 'N/A'}</td>
                      <td data-label="Progress">{v.workProgressSummary || 'N/A'}</td>
                      <td data-label="Added By">
                        {v.createdBy?._id === currentUser?.id ? 'You' : (v.createdBy?.name || 'N/A')}
                        {v.createdBy?._id !== currentUser?.id && v.createdBy && (
                          <button className="link-btn" onClick={() => setProfileUser(v.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </td>
                      <td data-label="Description">{v.description || 'N/A'}</td>
                      <td data-label="Actions">
                        <div className="ld-actions">
                          {(currentUser?.roles?.includes('project_engineer') || currentUser?.roles?.includes('estimation_engineer')) && (
                            <button className="save-btn" onClick={() => {
                              setEditVisit(v)
                              setVisitEditData({
                                visitAt: v.visitAt ? new Date(v.visitAt).toISOString().slice(0,16) : '',
                                siteLocation: v.siteLocation || '',
                                engineerName: v.engineerName || '',
                                workProgressSummary: v.workProgressSummary || '',
                                safetyObservations: v.safetyObservations || '',
                                qualityMaterialCheck: v.qualityMaterialCheck || '',
                                issuesFound: v.issuesFound || '',
                                actionItems: v.actionItems || '',
                                weatherConditions: v.weatherConditions || '',
                                description: v.description || ''
                              })
                            }}>Edit</button>
                          )}
                          {v.edits?.length > 0 && (
                            <button className="link-btn" onClick={() => setVisitHistoryOpen(prev => ({ ...prev, [v._id]: !prev[v._id] }))}>
                              {visitHistoryOpen[v._id] ? 'Hide History' : 'View History'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {visitHistoryOpen[v._id] && v.edits?.length > 0 && (
                      <tr className="history-row">
                        <td colSpan={7}>
                          <div className="history-panel">
                            {v.edits.slice().reverse().map((e, j) => (
                              <div key={j} className="edit-item" style={{ marginTop: 8 }}>
                                <div className="edit-header">
                                  <span>By {e.editedBy?._id === currentUser?.id ? 'You' : (e.editedBy?.name || 'N/A')}</span>
                                  <span>{new Date(e.editedAt).toLocaleString()}</span>
                                  {e.editedBy?._id !== currentUser?.id && e.editedBy && (
                                    <button className="link-btn" onClick={() => setProfileUser(e.editedBy)}>View Profile</button>
                                  )}
                                </div>
                                <ul className="changes-list">
                                  {e.changes.map((c, k) => (
                                    <li key={k}><strong>{c.field}:</strong> {String(c.from || '')} → {String(c.to || '')}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profileUser && (
        <div className="modal-overlay" onClick={() => setProfileUser(null)}>
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

      {editLeadOpen && (
        <div className="modal-overlay" onClick={() => setEditLeadOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Lead</h2>
              <button onClick={() => setEditLeadOpen(false)} className="close-btn">×</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const token = localStorage.getItem('token')
                  const res = await fetch(`http://localhost:5000/api/leads/${lead._id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(leadEditData)
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.message || 'Error saving lead')
                  }
                  const updated = await res.json()
                  setLead(prev => ({ ...prev, ...updated }))
                  setEditLeadOpen(false)
                } catch (err) {
                  alert(err.message || 'Error updating lead')
                }
              }}
              className="assign-form"
            >
              <div className="form-group">
                <label>Customer Name *</label>
                <input type="text" value={leadEditData.customerName} onChange={e => setLeadEditData({ ...leadEditData, customerName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Project Title *</label>
                <input type="text" value={leadEditData.projectTitle} onChange={e => setLeadEditData({ ...leadEditData, projectTitle: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Enquiry Number *</label>
                <input type="text" value={leadEditData.enquiryNumber} onChange={e => setLeadEditData({ ...leadEditData, enquiryNumber: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Enquiry Date *</label>
                <input type="date" value={leadEditData.enquiryDate} onChange={e => setLeadEditData({ ...leadEditData, enquiryDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Scope Summary *</label>
                <textarea value={leadEditData.scopeSummary} onChange={e => setLeadEditData({ ...leadEditData, scopeSummary: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Submission Due Date *</label>
                <input type="date" value={leadEditData.submissionDueDate} onChange={e => setLeadEditData({ ...leadEditData, submissionDueDate: e.target.value })} required />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setEditLeadOpen(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editVisit && (
        <div className="modal-overlay" onClick={() => setEditVisit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Site Visit</h2>
              <button onClick={() => setEditVisit(null)} className="close-btn">×</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const token = localStorage.getItem('token')
                  const res = await fetch(`http://localhost:5000/api/leads/${lead._id}/site-visits/${editVisit._id}` , {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(visitEditData)
                  })
                  if (!res.ok) throw new Error('Failed')
                  const updated = await res.json()
                  setLead(prev => ({
                    ...prev,
                    siteVisits: prev.siteVisits.map(v => v._id === updated._id ? updated : v)
                  }))
                  setEditVisit(null)
                } catch (err) {
                  alert('Error updating site visit')
                }
              }}
              className="assign-form"
            >
              <div className="form-group">
                <label>Date and Time of Visit *</label>
                <input type="datetime-local" value={visitEditData.visitAt} onChange={e => setVisitEditData({ ...visitEditData, visitAt: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Site Location *</label>
                <input type="text" value={visitEditData.siteLocation} onChange={e => setVisitEditData({ ...visitEditData, siteLocation: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Engineer / Inspector Name *</label>
                <input type="text" value={visitEditData.engineerName} onChange={e => setVisitEditData({ ...visitEditData, engineerName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Work Progress Summary *</label>
                <textarea value={visitEditData.workProgressSummary} onChange={e => setVisitEditData({ ...visitEditData, workProgressSummary: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Safety Observations</label>
                <textarea value={visitEditData.safetyObservations} onChange={e => setVisitEditData({ ...visitEditData, safetyObservations: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Quality and Material Check</label>
                <textarea value={visitEditData.qualityMaterialCheck} onChange={e => setVisitEditData({ ...visitEditData, qualityMaterialCheck: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Issues / Non-Conformities Found</label>
                <textarea value={visitEditData.issuesFound} onChange={e => setVisitEditData({ ...visitEditData, issuesFound: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Action Items / Follow-up</label>
                <textarea value={visitEditData.actionItems} onChange={e => setVisitEditData({ ...visitEditData, actionItems: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Weather Conditions</label>
                <input type="text" value={visitEditData.weatherConditions} onChange={e => setVisitEditData({ ...visitEditData, weatherConditions: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Detailed Description / Remarks *</label>
                <textarea value={visitEditData.description} onChange={e => setVisitEditData({ ...visitEditData, description: e.target.value })} required />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setEditVisit(null)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newVisitOpen && (
        <div className="modal-overlay" onClick={() => setNewVisitOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Site Visit</h2>
              <button onClick={() => setNewVisitOpen(false)} className="close-btn">×</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const token = localStorage.getItem('token')
                  const res = await fetch(`http://localhost:5000/api/leads/${lead._id}/site-visits`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(newVisitData)
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.message || 'Error creating site visit')
                  }
                  // Refresh visits list to include createdBy populated
                  const visitsRes = await fetch(`http://localhost:5000/api/leads/${lead._id}/site-visits`, { headers: { Authorization: `Bearer ${token}` }})
                  const visits = await visitsRes.json()
                  setLead(prev => ({ ...prev, siteVisits: visits }))
                  setNewVisitOpen(false)
                  setNewVisitData({ visitAt: '', siteLocation: '', engineerName: '', workProgressSummary: '', safetyObservations: '', qualityMaterialCheck: '', issuesFound: '', actionItems: '', weatherConditions: '', description: '' })
                } catch (err) {
                  alert(err.message || 'Error creating site visit')
                }
              }}
              className="assign-form"
            >
              <div className="form-group">
                <label>Date and Time of Visit *</label>
                <input type="datetime-local" value={newVisitData.visitAt} onChange={e => setNewVisitData({ ...newVisitData, visitAt: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Site Location *</label>
                <input type="text" value={newVisitData.siteLocation} onChange={e => setNewVisitData({ ...newVisitData, siteLocation: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Engineer / Inspector Name *</label>
                <input type="text" value={newVisitData.engineerName} onChange={e => setNewVisitData({ ...newVisitData, engineerName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Work Progress Summary *</label>
                <textarea value={newVisitData.workProgressSummary} onChange={e => setNewVisitData({ ...newVisitData, workProgressSummary: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Safety Observations</label>
                <textarea value={newVisitData.safetyObservations} onChange={e => setNewVisitData({ ...newVisitData, safetyObservations: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Quality and Material Check</label>
                <textarea value={newVisitData.qualityMaterialCheck} onChange={e => setNewVisitData({ ...newVisitData, qualityMaterialCheck: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Issues / Non-Conformities Found</label>
                <textarea value={newVisitData.issuesFound} onChange={e => setNewVisitData({ ...newVisitData, issuesFound: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Action Items / Follow-up</label>
                <textarea value={newVisitData.actionItems} onChange={e => setNewVisitData({ ...newVisitData, actionItems: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Weather Conditions</label>
                <input type="text" value={newVisitData.weatherConditions} onChange={e => setNewVisitData({ ...newVisitData, weatherConditions: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Detailed Description / Remarks *</label>
                <textarea value={newVisitData.description} onChange={e => setNewVisitData({ ...newVisitData, description: e.target.value })} required />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setNewVisitOpen(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadDetail


