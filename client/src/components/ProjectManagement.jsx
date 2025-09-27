import { useState, useEffect } from 'react'
import axios from 'axios'
import './ProjectManagement.css'

function ProjectManagement() {
  const [projects, setProjects] = useState([])
  const [siteEngineers, setSiteEngineers] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [assignData, setAssignData] = useState({ siteEngineerId: '' })
  const [revisionData, setRevisionData] = useState({
    type: 'price',
    description: '',
    changes: ''
  })

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setCurrentUser(userData)
    fetchProjects()
    fetchSiteEngineers()
  }, [])

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('http://localhost:5000/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProjects(response.data)
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchSiteEngineers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const engineers = response.data.filter(user => user.roles?.includes('site_engineer'))
      setSiteEngineers(engineers)
    } catch (error) {
      console.error('Error fetching site engineers:', error)
    }
  }

  const assignSiteEngineer = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/projects/${selectedProject._id}/assign-engineer`, 
        assignData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchProjects()
      setShowAssignModal(false)
      setAssignData({ siteEngineerId: '' })
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning engineer')
    }
  }

  const createRevision = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      await axios.post(`http://localhost:5000/api/projects/${selectedProject._id}/revisions`, 
        revisionData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchProjects()
      setShowRevisionModal(false)
      setRevisionData({ type: 'price', description: '', changes: '' })
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating revision')
    }
  }

  const approveRevision = async (projectId, revisionId, status) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/projects/${projectId}/revisions/${revisionId}/approve`, {
        status, comments: ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchProjects()
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing revision')
    }
  }

  const canAssignEngineer = () => {
    return currentUser?.roles?.some(role => ['admin', 'manager', 'supervisor'].includes(role))
  }

  const canCreateRevision = () => {
    return currentUser?.roles?.some(role => ['admin', 'manager'].includes(role))
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'green',
      completed: 'blue',
      on_hold: 'orange'
    }
    return colors[status] || 'gray'
  }

  return (
    <div className="project-management">
      <div className="header">
        <h1>Project Management</h1>
      </div>

      <div className="projects-grid">
        {projects.map(project => (
          <div key={project._id} className="project-card">
            <div className="project-header">
              <h3>{project.name}</h3>
              <span className={`status-badge ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            
            <div className="project-details">
              <p><strong>Budget:</strong> ${project.budget?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {project.locationDetails}</p>
              <p><strong>Working Hours:</strong> {project.workingHours || 'N/A'}</p>
              <p><strong>Manpower:</strong> {project.manpowerCount || 'N/A'}</p>
              <p><strong>Site Engineer:</strong> {project.assignedSiteEngineer?.name || 'Not Assigned'}</p>
            </div>

            {project.revisions?.length > 0 && (
              <div className="revisions-section">
                <h4>Revisions ({project.revisions.length})</h4>
                <div className="revisions-list">
                  {project.revisions.slice(-3).map(revision => (
                    <div key={revision._id} className="revision-item">
                      <div className="revision-header">
                        <span className="revision-type">{revision.type}</span>
                        <span className={`revision-status ${revision.status}`}>
                          {revision.status}
                        </span>
                      </div>
                      <p className="revision-desc">{revision.description}</p>
                      {canCreateRevision() && revision.status === 'pending' && (
                        <div className="revision-actions">
                          <button onClick={() => approveRevision(project._id, revision._id, 'approved')} 
                                  className="approve-btn">
                            Approve
                          </button>
                          <button onClick={() => approveRevision(project._id, revision._id, 'rejected')} 
                                  className="reject-btn">
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="project-actions">
              {canAssignEngineer() && (
                <button onClick={() => {
                  setSelectedProject(project)
                  setShowAssignModal(true)
                }} className="assign-btn">
                  {project.assignedSiteEngineer ? 'Reassign Engineer' : 'Assign Engineer'}
                </button>
              )}
              {canCreateRevision() && (
                <button onClick={() => {
                  setSelectedProject(project)
                  setShowRevisionModal(true)
                }} className="revision-btn">
                  Create Revision
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Site Engineer</h2>
              <button onClick={() => setShowAssignModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={assignSiteEngineer} className="assign-form">
              <div className="form-group">
                <label>Site Engineer</label>
                <select
                  value={assignData.siteEngineerId}
                  onChange={(e) => setAssignData({siteEngineerId: e.target.value})}
                  required
                >
                  <option value="">Select Site Engineer</option>
                  {siteEngineers.map(engineer => (
                    <option key={engineer._id} value={engineer._id}>
                      {engineer.name} ({engineer.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowAssignModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Assign Engineer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="modal-overlay" onClick={() => setShowRevisionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Revision</h2>
              <button onClick={() => setShowRevisionModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={createRevision} className="revision-form">
              <div className="form-group">
                <label>Revision Type</label>
                <select
                  value={revisionData.type}
                  onChange={(e) => setRevisionData({...revisionData, type: e.target.value})}
                >
                  <option value="price">Price Revision</option>
                  <option value="management">Management Revision</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={revisionData.description}
                  onChange={(e) => setRevisionData({...revisionData, description: e.target.value})}
                  placeholder="Describe the revision..."
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Changes (JSON format)</label>
                <textarea
                  value={revisionData.changes}
                  onChange={(e) => setRevisionData({...revisionData, changes: e.target.value})}
                  placeholder='{"budget": 50000, "timeline": "6 months"}'
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowRevisionModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Create Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectManagement