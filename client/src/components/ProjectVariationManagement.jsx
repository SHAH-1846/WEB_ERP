import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../lib/api'
import './LeadManagement.css'
import './LoadingComponents.css'
import logo from '../assets/logo/WBES_Logo.png'
import { 
  Spinner, 
  Skeleton, 
  SkeletonCard, 
  SkeletonTableRow, 
  PageSkeleton, 
  ButtonLoader,
  DotsLoader 
} from './LoadingComponents'

function ProjectVariationManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [variations, setVariations] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('createdAt_desc')
  // New filter states
  const [nameFilter, setNameFilter] = useState('')
  const [dateModifiedFilter, setDateModifiedFilter] = useState('')
  const [dateCreatedFilter, setDateCreatedFilter] = useState('')
  // New sort states
  const [sortField, setSortField] = useState('dateCreated') // 'name', 'dateModified', 'dateCreated'
  const [sortDirection, setSortDirection] = useState('desc') // 'asc', 'desc'
  const [editModal, setEditModal] = useState({ open: false, variation: null, form: null, mode: 'edit' })
  const [createVariationModal, setCreateVariationModal] = useState({ open: false, variation: null, form: null })
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, variation: null })
  const [approvalsView, setApprovalsView] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, variation: null, action: null, note: '' })
  const [sendApprovalConfirmModal, setSendApprovalConfirmModal] = useState({ open: false, variation: null })
  const [diffModal, setDiffModal] = useState({ open: false, variation: null })
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('variationViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null) // Track which action is loading
  const [isFiltering, setIsFiltering] = useState(false) // Track filter operations
  const [filtersExpanded, setFiltersExpanded] = useState(false) // Mobile: collapsible filters
  const [isMobile, setIsMobile] = useState(false) // Track mobile viewport
  const [headerHeight, setHeaderHeight] = useState(80) // Header height for sticky positioning
  const headerRef = useRef(null)
  // Debounced filter values for performance
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('')
  const [debouncedDateModifiedFilter, setDebouncedDateModifiedFilter] = useState('')
  const [debouncedDateCreatedFilter, setDebouncedDateCreatedFilter] = useState('')

  // Detect mobile viewport and measure header height
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Auto-expand filters on desktop
      if (window.innerWidth >= 768) {
        setFiltersExpanded(true)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Measure header height for sticky positioning
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight)
      }
    }
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      updateHeaderHeight()
    })
    window.addEventListener('resize', updateHeaderHeight)
    return () => window.removeEventListener('resize', updateHeaderHeight)
  }, [])

  const defaultCompany = useMemo(() => ({
    logo,
    name: 'WBES',
    address: 'Dubai, UAE',
    phone: '+971-00-000-0000',
    email: 'info@wbes.example'
  }), [])

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user')) || null)
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchVariations(false), fetchProjects()])
      setIsLoading(false)
    }
    void loadData()
  }, [])

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('variationViewMode', viewMode)
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

  const fetchVariations = async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await api.get('/api/project-variations')
      setVariations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching variations:', err)
      setVariations([])
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/projects')
      setProjects(Array.isArray(res.data) ? res.data : [])
    } catch {}
  }

  const sendForApproval = async (variation) => {
    setLoadingAction(`approve-${variation._id}`)
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/project-variations/${variation._id}/approve`, { status: 'pending' })
      await fetchVariations()
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: e.response?.data?.message || 'We could not send for approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const approveVariation = async (variation, status, note) => {
    setLoadingAction(`approve-${variation._id}-${status}`)
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/project-variations/${variation._id}/approve`, { status, note })
      await fetchVariations()
      setApprovalModal({ open: false, variation: null, action: null, note: '' })
      setNotify({ open: true, title: status === 'approved' ? 'Variation Approved' : 'Variation Rejected', message: `The variation has been ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: e.response?.data?.message || 'We could not update approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  // Filter variations
  const filteredVariations = variations.filter(v => {
    // Apply project filter
    if (selectedProjectFilter) {
      const variationProjectId = typeof v.parentProject === 'object' ? v.parentProject?._id : v.parentProject
      if (variationProjectId !== selectedProjectFilter) return false
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (v.offerReference || '').toLowerCase().includes(term) ||
        (v.projectTitle || v.parentProject?.name || '').toLowerCase().includes(term) ||
        (v.lead?.customerName || '').toLowerCase().includes(term) ||
        (v.createdBy?.name || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    // Apply name filter (project name or variation number) - using debounced value
    if (debouncedNameFilter.trim()) {
      const term = debouncedNameFilter.toLowerCase()
      const projectName = (v.parentProject?.name || '').toLowerCase()
      const variationNumber = String(v.variationNumber || '').toLowerCase()
      if (!projectName.includes(term) && !variationNumber.includes(term)) return false
    }
    
    // Apply date modified filter - using debounced value
    if (debouncedDateModifiedFilter) {
      const filterDate = new Date(debouncedDateModifiedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const variationDate = v.updatedAt ? new Date(v.updatedAt) : null
      if (!variationDate || variationDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    // Apply date created filter - using debounced value
    if (debouncedDateCreatedFilter) {
      const filterDate = new Date(debouncedDateCreatedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const variationDate = v.createdAt ? new Date(v.createdAt) : null
      if (!variationDate || variationDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    return true
  })

  // Sort variations by selected field and direction
  const sortedVariations = [...filteredVariations].sort((a, b) => {
    let compareResult = 0
    
    switch (sortField) {
      case 'name':
        // Sort by project name, then variation number
        const aProjectName = (a.parentProject?.name || '').toLowerCase()
        const bProjectName = (b.parentProject?.name || '').toLowerCase()
        const projectNameCompare = aProjectName.localeCompare(bProjectName)
        if (projectNameCompare !== 0) {
          compareResult = projectNameCompare
        } else {
          // If project names are equal, sort by variation number
          const aVarNum = String(a.variationNumber || '').toLowerCase()
          const bVarNum = String(b.variationNumber || '').toLowerCase()
          compareResult = aVarNum.localeCompare(bVarNum, undefined, { numeric: true, sensitivity: 'base' })
        }
        break
      case 'dateModified':
        const aModified = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bModified = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        compareResult = aModified > bModified ? 1 : aModified < bModified ? -1 : 0
        break
      case 'dateCreated':
      default:
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
        compareResult = aCreated > bCreated ? 1 : aCreated < bCreated ? -1 : 0
        break
    }
    
    // Apply sort direction
    return sortDirection === 'asc' ? compareResult : -compareResult
  })

  // Pagination calculations
  const totalPages = Math.ceil(sortedVariations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedVariations = sortedVariations.slice(startIndex, endIndex)

  // Debounce name filter (300ms delay)
  useEffect(() => {
    setIsFiltering(true)
    const timer = setTimeout(() => {
      setDebouncedNameFilter(nameFilter)
      setIsFiltering(false)
    }, 300)
    return () => {
      clearTimeout(timer)
      setIsFiltering(false)
    }
  }, [nameFilter])

  // Date filters don't need debouncing (they're date inputs)
  useEffect(() => {
    setDebouncedDateModifiedFilter(dateModifiedFilter)
  }, [dateModifiedFilter])

  useEffect(() => {
    setDebouncedDateCreatedFilter(dateCreatedFilter)
  }, [dateCreatedFilter])

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedProjectFilter, debouncedNameFilter, debouncedDateModifiedFilter, debouncedDateCreatedFilter, sortField, sortDirection])

  const totalVariations = variations.length
  const displayedVariations = filteredVariations.length

  // Helper function to format field names for display
  const formatFieldName = (field) => {
    const fieldMap = {
      'companyInfo': 'Company Info',
      'submittedTo': 'Submitted To',
      'attention': 'Attention',
      'offerReference': 'Offer Reference',
      'enquiryNumber': 'Enquiry Number',
      'offerDate': 'Offer Date',
      'enquiryDate': 'Enquiry Date',
      'projectTitle': 'Project Title',
      'introductionText': 'Introduction',
      'scopeOfWork': 'Scope of Work',
      'priceSchedule': 'Price Schedule',
      'ourViewpoints': 'Our Viewpoints',
      'exclusions': 'Exclusions',
      'paymentTerms': 'Payment Terms',
      'deliveryCompletionWarrantyValidity': 'Delivery & Warranty'
    }
    return fieldMap[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  }

  // Helper function to get concise diff summary
  const getDiffSummary = (variation) => {
    if (!variation.diffFromParent || !Array.isArray(variation.diffFromParent) || variation.diffFromParent.length === 0) {
      return 'No changes'
    }
    const count = variation.diffFromParent.length
    const fields = variation.diffFromParent.slice(0, 5).map(d => formatFieldName(d.field))
    const more = count > 5 ? `\n+${count - 5} more field${count - 5 > 1 ? 's' : ''}` : ''
    return `${count} change${count > 1 ? 's' : ''}:\n${fields.join(', ')}${more}`
  }

  // Helper function to format history values (same as VariationDetail)
  const formatHistoryValue = (field, value) => {
    // Handle null/undefined
    if (value === null || value === undefined) return '(empty)'
    
    // Handle date strings (from diffFromParent normalization)
    if (['offerDate', 'enquiryDate'].includes(field)) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
      // If it's already a Date object or ISO string
      if (value instanceof Date || (typeof value === 'string' && value.includes('T'))) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
      // If it's a number (timestamp)
      if (typeof value === 'number') {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
    }
    
    // Handle arrays first (before string check, as arrays might be serialized)
    if (Array.isArray(value)) {
      if (value.length === 0) return '(empty)'
      
      if (field === 'paymentTerms') {
        return value.map((t, i) => {
          if (typeof t === 'string') return `${i + 1}. ${t}`
          if (!t || typeof t !== 'object') return `${i + 1}. ${String(t)}`
          return `${i + 1}. ${t?.milestoneDescription || '-'} — ${t?.amountPercent ?? ''}%`
        }).join('\n')
      }
      
      if (field === 'scopeOfWork') {
        return value.map((s, i) => {
          if (typeof s === 'string') return `${i + 1}. ${s}`
          if (!s || typeof s !== 'object') return `${i + 1}. ${String(s)}`
          const qtyUnit = [s?.quantity ?? '', s?.unit || ''].filter(x => String(x).trim().length > 0).join(' ')
          const remarks = s?.locationRemarks ? ` — ${s.locationRemarks}` : ''
          return `${i + 1}. ${s?.description || '-'}${qtyUnit ? ` — Qty: ${qtyUnit}` : ''}${remarks}`
        }).join('\n')
      }
      
      if (field === 'exclusions') {
        return value.map((v, i) => `${i + 1}. ${String(v)}`).join('\n')
      }
      
      // Generic array handling
      return value.map((v, i) => {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          return `${i + 1}. ${String(v)}`
        }
        if (v && typeof v === 'object') {
          const parts = Object.entries(v).map(([k, val]) => `${k}: ${val}`)
          return `${i + 1}. ${parts.join(', ')}`
        }
        return `${i + 1}. ${String(v)}`
      }).join('\n')
    }
    
    // Handle objects (before string check)
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      if (field === 'priceSchedule') {
        const ps = value || {}
        const lines = []
        if (ps?.currency) lines.push(`Currency: ${ps.currency}`)
        const items = Array.isArray(ps?.items) ? ps.items : []
        if (items.length > 0) {
          lines.push('Items:')
          items.forEach((it, i) => {
            const qtyUnit = [it?.quantity ?? '', it?.unit || ''].filter(x => String(x).trim().length > 0).join(' ')
            const unitRate = (it?.unitRate ?? '') !== '' ? ` x ${it.unitRate}` : ''
            const amount = (it?.totalAmount ?? '') !== '' ? ` = ${it.totalAmount}` : ''
            lines.push(`  ${i + 1}. ${it?.description || '-'}${qtyUnit ? ` — Qty: ${qtyUnit}` : ''}${unitRate}${amount}`)
          })
        }
        if (ps?.subTotal !== undefined && ps?.subTotal !== null) lines.push(`Sub Total: ${ps.subTotal}`)
        if (ps?.taxDetails) {
          const rate = ps?.taxDetails?.vatRate ?? ''
          const amt = ps?.taxDetails?.vatAmount ?? ''
          if (rate !== '' || amt !== '') {
            lines.push(`VAT: ${rate}%${amt !== '' ? ` = ${amt}` : ''}`)
          }
        }
        if (ps?.grandTotal !== undefined && ps?.grandTotal !== null) lines.push(`Grand Total: ${ps.grandTotal}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      if (field === 'deliveryCompletionWarrantyValidity') {
        const d = value || {}
        const lines = []
        if (d?.deliveryTimeline) lines.push(`Delivery Timeline: ${d.deliveryTimeline}`)
        if (d?.warrantyPeriod) lines.push(`Warranty Period: ${d.warrantyPeriod}`)
        if (d?.offerValidity !== undefined && d?.offerValidity !== null) lines.push(`Offer Validity: ${d.offerValidity} days`)
        if (d?.authorizedSignatory) lines.push(`Authorized Signatory: ${d.authorizedSignatory}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      if (field === 'companyInfo') {
        const ci = value || {}
        const lines = []
        if (ci?.name) lines.push(`Name: ${ci.name}`)
        if (ci?.address) lines.push(`Address: ${ci.address}`)
        if (ci?.phone) lines.push(`Phone: ${ci.phone}`)
        if (ci?.email) lines.push(`Email: ${ci.email}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      // Generic object handling
      const entries = Object.entries(value).map(([k, v]) => {
        if (v === null || v === undefined) return `${k}: (empty)`
        if (typeof v === 'object') {
          try {
            return `${k}: ${JSON.stringify(v, null, 2)}`
          } catch {
            return `${k}: ${String(v)}`
          }
        }
        return `${k}: ${String(v)}`
      })
      return entries.length > 0 ? entries.join('\n') : '(empty)'
    }
    
    // Handle primitive types
    if (typeof value === 'string') {
      // Try to parse JSON string if value looks like JSON
      if ((value.startsWith('{') || value.startsWith('[')) && value.length > 1) {
        try {
          const parsed = JSON.parse(value)
          // Recursively format the parsed value
          return formatHistoryValue(field, parsed)
        } catch {
          // Not valid JSON, return as string
          return value.trim() || '(empty)'
        }
      }
      return value.trim() || '(empty)'
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    
    // Fallback - try to stringify
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value) || '(empty)'
    }
  }

  return (
    <div className="lead-management">
      <div className="header" ref={headerRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1>Project Variations</h1>
          {selectedProjectFilter && (() => {
            const selectedProject = projects.find(p => p._id === selectedProjectFilter)
            return selectedProject ? (
              <button 
                className="link-btn" 
                onClick={() => {
                  try {
                    localStorage.setItem('projectsFocusId', selectedProject._id)
                    localStorage.setItem('projectId', selectedProject._id)
                  } catch {}
                  window.location.href = '/project-detail'
                }}
                style={{ 
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '4px 8px'
                }}
              >
                View Project: {selectedProject.name}
              </button>
            ) : null
          })()}
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(search || selectedProjectFilter) ? `${displayedVariations} of ${totalVariations}` : totalVariations} {totalVariations === 1 ? 'Variation' : 'Variations'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="">All Projects</option>
            {projects.map(proj => (
              <option key={proj._id} value={proj._id}>
                {proj.name}
              </option>
            ))}
          </select>
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
              }}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Sorting Section - Sticky */}
      <div style={{ 
        position: 'sticky',
        top: `${headerHeight}px`,
        zIndex: 99,
        marginTop: '16px',
        marginBottom: '16px',
        padding: '16px', 
        background: 'var(--card)', 
        borderRadius: '8px', 
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignSelf: 'flex-start',
        width: '100%'
      }}>
        {/* Mobile: Collapsible Header */}
        {isMobile && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Filters & Sorting</h3>
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
              aria-expanded={filtersExpanded}
              aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
            >
              {filtersExpanded ? '▼' : '▶'} {filtersExpanded ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        )}
        
        {/* Filter Content - Hidden on mobile when collapsed */}
        {(!isMobile || filtersExpanded) && (
          <>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative' }}>
              {isFiltering && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  background: 'var(--card)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  zIndex: 1
                }}>
                  <DotsLoader />
                  <span>Filtering...</span>
                </div>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
                Filter by Name:
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input 
                    type="text"
                    placeholder="Project name or variation number..."
                    value={nameFilter} 
                    onChange={e => setNameFilter(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '14px',
                      minWidth: isMobile ? '100%' : '200px',
                      width: isMobile ? '100%' : 'auto'
                    }}
                    aria-label="Filter by project name or variation number"
                  />
                </div>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
                Filter by Date Modified:
                <input 
                  type="date"
                  value={dateModifiedFilter} 
                  onChange={e => setDateModifiedFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    minWidth: isMobile ? '100%' : '160px',
                    width: isMobile ? '100%' : 'auto'
                  }}
                  aria-label="Filter by date modified"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
                Filter by Date Created:
                <input 
                  type="date"
                  value={dateCreatedFilter} 
                  onChange={e => setDateCreatedFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    minWidth: isMobile ? '100%' : '160px',
                    width: isMobile ? '100%' : 'auto'
                  }}
                  aria-label="Filter by date created"
                />
              </label>
              {(nameFilter || dateModifiedFilter || dateCreatedFilter) && (
                <button
                  onClick={() => {
                    setNameFilter('')
                    setDateModifiedFilter('')
                    setDateCreatedFilter('')
                  }}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: isMobile ? '8px' : '20px',
                    alignSelf: isMobile ? 'stretch' : 'flex-end',
                    width: isMobile ? '100%' : 'auto'
                  }}
                  aria-label="Clear all filters"
                >
                  Clear Filters
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
                Sort by:
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: isMobile ? '100%' : '150px',
                    width: isMobile ? '100%' : 'auto',
                    flex: isMobile ? '1' : '0 0 auto'
                  }}
                  aria-label="Sort by field"
                >
                  <option value="name">Name</option>
                  <option value="dateModified">Date Modified</option>
                  <option value="dateCreated">Date Created</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
                Order:
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: isMobile ? '100%' : '120px',
                    width: isMobile ? '100%' : 'auto',
                    flex: isMobile ? '1' : '0 0 auto'
                  }}
                  aria-label="Sort order"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          </>
        )}
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
                  <th>Variation #</th>
                  <th>Project</th>
                  <th>Offer Ref</th>
                  <th>Status</th>
                  <th>Grand Total</th>
                  <th>Changes</th>
                  <th>Created By</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <SkeletonTableRow key={idx} columns={9} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : viewMode === 'card' ? (
        <div className="leads-grid">
          {paginatedVariations.map(v => (
            <div key={v._id} className="lead-card">
              <div className="lead-header">
                <h3>
                  <button
                    className="link-btn"
                    onClick={() => {
                      if (v.parentProject?._id) {
                        try {
                          localStorage.setItem('projectsFocusId', v.parentProject._id)
                          localStorage.setItem('projectId', v.parentProject._id)
                        } catch {}
                        window.location.href = '/project-detail'
                      }
                    }}
                    style={{
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      padding: 0,
                      textDecoration: 'underline',
                      cursor: v.parentProject?._id ? 'pointer' : 'default'
                    }}
                  >
                    Variation {v.variationNumber}
                  </button>
                </h3>
                <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : v.managementApproval?.status === 'pending' ? 'blue' : 'draft'}`}>
                  {v.managementApproval?.status || 'draft'}
                </span>
              </div>
              <div className="lead-details">
                <p><strong>Project:</strong> {v.parentProject?.name || 'N/A'}</p>
                <p><strong>Offer Ref:</strong> {v.offerReference || 'N/A'}</p>
                <p><strong>Grand Total:</strong> {(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
                {v.diffFromParent && Array.isArray(v.diffFromParent) && v.diffFromParent.length > 0 && (
                  <p>
                    <strong>Changes:</strong>
                    <span 
                      className="status-badge" 
                      style={{ 
                        marginLeft: '8px', 
                        background: '#DBEAFE', 
                        color: '#1E40AF', 
                        border: '1px solid #93C5FD',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        userSelect: 'none'
                      }}
                      title="Click to view full changes"
                      onClick={() => setDiffModal({ open: true, variation: v })}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#BFDBFE'
                        e.target.style.transform = 'scale(1.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#DBEAFE'
                        e.target.style.transform = 'scale(1)'
                      }}
                    >
                      {v.diffFromParent.length} change{v.diffFromParent.length > 1 ? 's' : ''}
                    </span>
                  </p>
                )}
                <p><strong>Created By:</strong> {v.createdBy?._id === currentUser?.id ? 'You' : (v.createdBy?.name || 'N/A')}
                  {v.createdBy?._id !== currentUser?.id && v.createdBy && (
                    <button className="link-btn" onClick={() => setProfileUser(v.createdBy)} style={{ marginLeft: '6px' }}>
                      View Profile
                    </button>
                  )}
                </p>
                <p><strong>Created At:</strong> {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="lead-actions">
                <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View Details</button>
                {v.managementApproval?.status === 'pending' ? (
                  <span className="status-badge blue" style={{ marginLeft: '8px' }}>Approval Pending</span>
                ) : (
                  (v.managementApproval?.status !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id)) && (
                    <button 
                  className="save-btn" 
                  onClick={() => setSendApprovalConfirmModal({ open: true, variation: v })} 
                  style={{ marginLeft: '8px' }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === `approve-${v._id}`}>
                    Send for Approval
                  </ButtonLoader>
                </button>
                  )
                )}
                <button className="link-btn" onClick={() => setApprovalsView(v)} style={{ marginLeft: '8px' }}>View Approvals/Rejections</button>
                {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && v.managementApproval?.status === 'pending' && (
                  <>
                    <button 
                      className="approve-btn" 
                      onClick={() => setApprovalModal({ open: true, variation: v, action: 'approved', note: '' })} 
                      style={{ marginLeft: '8px' }}
                      disabled={isSubmitting}
                    >
                      <ButtonLoader loading={loadingAction === `approve-${v._id}-approved`}>
                        Approve
                      </ButtonLoader>
                    </button>
                    <button 
                      className="reject-btn" 
                      onClick={() => setApprovalModal({ open: true, variation: v, action: 'rejected', note: '' })} 
                      style={{ marginLeft: '8px' }}
                      disabled={isSubmitting}
                    >
                      <ButtonLoader loading={loadingAction === `approve-${v._id}-rejected`}>
                        Reject
                      </ButtonLoader>
                    </button>
                  </>
                )}
                {v.managementApproval?.status === 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id) && (
                  <button className="save-btn" onClick={async () => {
                    try {
                      // Check if a child variation already exists
                      const res = await api.get(`/api/project-variations?parentVariation=${v._id}`)
                      const childVariations = res.data
                      if (Array.isArray(childVariations) && childVariations.length > 0) {
                        setNotify({ open: true, title: 'Not Allowed', message: 'A child variation already exists for this variation.' })
                        return
                      }
                      // Open create variation modal with pre-populated form
                      const originalOfferDate = v.offerDate ? String(v.offerDate).slice(0,10) : ''
                      const originalEnquiryDate = v.enquiryDate ? String(v.enquiryDate).slice(0,10) : ''
                      setCreateVariationModal({ open: true, variation: v, form: {
                        companyInfo: v.companyInfo || {},
                        submittedTo: v.submittedTo || '',
                        attention: v.attention || '',
                        offerReference: v.offerReference || '',
                        enquiryNumber: v.enquiryNumber || '',
                        offerDate: originalOfferDate,
                        enquiryDate: originalEnquiryDate,
                        projectTitle: v.projectTitle || v.lead?.projectTitle || v.parentProject?.name || '',
                        introductionText: v.introductionText || '',
                        scopeOfWork: v.scopeOfWork?.length ? v.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
                        priceSchedule: v.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
                        ourViewpoints: v.ourViewpoints || '',
                        exclusions: v.exclusions?.length ? v.exclusions : [''],
                        paymentTerms: v.paymentTerms?.length ? v.paymentTerms : [{ milestoneDescription: '', amountPercent: ''}],
                        deliveryCompletionWarrantyValidity: v.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
                      } })
                    } catch (e) {
                      setNotify({ open: true, title: 'Error', message: 'Could not check for existing child variations. Please try again.' })
                    }
                  }} style={{ marginLeft: '8px' }}>Create Another Variation</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Variation #</th>
                <th>Project</th>
                <th>Offer Ref</th>
                <th>Status</th>
                <th>Grand Total</th>
                <th>Changes</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVariations.map(v => (
                <tr key={v._id}>
                  <td data-label="Variation #">
                    {v.parentProject?._id ? (
                      <button
                        className="link-btn"
                        onClick={() => {
                          try {
                            localStorage.setItem('projectsFocusId', v.parentProject._id)
                            localStorage.setItem('projectId', v.parentProject._id)
                          } catch {}
                          window.location.href = '/project-detail'
                        }}
                        style={{
                          fontSize: 'inherit',
                          fontWeight: 600,
                          padding: 0,
                          textDecoration: 'underline'
                        }}
                      >
                        {v.variationNumber}
                      </button>
                    ) : (
                      v.variationNumber
                    )}
                  </td>
                  <td data-label="Project">{v.parentProject?.name || 'N/A'}</td>
                  <td data-label="Offer Ref">{v.offerReference || 'N/A'}</td>
                  <td data-label="Status">
                    <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : 'draft'}`}>
                      {v.managementApproval?.status || 'pending'}
                    </span>
                  </td>
                  <td data-label="Grand Total">{(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                  <td data-label="Changes">
                    {v.diffFromParent && Array.isArray(v.diffFromParent) && v.diffFromParent.length > 0 ? (
                      <span 
                        className="status-badge" 
                        style={{ 
                          background: '#DBEAFE', 
                          color: '#1E40AF', 
                          border: '1px solid #93C5FD',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          display: 'inline-block',
                          transition: 'all 0.2s',
                          userSelect: 'none'
                        }}
                        title="Click to view full changes"
                        onClick={() => setDiffModal({ open: true, variation: v })}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#BFDBFE'
                          e.target.style.transform = 'scale(1.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#DBEAFE'
                          e.target.style.transform = 'scale(1)'
                        }}
                      >
                        {v.diffFromParent.length} change{v.diffFromParent.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No changes</span>
                    )}
                  </td>
                  <td data-label="Created By">
                    {v.createdBy?._id === currentUser?.id ? 'You' : (v.createdBy?.name || 'N/A')}
                    {v.createdBy?._id !== currentUser?.id && v.createdBy && (
                      <button className="link-btn" onClick={() => setProfileUser(v.createdBy)} style={{ marginLeft: '6px' }}>
                        View Profile
                      </button>
                    )}
                  </td>
                  <td data-label="Created At">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View</button>
                      {v.managementApproval?.status === 'pending' ? (
                        <span className="status-badge blue">Approval Pending</span>
                      ) : (
                        (v.managementApproval?.status !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id)) && (
                          <button 
                            className="save-btn" 
                            onClick={() => setSendApprovalConfirmModal({ open: true, variation: v })}
                            disabled={isSubmitting}
                          >
                            <ButtonLoader loading={loadingAction === `approve-${v._id}`}>
                              Send for Approval
                            </ButtonLoader>
                          </button>
                        )
                      )}
                      <button className="link-btn" onClick={() => setApprovalsView(v)}>View Approvals/Rejections</button>
                      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && v.managementApproval?.status === 'pending' && (
                        <>
                          <button 
                            className="approve-btn" 
                            onClick={() => setApprovalModal({ open: true, variation: v, action: 'approved', note: '' })}
                            disabled={isSubmitting}
                          >
                            <ButtonLoader loading={loadingAction === `approve-${v._id}-approved`}>
                              Approve
                            </ButtonLoader>
                          </button>
                          <button 
                            className="reject-btn" 
                            onClick={() => setApprovalModal({ open: true, variation: v, action: 'rejected', note: '' })}
                            disabled={isSubmitting}
                          >
                            <ButtonLoader loading={loadingAction === `approve-${v._id}-rejected`}>
                              Reject
                            </ButtonLoader>
                          </button>
                        </>
                      )}
                      {v.managementApproval?.status === 'approved' && (currentUser?.roles?.includes('estimation_engineer') || v.createdBy?._id === currentUser?.id) && (
                        <button className="save-btn" onClick={async () => {
                          try {
                            // Check if a child variation already exists
                            const res = await api.get(`/api/project-variations?parentVariation=${v._id}`)
                            const childVariations = res.data
                            if (Array.isArray(childVariations) && childVariations.length > 0) {
                              setNotify({ open: true, title: 'Not Allowed', message: 'A child variation already exists for this variation.' })
                              return
                            }
                            // Open create variation modal with pre-populated form
                            const originalOfferDate = v.offerDate ? String(v.offerDate).slice(0,10) : ''
                            const originalEnquiryDate = v.enquiryDate ? String(v.enquiryDate).slice(0,10) : ''
                            setCreateVariationModal({ open: true, variation: v, form: {
                              companyInfo: v.companyInfo || {},
                              submittedTo: v.submittedTo || '',
                              attention: v.attention || '',
                              offerReference: v.offerReference || '',
                              enquiryNumber: v.enquiryNumber || '',
                              offerDate: originalOfferDate,
                              enquiryDate: originalEnquiryDate,
                              projectTitle: v.projectTitle || v.lead?.projectTitle || v.parentProject?.name || '',
                              introductionText: v.introductionText || '',
                              scopeOfWork: v.scopeOfWork?.length ? v.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
                              priceSchedule: v.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
                              ourViewpoints: v.ourViewpoints || '',
                              exclusions: v.exclusions?.length ? v.exclusions : [''],
                              paymentTerms: v.paymentTerms?.length ? v.paymentTerms : [{ milestoneDescription: '', amountPercent: ''}],
                              deliveryCompletionWarrantyValidity: v.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
                            } })
                          } catch (e) {
                            setNotify({ open: true, title: 'Error', message: 'Could not check for existing child variations. Please try again.' })
                          }
                        }}>Create Another Variation</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredVariations.length > 0 && (
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
                  const newValue = Number(e.target.value)
                  setItemsPerPage(newValue)
                  setCurrentPage(1)
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--card)',
                  color: 'var(--text)',
                  fontSize: '14px'
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
              Showing {startIndex + 1} to {Math.min(endIndex, sortedVariations.length)} of {sortedVariations.length}
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

      {approvalsView && (
        <div className="modal-overlay history" onClick={() => setApprovalsView(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approvals & Rejections</h2>
              <button onClick={() => setApprovalsView(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {(() => {
                const v = approvalsView
                const rawLogs = Array.isArray(v.managementApproval?.logs) ? v.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
                const cycles = []
                let current = null
                for (const entry of rawLogs) {
                  if (entry.status === 'pending') {
                    if (current) cycles.push(current)
                    current = {
                      requestedAt: entry.at,
                      requestedBy: entry.requestedBy,
                      requestNote: entry.note,
                      decidedAt: null,
                      decidedBy: null,
                      decisionNote: null,
                      decisionStatus: 'pending'
                    }
                  } else if (entry.status === 'approved' || entry.status === 'rejected') {
                    if (!current) {
                      current = { requestedAt: null, requestedBy: null, requestNote: null, decidedAt: null, decidedBy: null, decisionNote: null, decisionStatus: null }
                    }
                    if (!current.decidedAt) {
                      current.decidedAt = entry.at
                      current.decidedBy = entry.decidedBy
                      current.decisionNote = entry.note
                      current.decisionStatus = entry.status
                      cycles.push(current)
                      current = null
                    } else {
                      cycles.push({ requestedAt: null, requestedBy: null, requestNote: null, decidedAt: entry.at, decidedBy: entry.decidedBy, decisionNote: entry.note, decisionStatus: entry.status })
                    }
                  }
                }
                if (current) cycles.push(current)

                if (cycles.length === 0 && (v.managementApproval?.requestedBy || v.managementApproval?.approvedBy)) {
                  cycles.push({
                    requestedAt: v.updatedAt || v.createdAt,
                    requestedBy: v.managementApproval?.requestedBy,
                    requestNote: v.managementApproval?.comments,
                    decidedAt: v.managementApproval?.approvedAt,
                    decidedBy: v.managementApproval?.approvedBy,
                    decisionNote: v.managementApproval?.comments,
                    decisionStatus: v.managementApproval?.status
                  })
                }

                if (cycles.length === 0) return <p>No approval records.</p>

                return (
                  <div>
                    {cycles.map((c, idx) => (
                      <div key={idx} className="edit-item" style={{ marginTop: idx === 0 ? 0 : 12 }}>
                        <div className="edit-header">
                          <span>Approval Cycle {idx + 1} — {c.decisionStatus ? c.decisionStatus.toUpperCase() : 'PENDING'}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<> by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                            {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)}
                          </div>
                          {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                          <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<> by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
                            {c.decidedBy?._id && c.decidedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.decidedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)} {c.decisionStatus && <span style={{ marginLeft: 6, textTransform: 'uppercase' }}>({c.decisionStatus})</span>}
                          </div>
                          {c.decisionNote && <div><strong>Decision note:</strong> {c.decisionNote}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Variation' : 'Reject Variation'}</h2>
              <button onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={() => setApprovalModal({ open: false, variation: null, action: null, note: '' })}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (!approvalModal.variation || !approvalModal.action) return
                    await approveVariation(approvalModal.variation, approvalModal.action, approvalModal.note)
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={isSubmitting}>
                    {isSubmitting ? (approvalModal.action === 'approved' ? 'Approving...' : 'Rejecting...') : (approvalModal.action === 'approved' ? 'Approve' : 'Reject')}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendApprovalConfirmModal.open && sendApprovalConfirmModal.variation && (
        <div className="modal-overlay" onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send for Approval</h2>
              <button onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to send this variation for management approval?
              </p>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Once sent, the variation will be marked as "Pending Approval" and managers or administrators will be able to review and approve or reject it.
              </p>
              {sendApprovalConfirmModal.variation && (
                <div style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Variation #{sendApprovalConfirmModal.variation.variationNumber}</p>
                  {sendApprovalConfirmModal.variation.projectTitle && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{sendApprovalConfirmModal.variation.projectTitle}</p>
                  )}
                  {sendApprovalConfirmModal.variation.parentProject?.name && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Project: {sendApprovalConfirmModal.variation.parentProject.name}</p>
                  )}
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setSendApprovalConfirmModal({ open: false, variation: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (sendApprovalConfirmModal.variation) {
                      setSendApprovalConfirmModal({ open: false, variation: null })
                      await sendForApproval(sendApprovalConfirmModal.variation)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={isSubmitting && loadingAction?.startsWith('approve-')}>
                    {isSubmitting ? 'Sending...' : 'Confirm'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createVariationModal.open && createVariationModal.form && createVariationModal.variation && (
        <div className="modal-overlay" onClick={() => setCreateVariationModal({ open: false, variation: null, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', width: '900px' }}>
            <div className="modal-header">
              <h2>Create Another Variation</h2>
              <button onClick={() => setCreateVariationModal({ open: false, variation: null, form: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <p style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                Creating a new variation based on Variation #{createVariationModal.variation.variationNumber}. Please modify the data below to reflect the changes for this new variation.
              </p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setCreateVariationModal({ open: false, variation: null, form: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('create-variation')
                    setIsSubmitting(true)
                    try {
                      const v = createVariationModal.variation
                      // Check if there are changes from the parent variation
                      const fields = ['companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity']
                      let changed = false
                      for (const f of fields) {
                        if (JSON.stringify(v?.[f] ?? null) !== JSON.stringify(createVariationModal.form?.[f] ?? null)) { changed = true; break }
                      }
                      if (!changed) {
                        setNotify({ open: true, title: 'No Changes', message: 'No changes detected. Please modify data before creating a variation.' })
                        return
                      }
                      
                      const res = await api.post('/api/project-variations', { parentVariationId: v._id, data: createVariationModal.form })
                      setCreateVariationModal({ open: false, variation: null, form: null })
                      setNotify({ open: true, title: 'Variation Created', message: 'The new variation has been created successfully.' })
                      await fetchVariations()
                      // Navigate to the new variation
                      try {
                        localStorage.setItem('variationId', res.data._id)
                        window.location.href = '/variation-detail'
                      } catch {}
                    } catch (e) {
                      setNotify({ open: true, title: 'Creation Failed', message: e.response?.data?.message || 'We could not create the variation. Please try again.' })
                    } finally {
                      setIsSubmitting(false)
                      setLoadingAction(null)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'create-variation'}>
                    {isSubmitting ? 'Creating...' : 'Create Variation'}
                  </ButtonLoader>
                </button>
              </div>
              <div style={{ marginTop: '16px', padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                  Note: For detailed editing, you can create the variation and then edit it from the variation detail page. This will create a draft variation that you can modify.
                </p>
              </div>
            </div>
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

      {diffModal.open && diffModal.variation && diffModal.variation.diffFromParent && Array.isArray(diffModal.variation.diffFromParent) && diffModal.variation.diffFromParent.length > 0 && (
        <div className="modal-overlay" onClick={() => setDiffModal({ open: false, variation: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Changes from Parent</h2>
              <button onClick={() => setDiffModal({ open: false, variation: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Variation #{diffModal.variation.variationNumber} includes the following changes from the parent {diffModal.variation.parentVariation ? 'variation' : 'project'}:
              </p>
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Previous Value</th>
                      <th>New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffModal.variation.diffFromParent.map((diff, idx) => {
                      const fieldNameMap = {
                        'companyInfo': 'Company Info',
                        'submittedTo': 'Submitted To',
                        'attention': 'Attention',
                        'offerReference': 'Offer Reference',
                        'enquiryNumber': 'Enquiry Number',
                        'offerDate': 'Offer Date',
                        'enquiryDate': 'Enquiry Date',
                        'projectTitle': 'Project Title',
                        'introductionText': 'Introduction',
                        'scopeOfWork': 'Scope of Work',
                        'priceSchedule': 'Price Schedule',
                        'ourViewpoints': 'Our Viewpoints',
                        'exclusions': 'Exclusions',
                        'paymentTerms': 'Payment Terms',
                        'deliveryCompletionWarrantyValidity': 'Delivery & Warranty'
                      }
                      const fieldName = fieldNameMap[diff.field] || diff.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                      
                      // Format the values for display
                      const fromVal = diff.from !== undefined ? diff.from : (diff.fromValue !== undefined ? diff.fromValue : null)
                      const toVal = diff.to !== undefined ? diff.to : (diff.toValue !== undefined ? diff.toValue : null)
                      const fromValue = formatHistoryValue(diff.field, fromVal)
                      const toValue = formatHistoryValue(diff.field, toVal)
                      
                      return (
                        <tr key={idx}>
                          <td data-label="Field"><strong>{fieldName}</strong></td>
                          <td data-label="Previous Value">
                            <pre style={{ 
                              margin: 0, 
                              padding: '10px 12px', 
                              background: '#FEF2F2', 
                              border: '1px solid #FECACA', 
                              borderRadius: '6px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '13px',
                              lineHeight: '1.5',
                              maxHeight: '200px',
                              overflow: 'auto',
                              color: '#991B1B',
                              fontFamily: 'inherit',
                              fontWeight: 400
                            }}>
                              {fromValue || '(empty)'}
                            </pre>
                          </td>
                          <td data-label="New Value">
                            <pre style={{ 
                              margin: 0, 
                              padding: '10px 12px', 
                              background: '#F0FDF4', 
                              border: '1px solid #BBF7D0', 
                              borderRadius: '6px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '13px',
                              lineHeight: '1.5',
                              maxHeight: '200px',
                              overflow: 'auto',
                              color: '#166534',
                              fontFamily: 'inherit',
                              fontWeight: 400
                            }}>
                              {toValue || '(empty)'}
                            </pre>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="save-btn" onClick={() => setDiffModal({ open: false, variation: null })}>Close</button>
              </div>
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

export default ProjectVariationManagement

