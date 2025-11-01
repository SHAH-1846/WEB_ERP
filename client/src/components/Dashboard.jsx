import { useState, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import './Dashboard.css'
import UserManagement from './UserManagement'
import LeadManagement from './LeadManagement'
import ProjectManagement from './ProjectManagement'
import QuotationManagement from './QuotationManagement'
import RevisionManagement from './RevisionManagement'
import { initTheme, setTheme } from '../utils/theme'

function Dashboard() {
  const [user, setUser] = useState(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false') } catch { return false }
  })
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState({
    totalUsers: 1247,
    revenue: 89432,
    orders: 342,
    growth: 12.5
  })

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setUser(userData)
    const path = location.pathname.replace('/', '') || 'dashboard'
    if (['dashboard','users','leads','projects','quotations','revisions'].includes(path)) {
      setActiveTab(path)
    }
  }, [location.pathname])

  useEffect(() => {
    setTheme(isDark)
  }, [isDark])

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
  }

  return (
    <div className="dashboard">
      <button className="theme-toggle-dash" onClick={() => setIsDark(!isDark)}>
        {isDark ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
          </svg>
        )}
      </button>
      
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">W</div>
            <span>WBES</span>
          </div>
          <button className="collapse-btn" onClick={() => {
            const next = !collapsed
            setCollapsed(next)
            try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)) } catch {}
          }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            )}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
            <span className="label">Dashboard</span>
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 7c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2 3c-1.48 0-4.5.75-4.5 2.25V14h9v-1.75C18.5 10.75 15.48 10 14 10z"/>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span className="label">Users</span>
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
            <span className="label">Leads</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <span className="label">Projects</span>
          </NavLink>
          {user?.roles?.some(r => ['estimation_engineer','manager','admin'].includes(r)) && (
            <NavLink to="/quotations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 2h9a3 3 0 013 3v14a3 3 0 01-3 3H6a3 3 0 01-3-3V5a3 3 0 013-3zm2 5h7v2H8V7zm0 4h7v2H8v-2zm0 4h5v2H8v-2z"/>
              </svg>
              <span className="label">Quotations</span>
            </NavLink>
          )}
          {user?.roles?.some(r => ['estimation_engineer','manager','admin'].includes(r)) && (
            <NavLink to="/revisions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 4h9a3 3 0 013 3v11a3 3 0 01-3 3H5a3 3 0 01-3-3V7a3 3 0 013-3zm2 4h7v2H7V8zm0 4h7v2H7v-2zm0 4h5v2H7v-2z"/>
              </svg>
              <span className="label">Revisions</span>
            </NavLink>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0)}</div>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.roles?.join(', ')}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            <span className="label">Logout</span>
          </button>
        </div>
      </div>
      
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <header className="header">
          <div className="header-left">
            <h1>
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'users' && 'User Management'}
            {activeTab === 'leads' && 'Lead Management'}
            {activeTab === 'projects' && 'Project Management'}
            {activeTab === 'quotations' && 'Quotation Management'}
            {activeTab === 'revisions' && 'Revisions Management'}
          </h1>
            <p>Welcome back, {user?.name}!</p>
          </div>
          <div className="header-right">
            <div className="user-profile">
              <div className="avatar">{user?.name?.charAt(0)}</div>
              <span>{user?.name}</span>
            </div>
          </div>
        </header>
        
        <div className="content">
          {activeTab === 'dashboard' && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon users">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 7c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2 3c-1.48 0-4.5.75-4.5 2.25V14h9v-1.75C18.5 10.75 15.48 10 14 10z"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>{stats.totalUsers.toLocaleString()}</h3>
                    <p>Total Users</p>
                    <span className="stat-change positive">+{stats.growth}%</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon revenue">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>AED {stats.revenue.toLocaleString()}</h3>
                    <p>Revenue</p>
                    <span className="stat-change positive">+8.2%</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon orders">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7Z"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>{stats.orders}</h3>
                    <p>Orders</p>
                    <span className="stat-change negative">-2.1%</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon growth">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>{stats.growth}%</h3>
                    <p>Growth Rate</p>
                    <span className="stat-change positive">+1.8%</span>
                  </div>
                </div>
              </div>
              
              <div className="charts-section">
                <div className="chart-card">
                  <h3>Revenue Overview</h3>
                  <div className="chart-placeholder">
                    <div className="chart-bars">
                      <div className="bar" style={{height: '60%'}}></div>
                      <div className="bar" style={{height: '80%'}}></div>
                      <div className="bar" style={{height: '45%'}}></div>
                      <div className="bar" style={{height: '90%'}}></div>
                      <div className="bar" style={{height: '70%'}}></div>
                      <div className="bar" style={{height: '85%'}}></div>
                    </div>
                  </div>
                </div>
                
                <div className="activity-card">
                  <h3>Recent Activity</h3>
                  <div className="activity-list">
                    <div className="activity-item">
                      <div className="activity-icon">👤</div>
                      <div className="activity-content">
                        <p>New user registered</p>
                        <span>2 minutes ago</span>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-icon">💰</div>
                      <div className="activity-content">
                        <p>Payment received</p>
                        <span>5 minutes ago</span>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-icon">📦</div>
                      <div className="activity-content">
                        <p>Order completed</p>
                        <span>10 minutes ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'leads' && <LeadManagement />}
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'quotations' && <QuotationManagement />}
          {activeTab === 'revisions' && <RevisionManagement />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard