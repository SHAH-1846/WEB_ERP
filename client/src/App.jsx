import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './lib/api'
import './App.css'
import logo from './assets/logo/WBES_Logo.png'
import Dashboard from './components/Dashboard'
import LeadDetail from './components/LeadDetail'
import QuotationDetail from './components/QuotationDetail'
import RevisionDetail from './components/RevisionDetail'
import ProjectDetail from './components/ProjectDetail'
import VariationDetail from './components/VariationDetail'
import SiteVisitDetail from './components/SiteVisitDetail'
import SiteVisitFormPage from './components/SiteVisitFormPage'
import QuotationModal from './components/QuotationModal'
import QuotationFormPage from './components/QuotationFormPage'
import LeadFormPage from './components/LeadFormPage'
import { initTheme, setTheme } from './utils/theme'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      window.location.href = '/dashboard'
      return
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    setTheme(isDark)
  }, [isDark])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password
      })
      
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      window.location.href = '/dashboard'
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`app ${mounted ? 'mounted' : ''}`}>
      <div className="bg-animation">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
        <div className="toggle-icon">
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
            </svg>
          )}
        </div>
      </button>
      
      <div className="container">
        <div className="login-card">
          <div className="card-glow"></div>
          
          <div className="logo-section">
            <div className="logo-container">
              <img src={logo} alt="WBES Logo" className="logo" />
            </div>
            <h1 className="brand-title">WBES</h1>
          </div>
          
          <div className="header">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your account</p>
          </div>
          
          <form onSubmit={handleSubmit} className="form">
            <div className={`input-wrapper ${emailFocused || email ? 'focused' : ''}`}>
              <label>Email</label>
              <div className="input-container">
                <svg className="input-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/>
                  <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                />
              </div>
            </div>
            
            <div className={`input-wrapper ${passwordFocused || password ? 'focused' : ''}`}>
              <label>Password</label>
              <div className="input-container">
                <svg className="input-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd"/>
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z"/>
                      <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z"/>
                      <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 016.75 12z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="options">
              <label className="checkbox-wrapper">
                <input type="checkbox" />
                <span className="checkmark"></span>
                Remember me
              </label>
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" className="submit-btn" disabled={isLoading}>
              <span className="btn-text">{isLoading ? 'Signing in...' : 'Sign In'}</span>
              {isLoading && <div className="btn-spinner"></div>}
              <div className="btn-bg"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/leads" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/revisions" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/quotations" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/project-variations" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/audit-logs" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/lead-detail" element={
          <ProtectedRoute>
            <LeadDetail />
          </ProtectedRoute>
        } />
        <Route path="/quotation-detail" element={
          <ProtectedRoute>
            <QuotationDetail />
          </ProtectedRoute>
        } />
        <Route path="/revision-detail" element={
          <ProtectedRoute>
            <RevisionDetail />
          </ProtectedRoute>
        } />
        <Route path="/project-detail" element={
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        } />
        <Route path="/variation-detail" element={
          <ProtectedRoute>
            <VariationDetail />
          </ProtectedRoute>
        } />
        <Route path="/site-visit-detail" element={
          <ProtectedRoute>
            <SiteVisitDetail />
          </ProtectedRoute>
        } />
        <Route path="/leads/create-quotation/:leadId" element={
          <ProtectedRoute>
            <QuotationFormPage />
          </ProtectedRoute>
        } />
        <Route path="/leads/create-quotation" element={
          <ProtectedRoute>
            <QuotationFormPage />
          </ProtectedRoute>
        } />
        <Route path="/quotations/create" element={
          <ProtectedRoute>
            <QuotationFormPage />
          </ProtectedRoute>
        } />
        <Route path="/quotations/edit/:quotationId" element={
          <ProtectedRoute>
            <QuotationFormPage />
          </ProtectedRoute>
        } />
        <Route path="/leads/create" element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        } />
        <Route path="/leads/edit/:leadId" element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        } />
        <Route path="/leads/:leadId/site-visits/create" element={
          <ProtectedRoute>
            <SiteVisitFormPage />
          </ProtectedRoute>
        } />
        <Route path="/leads/:leadId/site-visits/edit/:visitId" element={
          <ProtectedRoute>
            <SiteVisitFormPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/site-visits/create" element={
          <ProtectedRoute>
            <SiteVisitFormPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/site-visits/edit/:visitId" element={
          <ProtectedRoute>
            <SiteVisitFormPage />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  )
}

export default App