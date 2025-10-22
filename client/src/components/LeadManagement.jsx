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
      alert(error.response?.data?.message || 'Error creating lead')
    }
  }

  const submitForApproval = async (leadId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/leads/${leadId}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
    } catch (error) {
      alert(error.response?.data?.message || 'Error submitting lead')
    }
  }

  const handleApproval = async (leadId, type, status, comments = '') => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/leads/${leadId}/approve`, {
        type, status, comments
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing approval')
    }
  }

  const convertToProject = async (leadId) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`http://localhost:5000/api/leads/${leadId}/convert`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
      alert('Lead converted to project successfully!')
    } catch (error) {
      alert(error.response?.data?.message || 'Error converting lead')
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
      alert(error.response?.data?.message || 'Error deleting lead')
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

  const canApprove = (type) => {
    return (type === 'accounts' && currentUser?.roles?.includes('account_manager')) ||
           (type === 'management' && (currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')))
  }

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

            {lead.status === 'submitted' && (
              <div className="approvals">
                <div className="approval-section">
                  <h4>Accounts Approval</h4>
                  <span className={`approval-status ${lead.approvals.accounts.status}`}>
                    {lead.approvals.accounts.status}
                  </span>
                  {canApprove('accounts') && lead.approvals.accounts.status === 'pending' && (
                    <div className="approval-actions">
                      <button onClick={() => handleApproval(lead._id, 'accounts', 'approved')} className="approve-btn">
                        Approve
                      </button>
                      <button onClick={() => handleApproval(lead._id, 'accounts', 'rejected')} className="reject-btn">
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                <div className="approval-section">
                  <h4>Management Approval</h4>
                  <span className={`approval-status ${lead.approvals.management.status}`}>
                    {lead.approvals.management.status}
                  </span>
                  {canApprove('management') && lead.approvals.management.status === 'pending' && (
                    <div className="approval-actions">
                      <button onClick={() => handleApproval(lead._id, 'management', 'approved')} className="approve-btn">
                        Approve
                      </button>
                      <button onClick={() => handleApproval(lead._id, 'management', 'rejected')} className="reject-btn">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="lead-actions">
              {lead.status === 'draft' && (
                <>
                  {lead.createdBy?._id === currentUser?.id && (
                    <button onClick={() => submitForApproval(lead._id)} className="submit-btn">
                      Submit for Approval
                    </button>
                  )}
                  {(currentUser?.roles?.includes('sales_engineer') || currentUser?.roles?.includes('estimation_engineer') || lead.createdBy?._id === currentUser?.id) && (
                    <button onClick={() => handleEditLead(lead)} className="save-btn">
                      Edit
                    </button>
                  )}
                  {lead.createdBy?._id === currentUser?.id && (
                    <button onClick={() => handleDeleteLead(lead._id)} className="cancel-btn">
                      Delete
                    </button>
                  )}
                </>
              )}
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
    </div>
  )
}

export default LeadManagement