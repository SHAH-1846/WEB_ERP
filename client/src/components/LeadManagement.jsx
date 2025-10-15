import { useState, useEffect } from 'react'
import axios from 'axios'
import './LeadManagement.css'

function LeadManagement() {
  const [leads, setLeads] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    budget: '',
    locationDetails: '',
    workingHours: '',
    manpowerCount: ''
  })

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
      await axios.post('http://localhost:5000/api/leads', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchLeads()
      setShowModal(false)
      setFormData({ name: '', budget: '', locationDetails: '', workingHours: '', manpowerCount: '' })
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

  const canApprove = (type) => {
    return (type === 'accounts' && currentUser?.roles?.includes('account_manager')) ||
           (type === 'management' && (currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')))
  }

  return (
    <div className="lead-management">
      <div className="header">
        <h1>Lead Management</h1>
        {currentUser?.roles?.includes('supervisor') && (
          <button className="add-btn" onClick={() => setShowModal(true)}>
            Add New Lead
          </button>
        )}
      </div>

      <div className="leads-grid">
        {leads.map(lead => (
          <div key={lead._id} className="lead-card">
            <div className="lead-header">
              <h3>{lead.name}</h3>
              <span className={`status-badge ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
            </div>
            
            <div className="lead-details">
              <p><strong>Budget:</strong> AED {lead.budget?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {lead.locationDetails}</p>
              <p><strong>Working Hours:</strong> {lead.workingHours || 'N/A'}</p>
              <p><strong>Manpower:</strong> {lead.manpowerCount || 'N/A'}</p>
              <p><strong>Created by:</strong> {lead.createdBy?.name}</p>
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
              {lead.status === 'draft' && lead.createdBy?._id === currentUser?.id && (
                <button onClick={() => submitForApproval(lead._id)} className="submit-btn">
                  Submit for Approval
                </button>
              )}
              {lead.status === 'approved' && (
                <button onClick={() => convertToProject(lead._id)} className="convert-btn">
                  Convert to Project
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Lead</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="lead-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Budget</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Location Details *</label>
                <textarea
                  value={formData.locationDetails}
                  onChange={(e) => setFormData({...formData, locationDetails: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Working Hours</label>
                <input
                  type="text"
                  value={formData.workingHours}
                  onChange={(e) => setFormData({...formData, workingHours: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Manpower Count</label>
                <input
                  type="number"
                  value={formData.manpowerCount}
                  onChange={(e) => setFormData({...formData, manpowerCount: e.target.value})}
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadManagement