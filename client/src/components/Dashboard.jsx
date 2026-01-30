import { useState, useEffect } from 'react'
import { useLocation, useNavigate, NavLink, Routes, Route, useParams } from 'react-router-dom'
import './Dashboard.css'
import UserManagement from './UserManagement'
import LeadManagement from './LeadManagement'
import ProjectManagement from './ProjectManagement'
import QuotationManagement from './QuotationManagement'
import RevisionManagement from './RevisionManagement'
import ProjectVariationManagement from './ProjectVariationManagement'
import UnifiedAuditLogs from './UnifiedAuditLogs'
import QuotationModal from './QuotationModal'
import EstimationsDashboard from './EstimationsDashboard'
import InventoryManagement from './InventoryManagement'
import Settings from './Settings'
import MaterialRequestManagement from './MaterialRequestManagement'
import PurchaseOrderManagement from './PurchaseOrderManagement'
import { initTheme, setTheme } from '../utils/theme'
import { api } from '../lib/api'

function Dashboard() {
  const [user, setUser] = useState(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false') } catch { return false }
  })
  const [estimationsAccordionOpen, setEstimationsAccordionOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('estimationsAccordionOpen') || 'true') } catch { return true }
  })
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })
  const location = useLocation()
  const navigate = useNavigate()
  
  // Check if we're on a modal route with background location
  const isModalRoute = location.pathname.includes('/create-quotation/')
  const backgroundLocation = location.state?.backgroundLocation
  
  // Use background location for main content when modal is open, otherwise use current location
  const mainContentLocation = backgroundLocation || location
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState({
    totalUsers: 1247,
    revenue: 89432,
    orders: 342,
    growth: 12.5
  })
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    try {
      const userDataStr = localStorage.getItem('user')
      const userData = userDataStr ? JSON.parse(userDataStr) : null
      setUser(userData)
    } catch (error) {
      console.error('Error loading user data:', error)
      setUser(null)
    }
    
    // When modal route is active, use backgroundLocation to determine activeTab
    // This ensures the Leads list stays visible behind the modal
    if (isModalRoute && backgroundLocation) {
      const pathSegments = backgroundLocation.pathname.split('/').filter(Boolean)
      const basePath = pathSegments[0] || 'dashboard'
      if (['dashboard','users','estimations-dashboard','leads','projects','quotations','revisions','project-variations','audit-logs','inventory','settings','material-requests','purchase-orders'].includes(basePath)) {
        setActiveTab(basePath)
      }
    } else if (isModalRoute && !backgroundLocation) {
      // Fallback: if modal route but no backgroundLocation, try to extract from current path
      // This handles cases where backgroundLocation might not be set
      if (location.pathname.includes('/leads/create-quotation/')) {
        setActiveTab('leads')
      } else {
        const pathSegments = location.pathname.split('/').filter(Boolean)
        const basePath = pathSegments[0] || 'dashboard'
        if (['dashboard','users','estimations-dashboard','leads','projects','quotations','revisions','project-variations','audit-logs','settings','material-requests','purchase-orders'].includes(basePath)) {
          setActiveTab(basePath)
        }
      }
    } else {
      // Normal navigation - use current pathname
      const pathSegments = location.pathname.split('/').filter(Boolean)
      const basePath = pathSegments[0] || 'dashboard'
      if (['dashboard','users','estimations-dashboard','leads','projects','quotations','revisions','project-variations','audit-logs','inventory','settings','material-requests','purchase-orders'].includes(basePath)) {
        setActiveTab(basePath)
      }
    }
  }, [location.pathname, backgroundLocation, isModalRoute])

  useEffect(() => {
    setTheme(isDark)
  }, [isDark])

  const handleLogout = () => {
    setShowLogoutModal(true)
  }

  const confirmLogout = async () => {
    try {
      // Call logout endpoint to log the action
      try {
        await api.post('/api/auth/logout')
      } catch (error) {
        // Don't block logout if API call fails
        console.error('Error calling logout endpoint:', error)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear local storage and redirect
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
  }

  return (
    <div className="dashboard">
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
          
          {/* Estimations Module Accordion - Only for Admins and Managers */}
          {(user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <div className="accordion-section">
              <button
                className={`accordion-header ${estimationsAccordionOpen ? 'open' : ''}`}
                onClick={() => {
                  const next = !estimationsAccordionOpen
                  setEstimationsAccordionOpen(next)
                  try { localStorage.setItem('estimationsAccordionOpen', JSON.stringify(next)) } catch {}
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <span className="label">Estimations Module</span>
                <svg 
                  className="accordion-arrow" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  style={{ 
                    transform: estimationsAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    marginLeft: 'auto'
                  }}
                >
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                </svg>
              </button>
              <div className={`accordion-content ${estimationsAccordionOpen ? 'open' : ''}`}>
                <NavLink to="/estimations-dashboard" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                  <span className="label">Estimations Dashboard</span>
                </NavLink>
                <NavLink to="/leads" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                  <span className="label">Leads</span>
                </NavLink>
                <NavLink to="/quotations" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 2h9a3 3 0 013 3v14a3 3 0 01-3 3H6a3 3 0 01-3-3V5a3 3 0 013-3zm2 5h7v2H8V7zm0 4h7v2H8v-2zm0 4h5v2H8v-2z"/>
                  </svg>
                  <span className="label">Quotations</span>
                </NavLink>
                <NavLink to="/revisions" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 4h9a3 3 0 013 3v11a3 3 0 01-3 3H5a3 3 0 01-3-3V7a3 3 0 013-3zm2 4h7v2H7V8zm0 4h7v2H7v-2zm0 4h5v2H7v-2z"/>
                  </svg>
                  <span className="label">Revisions</span>
                </NavLink>
                <NavLink to="/projects" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                  <span className="label">Projects</span>
                </NavLink>
                <NavLink to="/project-variations" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-4v-4H5v-4h4V5h4v4h4v4z"/>
                  </svg>
                  <span className="label">Project Variations</span>
                </NavLink>
              </div>
            </div>
          )}
          
          {/* Show Leads separately for non-admin/manager users */}
          {!(user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <NavLink to="/leads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              <span className="label">Leads</span>
            </NavLink>
          )}
          
          {/* Show Quotations, Revisions, Projects, Project Variations for estimation engineers (not in accordion) */}
          {user?.roles?.some(r => ['estimation_engineer'].includes(r)) && !(user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <>
              <NavLink to="/quotations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2h9a3 3 0 013 3v14a3 3 0 01-3 3H6a3 3 0 01-3-3V5a3 3 0 013-3zm2 5h7v2H8V7zm0 4h7v2H8v-2zm0 4h5v2H8v-2z"/>
                </svg>
                <span className="label">Quotations</span>
              </NavLink>
              <NavLink to="/revisions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 4h9a3 3 0 013 3v11a3 3 0 01-3 3H5a3 3 0 01-3-3V7a3 3 0 013-3zm2 4h7v2H7V8zm0 4h7v2H7v-2zm0 4h5v2H7v-2z"/>
                </svg>
                <span className="label">Revisions</span>
              </NavLink>
              <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <span className="label">Projects</span>
              </NavLink>
              <NavLink to="/project-variations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-4v-4H5v-4h4V5h4v4h4v4z"/>
                </svg>
                <span className="label">Project Variations</span>
              </NavLink>
            </>
          )}
          
          {/* Show Projects for other users (not in accordion for non-admin/manager, excluding estimation engineers) */}
          {!(user?.roles?.includes('admin') || user?.roles?.includes('manager') || user?.roles?.includes('estimation_engineer')) && (
            <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              <span className="label">Projects</span>
            </NavLink>
          )}
          {(user?.roles?.includes('manager') || user?.roles?.includes('admin') || user?.roles?.includes('estimation_engineer') || user?.roles?.includes('sales_engineer') || user?.roles?.includes('project_engineer')) && (
            <NavLink to="/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <span className="label">Audit Logs</span>
            </NavLink>
          )}
          {/* Inventory Management - for inventory_manager and store_keeper roles */}
          {(user?.roles?.includes('inventory_manager') || user?.roles?.includes('store_keeper')) && (
            <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/>
              </svg>
              <span className="label">Inventory</span>
            </NavLink>
          )}
          {/* Settings - for admin and manager roles */}
          {(user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              <span className="label">Settings</span>
            </NavLink>
          )}
          {/* Material Requests - for admin, manager, inventory_manager, project_engineer */}
          {(user?.roles?.includes('admin') || user?.roles?.includes('manager') || user?.roles?.includes('inventory_manager') || user?.roles?.includes('project_engineer')) && (
            <NavLink to="/material-requests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
              </svg>
              <span className="label">Material Requests</span>
            </NavLink>
          )}
          {/* Purchase Orders - for inventory_manager and procurement_engineer */}
          {(user?.roles?.includes('inventory_manager') || user?.roles?.includes('procurement_engineer') || user?.roles?.includes('admin') || user?.roles?.includes('manager')) && (
            <NavLink to="/purchase-orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 10H8v-2h8v2zm0-4H8V7h8v2z"/>
              </svg>
              <span className="label">Purchase Orders</span>
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
            <div>
              <h1>
              {activeTab === 'dashboard' && (
                (user?.roles?.includes('estimation_engineer') || user?.roles?.includes('sales_engineer') || user?.roles?.includes('project_engineer'))
                  ? 'Estimations Dashboard'
                  : 'Dashboard'
              )}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'leads' && 'Lead Management'}
              {activeTab === 'projects' && 'Project Management'}
              {activeTab === 'quotations' && 'Quotation Management'}
              {activeTab === 'revisions' && 'Revisions Management'}
              {activeTab === 'audit-logs' && 'Audit Logs'}
              {activeTab === 'project-variations' && 'Project Variations'}
              {activeTab === 'inventory' && 'Inventory Management'}
              {activeTab === 'settings' && 'Settings'}
              {activeTab === 'material-requests' && 'Material Requests'}
              {activeTab === 'purchase-orders' && 'Purchase Orders'}
            </h1>
              <p>Welcome back, {user?.name}!</p>
            </div>
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
              {/* Show Estimations Dashboard for Estimation Engineers, Sales Engineers, and Project Engineers */}
              {(user?.roles?.includes('estimation_engineer') || user?.roles?.includes('sales_engineer') || user?.roles?.includes('project_engineer')) ? (
                <EstimationsDashboard />
              ) : (
                <>
                  {/* Show Default Dashboard for Admins and Managers (and other roles) */}
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
            </>
          )}
          
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'estimations-dashboard' && <EstimationsDashboard />}
          {activeTab === 'leads' && <LeadManagement />}
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'quotations' && <QuotationManagement />}
          {activeTab === 'revisions' && <RevisionManagement />}
          {activeTab === 'project-variations' && <ProjectVariationManagement />}
          {activeTab === 'audit-logs' && <UnifiedAuditLogs />}
          {activeTab === 'inventory' && <InventoryManagement />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'material-requests' && <MaterialRequestManagement />}
          {activeTab === 'purchase-orders' && <PurchaseOrderManagement />}
        </div>
      </div>
      
      {/* Modal Routes - render on top of main content when background location exists */}
      {isModalRoute && (
        <Routes location={location}>
          <Route path="/leads/create-quotation/:leadId" element={<QuotationModal />} />
        </Routes>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ zIndex: 10001 }}>
            <div className="modal-header">
              <h2>Confirm Logout</h2>
              <button onClick={() => setShowLogoutModal(false)} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to logout?</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowLogoutModal(false)}>
                  Cancel
                </button>
                <button type="button" className="reject-btn" onClick={confirmLogout}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard