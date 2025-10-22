import { useState, useEffect } from 'react'
import axios from 'axios'
import './UserManagement.css'

// Will be fetched from server
const STATIC_FALLBACK_ROLES = [
  { key: 'admin', name: 'Admin' },
  { key: 'manager', name: 'Manager' },
  { key: 'account_manager', name: 'Account Manager' },
  { key: 'hr', name: 'HR' },
  { key: 'inventory_manager', name: 'Inventory Manager' },
  { key: 'store_keeper', name: 'Store Keeper' },
  { key: 'supervisor', name: 'Supervisor' },
  { key: 'site_engineer', name: 'Site Engineer' },
  { key: 'vendor', name: 'Vendor' },
  { key: 'employee', name: 'Employee' }
]

const ROLE_PERMISSIONS = {
  admin: ['admin', 'manager', 'account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'],
  manager: ['account_manager', 'hr', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'sales_engineer', 'project_engineer', 'estimation_engineer', 'vendor', 'employee'],
  hr: ['account_manager', 'inventory_manager', 'store_keeper', 'supervisor', 'site_engineer', 'employee'],
  supervisor: ['vendor'],
  site_engineer: ['vendor'],
  inventory_manager: ['store_keeper']
}

function UserManagement() {
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', roles: [], roleIds: [] })
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [allRoles, setAllRoles] = useState(STATIC_FALLBACK_ROLES)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setCurrentUser(userData)
    fetchUsers()
    fetchRoles()
  }, [])
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('http://localhost:5000/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAllRoles(response.data)
    } catch (error) {
      // keep fallback
    }
  }


  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(response.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const token = localStorage.getItem('token')
      
      const payload = {
        name: formData.name,
        email: formData.email,
        // Prefer roleIds; server can also accept roles keys
        roleIds: formData.roleIds,
        roles: formData.roles
      }
      if (editingUser) {
        await axios.put(`http://localhost:5000/api/users/${editingUser._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        await axios.post('http://localhost:5000/api/users', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      
      fetchUsers()
      setShowModal(false)
      setEditingUser(null)
      setFormData({ name: '', email: '', roles: [], roleIds: [] })
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving user')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, roles: user.roles || [], roleIds: user.roleIds || [] })
    setShowModal(true)
  }

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`http://localhost:5000/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchUsers()
    } catch (error) {
      alert('Error deleting user')
    }
  }

  const getRoleLabel = (roleKey) => {
    return allRoles.find(r => r.key === roleKey)?.name || roleKey
  }

  const getAvailableRoles = () => {
    if (!currentUser?.roles) return []
    
    let allowedRoles = []
    
    for (const role of currentUser.roles) {
      if (ROLE_PERMISSIONS[role]) {
        allowedRoles = [...allowedRoles, ...ROLE_PERMISSIONS[role]]
      }
    }
    
    // Remove duplicates and return role objects
    const uniqueRoles = [...new Set(allowedRoles)]
    return allRoles
      .filter(role => uniqueRoles.includes(role.key))
      .map(r => ({ value: r.key, label: r.name, _id: r._id }))
  }

  const handleRoleChange = (roleValue, roleId) => {
    const hasRole = formData.roles.includes(roleValue)
    const newRoles = hasRole
      ? formData.roles.filter(r => r !== roleValue)
      : [...formData.roles, roleValue]
    const newRoleIds = hasRole
      ? formData.roleIds.filter(id => id !== roleId)
      : [...formData.roleIds, roleId]
    setFormData({ ...formData, roles: newRoles, roleIds: newRoleIds })
  }

  return (
    <div className="user-management">
      <div className="header">
        <h1>User Management</h1>
        <button className="add-btn" onClick={() => setShowModal(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
          Add User
        </button>
      </div>

      <div className="users-grid">
        {users.map(user => (
          <div key={user._id} className="user-card">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="detail-column">
                <span className="detail-label">Name</span>
                <span className="detail-value">{user.name}</span>
              </div>
              <div className="detail-column">
                <span className="detail-label">Email</span>
                <span className="detail-value">{user.email}</span>
              </div>
              <div className="detail-column">
                <span className="detail-label">User Type</span>
                <div className="roles-container">
                  {user.roles?.map(role => (
                    <span key={role} className={`role-badge ${role}`}>
                      {getRoleLabel(role)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className={`status ${user.isActive ? 'active' : 'inactive'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </div>
            <div className="user-actions">
              <button onClick={() => handleEdit(user)} className="edit-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button onClick={() => handleDelete(user._id)} className="delete-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Roles (Select multiple)</label>
                <div className="roles-grid">
                  {getAvailableRoles().map(role => (
                    <label key={role.value} className="role-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role.value)}
                        onChange={() => handleRoleChange(role.value, role._id)}
                      />
                      <span className="checkmark"></span>
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="save-btn">
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement