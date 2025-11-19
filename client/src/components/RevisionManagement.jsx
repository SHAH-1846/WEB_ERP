import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../lib/api'
import './LeadManagement.css'
import logo from '../assets/logo/WBES_Logo.png'

function RevisionManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [quotations, setQuotations] = useState([])
  const [myOnly, setMyOnly] = useState(false)
  const [selectedApprovedQuotationFilter, setSelectedApprovedQuotationFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('createdAt_desc')
  // New filter states
  const [nameFilter, setNameFilter] = useState('')
  const [dateModifiedFilter, setDateModifiedFilter] = useState('')
  const [dateCreatedFilter, setDateCreatedFilter] = useState('')
  // New sort states
  const [sortField, setSortField] = useState('dateCreated') // 'name', 'dateModified', 'dateCreated'
  const [sortDirection, setSortDirection] = useState('desc') // 'asc', 'desc'
  // Debounced filter values for performance
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('')
  const [debouncedDateModifiedFilter, setDebouncedDateModifiedFilter] = useState('')
  const [debouncedDateCreatedFilter, setDebouncedDateCreatedFilter] = useState('')
  const [isFiltering, setIsFiltering] = useState(false) // Track filter operations
  const [filtersExpanded, setFiltersExpanded] = useState(false) // Mobile: collapsible filters
  const [isMobile, setIsMobile] = useState(false) // Track mobile viewport
  const [headerHeight, setHeaderHeight] = useState(80) // Header height for sticky positioning
  const headerRef = useRef(null)
  const [editModal, setEditModal] = useState({ open: false, revision: null, form: null, mode: 'edit' })
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, revision: null })
  const [approvalsView, setApprovalsView] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, revision: null, action: null, note: '' })
  const [createProjectModal, setCreateProjectModal] = useState({ open: false, revision: null, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', assignedProjectEngineerId: '' }, engineers: [], ack: false })
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('revisionViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [projectMap, setProjectMap] = useState({}) // Map revision ID to project info
  const [expandedProjectRows, setExpandedProjectRows] = useState({}) // Track which rows have expanded projects
  const [projectDetailsMap, setProjectDetailsMap] = useState({}) // Store full project details per revision ID
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [diffModal, setDiffModal] = useState({ open: false, revision: null })
  const [expandedVariationRows, setExpandedVariationRows] = useState({}) // Track which rows have expanded variations
  const [projectVariationsMap, setProjectVariationsMap] = useState({}) // Store variations per project ID
  const [variationsForProject, setVariationsForProject] = useState([])
  const [selectedProjectForList, setSelectedProjectForList] = useState(null)
  const [showVariationsListModal, setShowVariationsListModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)

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
      await Promise.all([fetchRevisions(), fetchQuotations()])
      setIsLoading(false)
    }
    void loadData()
  }, [])

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('revisionViewMode', viewMode)
  }, [viewMode])

  const fetchRevisions = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await api.get('/api/revisions')
      const revisionsData = res.data
      setRevisions(revisionsData)
      
      // Check which revisions have projects
      const projectChecks = {}
      for (const rev of revisionsData) {
        try {
          const projectRes = await api.get(`/api/projects/by-revision/${rev._id}`)
          projectChecks[rev._id] = projectRes.data
        } catch {
          // No project for this revision
        }
      }
      setProjectMap(projectChecks)
    } catch {}
  }

  const fetchQuotations = async () => {
    try {
      const res = await api.get('/api/quotations')
      // Filter to only approved quotations for the filter dropdown
      const approved = Array.isArray(res.data) ? res.data.filter(q => q.managementApproval?.status === 'approved') : []
      setQuotations(approved)
    } catch {}
  }

  const approveRevision = async (rev, status, note) => {
    setLoadingAction(`approve-${rev._id}-${status}`)
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/revisions/${rev._id}/approve`, { status, note })
      await fetchRevisions()
      setApprovalModal({ open: false, revision: null, action: null, note: '' })
      setNotify({ open: true, title: status === 'approved' ? 'Revision Approved' : 'Revision Rejected', message: `The revision has been ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: e.response?.data?.message || 'We could not update approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const sendForApproval = async (rev) => {
    setLoadingAction(`send-approval-${rev._id}`)
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/revisions/${rev._id}/approve`, { status: 'pending' })
      await fetchRevisions()
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: e.response?.data?.message || 'We could not send for approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const ensurePdfMake = async () => {
    if (window.pdfMake) return
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.7/build/pdfmake.min.js'
      script.onload = resolve
      script.onerror = reject
      document.body.appendChild(script)
    })
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.7/build/vfs_fonts.js'
      script.onload = resolve
      script.onerror = reject
      document.body.appendChild(script)
    })
  }

  const toDataURL = async (url) => {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  const exportPDF = async (q) => {
    try {
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(q.companyInfo?.logo || logo)
      const currency = q.priceSchedule?.currency || 'AED'

      // Fetch full lead details and site visits for richer PDF (like quotations)
      let leadFull = q.lead || null
      let siteVisits = []
      try {
        const token = localStorage.getItem('token')
        const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
        if (leadId) {
          const resLead = await api.get(`/api/leads/${leadId}`)
          leadFull = resLead.data
          const resVisits = await api.get(`/api/leads/${leadId}/site-visits`)
          siteVisits = Array.isArray(resVisits.data) ? resVisits.data : []
        }
      } catch {}

      const coverFieldsRaw = [
        ['Submitted To', q.submittedTo],
        ['Attention', q.attention],
        ['Offer Reference', q.offerReference],
        ['Enquiry Number', q.enquiryNumber || leadFull?.enquiryNumber],
        ['Offer Date', q.offerDate ? new Date(q.offerDate).toLocaleDateString() : ''],
        ['Enquiry Date', q.enquiryDate ? new Date(q.enquiryDate).toLocaleDateString() : ''],
        ['Project Title', q.projectTitle || leadFull?.projectTitle]
      ]
      const coverFields = coverFieldsRaw.filter(([, v]) => v && String(v).trim().length > 0)

      const scopeRows = (q.scopeOfWork || [])
        .filter(s => (s?.description || '').trim().length > 0)
        .map((s, i) => [String(i + 1), s.description, String(s.quantity || ''), s.unit || '', s.locationRemarks || ''])

      const priceItems = (q.priceSchedule?.items || [])
        .filter(it => (it?.description || '').trim().length > 0 || Number(it.quantity) > 0 || Number(it.unitRate) > 0)
      const priceRows = priceItems.map((it, i) => [
        String(i + 1),
        it.description || '',
        String(it.quantity || 0),
        it.unit || '',
        `${currency} ${Number(it.unitRate || 0).toFixed(2)}`,
        `${currency} ${Number((it.quantity || 0) * (it.unitRate || 0)).toFixed(2)}`
      ])

      const exclusions = (q.exclusions || []).map(x => String(x || '').trim()).filter(Boolean)
      const paymentTerms = (q.paymentTerms || []).filter(p => (p?.milestoneDescription || '').trim().length > 0 || String(p?.amountPercent || '').trim().length > 0)

      const dcwv = q.deliveryCompletionWarrantyValidity || {}
      const deliveryRowsRaw = [
        ['Delivery / Completion Timeline', dcwv.deliveryTimeline],
        ['Warranty Period', dcwv.warrantyPeriod],
        ['Offer Validity (Days)', typeof dcwv.offerValidity === 'number' ? String(dcwv.offerValidity) : (dcwv.offerValidity || '')],
        ['Authorized Signatory', dcwv.authorizedSignatory]
      ]
      const deliveryRows = deliveryRowsRaw.filter(([, v]) => v && String(v).trim().length > 0)

      const header = {
        margin: [36, 20, 36, 8],
        stack: [
          {
            columns: [
              { image: logoDataUrl, width: 60 },
              [
                { text: q.companyInfo?.name || 'Company', style: 'brand' },
                { text: [q.companyInfo?.address, q.companyInfo?.phone, q.companyInfo?.email].filter(Boolean).join(' | '), color: '#64748b', fontSize: 9 }
              ]
            ],
            columnGap: 12
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }] }
        ]
      }

      const content = []
      content.push({ text: `Revision ${q.revisionNumber} — Commercial Quotation`, style: 'h1', margin: [0, 0, 0, 8] })

      if (coverFields.length > 0) {
        content.push({ text: 'Cover & Basic Details', style: 'h2', margin: [0, 6, 0, 6] })
        content.push({
          table: {
            widths: ['30%', '70%'],
            body: [
              [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
              ...coverFields.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: v, style: 'tdVal' }])
            ]
          },
          layout: 'lightHorizontalLines'
        })
      }

      // Project Details (from lead)
      if (leadFull) {
        const leadDetailsRaw = [
          ['Customer', leadFull.customerName],
          ['Project Title', leadFull.projectTitle],
          ['Enquiry #', leadFull.enquiryNumber],
          ['Enquiry Date', leadFull.enquiryDate ? new Date(leadFull.enquiryDate).toLocaleDateString() : ''],
          ['Submission Due', leadFull.submissionDueDate ? new Date(leadFull.submissionDueDate).toLocaleDateString() : ''],
          ['Scope Summary', leadFull.scopeSummary]
        ]
        const leadDetails = leadDetailsRaw.filter(([, v]) => v && String(v).trim().length > 0)
        if (leadDetails.length > 0) {
          content.push({ text: 'Project Details', style: 'h2', margin: [0, 12, 0, 6] })
          content.push({
            table: {
              widths: ['30%', '70%'],
              body: [
                [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                ...leadDetails.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: v, style: 'tdVal' }])
              ]
            },
            layout: 'lightHorizontalLines'
          })
        }
      }

      if (scopeRows.length > 0) {
        content.push({ text: 'Scope of Work', style: 'h2', margin: [0, 12, 0, 6] })
        content.push({
          table: {
            widths: ['6%', '54%', '10%', '10%', '20%'],
            body: [
              [{ text: '#', style: 'th' }, { text: 'Description', style: 'th' }, { text: 'Qty', style: 'th' }, { text: 'Unit', style: 'th' }, { text: 'Location/Remarks', style: 'th' }],
              ...scopeRows
            ]
          },
          layout: 'lightHorizontalLines'
        })
      }

      // Site Visit Reports
      if (Array.isArray(siteVisits) && siteVisits.length > 0) {
        const visitRows = siteVisits.map((v, i) => [
          String(i + 1),
          v.visitAt ? new Date(v.visitAt).toLocaleString() : '',
          v.siteLocation || '',
          v.engineerName || '',
          (v.workProgressSummary || '').slice(0, 140)
        ])
        content.push({ text: 'Site Visit Reports', style: 'h2', margin: [0, 12, 0, 6] })
        content.push({
          table: {
            widths: ['6%', '22%', '22%', '20%', '30%'],
            body: [
              [
                { text: '#', style: 'th' },
                { text: 'Date & Time', style: 'th' },
                { text: 'Location', style: 'th' },
                { text: 'Engineer', style: 'th' },
                { text: 'Progress Summary', style: 'th' }
              ],
              ...visitRows
            ]
          },
          layout: 'lightHorizontalLines'
        })
      }

      if (priceRows.length > 0) {
        content.push({ text: 'Price Schedule', style: 'h2', margin: [0, 12, 0, 6] })
        content.push({
          table: {
            widths: ['6%', '44%', '10%', '10%', '15%', '15%'],
            body: [
              [
                { text: '#', style: 'th' },
                { text: 'Description', style: 'th' },
                { text: 'Qty', style: 'th' },
                { text: 'Unit', style: 'th' },
                { text: `Unit Rate (${currency})`, style: 'th' },
                { text: `Amount (${currency})`, style: 'th' }
              ],
              ...priceRows
            ]
          },
          layout: 'lightHorizontalLines'
        })

        content.push({
          columns: [
            { width: '*', text: '' },
            {
              width: '40%',
              table: {
                widths: ['55%', '45%'],
                body: [
                  [{ text: 'Sub Total', style: 'tdKey' }, { text: `${currency} ${Number(q.priceSchedule?.subTotal || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: `VAT (${q.priceSchedule?.taxDetails?.vatRate || 0}%)`, style: 'tdKey' }, { text: `${currency} ${Number(q.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: 'Grand Total', style: 'th' }, { text: `${currency} ${Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}`, style: 'th', alignment: 'right' }]
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ],
          margin: [0, 8, 0, 0]
        })
      }

      // Delivery/Completion/Warranty/Validity
      if (deliveryRows.length > 0) {
        content.push({ text: 'Delivery, Completion, Warranty & Validity', style: 'h2', margin: [0, 12, 0, 6] })
        content.push({
          table: {
            widths: ['30%', '70%'],
            body: [
              ...deliveryRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: v, style: 'tdVal' }])
            ]
          },
          layout: 'lightHorizontalLines'
        })
      }

      const docDefinition = {
        pageMargins: [36, 96, 36, 60],
        header,
        content,
        styles: {
          brand: { fontSize: 14, color: '#1f2937', bold: true, margin: [0, 0, 0, 2] },
          h1: { fontSize: 18, bold: true, color: '#0f172a' },
          h2: { fontSize: 12, bold: true, color: '#0f172a' },
          h3: { fontSize: 11, bold: true, color: '#0f172a' },
          th: { bold: true, fillColor: '#f1f5f9' },
          tdKey: { color: '#64748b' },
          tdVal: { color: '#0f172a' }
        },
        defaultStyle: { fontSize: 10, lineHeight: 1.2 }
      }

      const filename = `Revision_${q.revisionNumber}_${q.projectTitle || 'Quotation'}.pdf`
      window.pdfMake.createPdf(docDefinition).download(filename)
    } catch (e) {
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF for this revision. Please try again.' })
    }
  }

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

  // Filter and sort revisions
  const filteredRevisions = revisions.filter(r => {
    // Apply "My Revisions" filter
    if (myOnly && r.createdBy?._id !== currentUser?.id) return false
    
    // Apply "Approved Quotation" filter
    if (selectedApprovedQuotationFilter) {
      const rParentId = typeof r.parentQuotation === 'object' ? r.parentQuotation?._id : r.parentQuotation
      if (rParentId !== selectedApprovedQuotationFilter) return false
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (r.projectTitle || '').toLowerCase().includes(term) ||
        (r.offerReference || '').toLowerCase().includes(term) ||
        (r.lead?.customerName || '').toLowerCase().includes(term) ||
        (r.parentQuotation?.offerReference || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    // Apply name filter (project title or revision number) - using debounced value
    if (debouncedNameFilter.trim()) {
      const term = debouncedNameFilter.toLowerCase()
      const projectTitle = (r.projectTitle || r.lead?.projectTitle || '').toLowerCase()
      const revisionNumber = String(r.revisionNumber || '').toLowerCase()
      if (!projectTitle.includes(term) && !revisionNumber.includes(term)) return false
    }
    
    // Apply date modified filter - using debounced value
    if (debouncedDateModifiedFilter) {
      const filterDate = new Date(debouncedDateModifiedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const revisionDate = r.updatedAt ? new Date(r.updatedAt) : null
      if (!revisionDate || revisionDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    // Apply date created filter - using debounced value
    if (debouncedDateCreatedFilter) {
      const filterDate = new Date(debouncedDateCreatedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const revisionDate = r.createdAt ? new Date(r.createdAt) : null
      if (!revisionDate || revisionDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    return true
  })

  // Sort revisions by selected field and direction
  const sortedRevisions = [...filteredRevisions].sort((a, b) => {
    let compareResult = 0
    
    switch (sortField) {
      case 'name':
        // Sort by project title, then revision number
        const aProjectTitle = (a.projectTitle || a.lead?.projectTitle || '').toLowerCase()
        const bProjectTitle = (b.projectTitle || b.lead?.projectTitle || '').toLowerCase()
        const projectTitleCompare = aProjectTitle.localeCompare(bProjectTitle)
        if (projectTitleCompare !== 0) {
          compareResult = projectTitleCompare
        } else {
          // If project titles are equal, sort by revision number
          const aRevNum = String(a.revisionNumber || '').toLowerCase()
          const bRevNum = String(b.revisionNumber || '').toLowerCase()
          compareResult = aRevNum.localeCompare(bRevNum, undefined, { numeric: true, sensitivity: 'base' })
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
  const totalPages = Math.ceil(sortedRevisions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRevisions = sortedRevisions.slice(startIndex, endIndex)

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1)
  }, [myOnly, selectedApprovedQuotationFilter, search, debouncedNameFilter, debouncedDateModifiedFilter, debouncedDateCreatedFilter, sortField, sortDirection])

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
    
    // Handle numbers and booleans
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    
    return String(value)
  }

  // Helper function to render revision actions
  const fetchProjectDetails = async (revisionId) => {
    if (projectDetailsMap[revisionId]) return projectDetailsMap[revisionId]
    
    try {
      const projectInfo = projectMap[revisionId]
      if (!projectInfo?._id) return null
      
      const res = await api.get(`/api/projects/${projectInfo._id}`)
      const project = res.data
      setProjectDetailsMap(prev => ({ ...prev, [revisionId]: project }))
      return project
    } catch {
      return null
    }
  }

  const handleViewProject = async (revision, isTable = false) => {
    if (isTable) {
      // Toggle accordion in table view
      const isExpanded = expandedProjectRows[revision._id]
      setExpandedProjectRows(prev => ({ ...prev, [revision._id]: !isExpanded }))
      
      // Fetch project details if not already loaded
      if (!isExpanded && !projectDetailsMap[revision._id]) {
        await fetchProjectDetails(revision._id)
      }
    } else {
      // Open modal in card view
      const project = await fetchProjectDetails(revision._id)
      if (project) {
        setProjectModal({ open: true, project })
      }
    }
  }

  // Handler for View Variations in table view (accordion)
  const handleViewVariationsTable = async (revision) => {
    const projectInfo = projectMap[revision._id]
    if (!projectInfo?._id) return
    
    const projectId = projectInfo._id
    const isExpanded = expandedVariationRows[projectId]
    
    if (isExpanded) {
      // Collapse: remove from expanded rows
      setExpandedVariationRows(prev => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
    } else {
      // Expand: fetch variations if not already loaded
      if (!projectVariationsMap[projectId]) {
        try {
          const res = await api.get(`/api/project-variations?parentProject=${projectId}`)
          const list = Array.isArray(res.data) ? res.data : []
          setProjectVariationsMap(prev => ({ ...prev, [projectId]: list }))
        } catch (e) {
          setNotify({ open: true, title: 'Load Failed', message: 'We could not load the variations. Please try again.' })
          return
        }
      }
      setExpandedVariationRows(prev => ({ ...prev, [projectId]: true }))
    }
  }

  const renderRevisionActions = (r) => (
    <div className="lead-actions">
      {projectMap[r._id] && (
        <button className="link-btn" onClick={() => handleViewProject(r, viewMode === 'table')}>
          View Project
        </button>
      )}
      <button className="save-btn" onClick={() => exportPDF(r)}>Export</button>
      {(currentUser?.roles?.includes('estimation_engineer') || currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin') || r.createdBy?._id === currentUser?.id) && (
        <button className="assign-btn" onClick={() => setEditModal({ open: true, revision: r, mode: 'edit', form: {
          companyInfo: r.companyInfo || {},
          submittedTo: r.submittedTo || '',
          attention: r.attention || '',
          offerReference: r.offerReference || '',
          enquiryNumber: r.enquiryNumber || '',
          offerDate: r.offerDate ? String(r.offerDate).slice(0,10) : '',
          enquiryDate: r.enquiryDate ? String(r.enquiryDate).slice(0,10) : '',
          projectTitle: r.projectTitle || r.lead?.projectTitle || '',
          introductionText: r.introductionText || '',
          scopeOfWork: r.scopeOfWork || [],
          priceSchedule: r.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: r.priceSchedule?.currency || 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
          ourViewpoints: r.ourViewpoints || '',
          exclusions: r.exclusions || [],
          paymentTerms: r.paymentTerms || [],
          deliveryCompletionWarrantyValidity: r.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
        } })}>Edit</button>
      )}
      <button className="assign-btn" onClick={() => {
        localStorage.setItem('revisionId', r._id)
        window.location.href = '/revision-detail'
      }}>View Details</button>
      {r.managementApproval?.status === 'pending' ? (
        <span className="status-badge blue">Approval Pending</span>
      ) : (
        <>
          {(r.managementApproval?.status !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || r.createdBy?._id === currentUser?.id)) && (
            <button className="save-btn" onClick={() => sendForApproval(r)}>Send for Approval</button>
          )}
          {r.managementApproval?.status === 'approved' && (
            <>
              <button className="save-btn" onClick={async () => {
                try {
                  await api.get(`/api/projects/by-revision/${r._id}`)
                  setNotify({ open: true, title: 'Not Allowed', message: 'A project already exists for this revision.' })
                  return
                } catch {}
                const hasChild = revisions.some(x => (x.parentRevision?._id || x.parentRevision) === r._id)
                if (hasChild) {
                  setNotify({ open: true, title: 'Not Allowed', message: 'A child revision already exists for this revision.' })
                  return
                }
                setEditModal({ open: true, revision: r, mode: 'create', form: {
                  companyInfo: r.companyInfo || {},
                  submittedTo: r.submittedTo || '',
                  attention: r.attention || '',
                  offerReference: r.offerReference || '',
                  enquiryNumber: r.enquiryNumber || '',
                  offerDate: r.offerDate ? String(r.offerDate).slice(0,10) : '',
                  enquiryDate: r.enquiryDate ? String(r.enquiryDate).slice(0,10) : '',
                  projectTitle: r.projectTitle || r.lead?.projectTitle || '',
                  introductionText: r.introductionText || '',
                  scopeOfWork: r.scopeOfWork || [],
                  priceSchedule: r.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: r.priceSchedule?.currency || 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
                  ourViewpoints: r.ourViewpoints || '',
                  exclusions: r.exclusions || [],
                  paymentTerms: r.paymentTerms || [],
                  deliveryCompletionWarrantyValidity: r.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
                } })
              }}>Create Another Revision</button>
              <button className="assign-btn" onClick={async () => {
                try {
                  await api.get(`/api/projects/by-revision/${r._id}`)
                  setNotify({ open: true, title: 'Not Allowed', message: 'A project already exists for this revision.' })
                  return
                } catch {}
                const hasChild = revisions.some(x => (x.parentRevision?._id || x.parentRevision) === r._id)
                if (hasChild) {
                  setNotify({ open: true, title: 'Not Allowed', message: 'Project can only be created from the last approved child revision.' })
                  return
                }
                const parentId = typeof r.parentQuotation === 'object' ? r.parentQuotation?._id : r.parentQuotation
                const groupItems = revisions.filter(x => {
                  const xParentId = typeof x.parentQuotation === 'object' ? x.parentQuotation?._id : x.parentQuotation
                  return xParentId === parentId
                })
                const approved = groupItems.filter(x => x.managementApproval?.status === 'approved')
                const latest = approved.slice().sort((a,b) => (b.revisionNumber||0)-(a.revisionNumber||0))[0]
                if (latest && latest._id !== r._id) {
                  setNotify({ open: true, title: 'Not Allowed', message: `Only the latest approved revision (#${latest.revisionNumber}) can be used to create a project.` })
                  return
                }
                let engineers = []
                try {
                  const resEng = await api.get('/api/projects/project-engineers')
                  engineers = Array.isArray(resEng.data) ? resEng.data : []
                } catch {}
                setCreateProjectModal({ open: true, revision: r, engineers, ack: false, form: {
                  name: r.projectTitle || r.lead?.projectTitle || 'Project',
                  locationDetails: r.lead?.locationDetails || '',
                  workingHours: r.lead?.workingHours || '',
                  manpowerCount: r.lead?.manpowerCount || '',
                  assignedProjectEngineerId: ''
                } })
              }}>Create Project</button>
            </>
          )}
        </>
      )}
      <button className="link-btn" onClick={() => setApprovalsView(r)}>View Approvals/Rejections</button>
      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && r.managementApproval?.status === 'pending' && (
        <>
          <button className="approve-btn" onClick={() => setApprovalModal({ open: true, revision: r, action: 'approved', note: '' })}>Approve</button>
          <button className="reject-btn" onClick={() => setApprovalModal({ open: true, revision: r, action: 'rejected', note: '' })}>Reject</button>
        </>
      )}
      {currentUser?.roles?.includes('estimation_engineer') && r.managementApproval?.status !== 'approved' && (
        <button className="reject-btn" onClick={() => setConfirmDelete({ open: true, revision: r })}>Delete Revision</button>
      )}
    </div>
  )

  const totalRevisions = revisions.length
  const displayedRevisions = filteredRevisions.length

  return (
    <div className="lead-management">
      <div className="header" ref={headerRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Revisions Management</h1>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(myOnly || selectedApprovedQuotationFilter || search || debouncedNameFilter || debouncedDateModifiedFilter || debouncedDateCreatedFilter) ? `${displayedRevisions} of ${totalRevisions}` : totalRevisions} {totalRevisions === 1 ? 'Revision' : 'Revisions'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myOnly} onChange={() => setMyOnly(!myOnly)} />
            My Revisions
          </label>
          <select
            value={selectedApprovedQuotationFilter}
            onChange={(e) => setSelectedApprovedQuotationFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              maxWidth: '250px',
              width: '250px'
            }}
          >
            <option value="">All Approved Quotations</option>
            {quotations.map(q => (
              <option key={q._id} value={q._id}>
                {q.projectTitle || q.lead?.projectTitle || 'Quotation'} - {q.offerReference || 'N/A'}
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
                transition: 'all 0.2s ease'
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
                transition: 'all 0.2s ease'
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
                  <span>Filtering...</span>
                </div>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
                Filter by Name:
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input 
                    type="text"
                    placeholder="Project title or revision number..."
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
                    aria-label="Filter by project title or revision number"
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

      {viewMode === 'card' ? (
        <div className="leads-grid">
          {paginatedRevisions.map(r => (
            <div key={r._id} className="lead-card">
              <div className="lead-header">
                <h3>Revision #{r.revisionNumber || 'N/A'}</h3>
                {r.managementApproval?.status && (
                  <span className={`status-badge ${r.managementApproval.status === 'approved' ? 'green' : (r.managementApproval.status === 'rejected' ? 'red' : 'blue')}`}>
                    {r.managementApproval.status === 'pending' ? 'Approval Pending' : r.managementApproval.status}
                  </span>
                )}
              </div>
              <div className="lead-details">
                <p><strong>Project:</strong> {r.projectTitle || r.lead?.projectTitle || 'N/A'}</p>
                <p><strong>Customer:</strong> {r.lead?.customerName || 'N/A'}</p>
                <p><strong>Offer Ref:</strong> {r.offerReference || 'N/A'}</p>
                <p><strong>Parent Quotation:</strong> {typeof r.parentQuotation === 'object' ? (r.parentQuotation?.offerReference || 'N/A') : 'N/A'}</p>
                <p><strong>Grand Total:</strong> {(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
                {r.diffFromParent && Array.isArray(r.diffFromParent) && r.diffFromParent.length > 0 && (
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
                      onClick={() => setDiffModal({ open: true, revision: r })}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#BFDBFE'
                        e.target.style.transform = 'scale(1.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#DBEAFE'
                        e.target.style.transform = 'scale(1)'
                      }}
                    >
                      {r.diffFromParent.length} change{r.diffFromParent.length > 1 ? 's' : ''}
                    </span>
                  </p>
                )}
                <p><strong>Created by:</strong> {r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}</p>
                {r.createdBy?._id !== currentUser?.id && r.createdBy && (
                  <button className="link-btn" onClick={() => setProfileUser(r.createdBy)}>
                    View Profile
                  </button>
                )}
              </div>
              {renderRevisionActions(r)}
            </div>
          ))}
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Revision #</th>
                <th>Project</th>
                <th>Customer</th>
                <th>Offer Ref</th>
                <th>Parent Quotation</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Changes</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRevisions.map(r => (
                <>
                  <tr key={r._id}>
                    <td data-label="Revision #">{r.revisionNumber || 'N/A'}</td>
                    <td data-label="Project">{r.projectTitle || r.lead?.projectTitle || 'Revision'}</td>
                    <td data-label="Customer">{r.lead?.customerName || 'N/A'}</td>
                    <td data-label="Offer Ref">{r.offerReference || 'N/A'}</td>
                    <td data-label="Parent Quotation">
                      {typeof r.parentQuotation === 'object' ? (r.parentQuotation?.offerReference || 'N/A') : 'N/A'}
                      {typeof r.parentQuotation === 'object' && r.parentQuotation?._id && (
                        <button className="link-btn" onClick={() => {
                          localStorage.setItem('quotationId', r.parentQuotation._id)
                          window.location.href = '/quotation-detail'
                        }} style={{ marginLeft: '6px' }}>
                          View
                        </button>
                      )}
                    </td>
                    <td data-label="Grand Total">{(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${r.managementApproval?.status === 'approved' ? 'green' : (r.managementApproval?.status === 'rejected' ? 'red' : 'blue')}`}>
                        {r.managementApproval?.status === 'pending' ? 'Approval Pending' : (r.managementApproval?.status || 'N/A')}
                      </span>
                    </td>
                    <td data-label="Changes">
                      {r.diffFromParent && Array.isArray(r.diffFromParent) && r.diffFromParent.length > 0 ? (
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
                          onClick={() => setDiffModal({ open: true, revision: r })}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#BFDBFE'
                            e.target.style.transform = 'scale(1.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#DBEAFE'
                            e.target.style.transform = 'scale(1)'
                          }}
                        >
                          {r.diffFromParent.length} change{r.diffFromParent.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No changes</span>
                      )}
                    </td>
                    <td data-label="Created By">
                      {r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}
                      {r.createdBy?._id !== currentUser?.id && r.createdBy && (
                        <button className="link-btn" onClick={() => setProfileUser(r.createdBy)} style={{ marginLeft: '6px' }}>
                          View Profile
                        </button>
                      )}
                    </td>
                    <td data-label="Actions">
                      {renderRevisionActions(r)}
                    </td>
                  </tr>
                  {expandedProjectRows[r._id] && projectDetailsMap[r._id] && (
                    <tr className="accordion-row">
                      <td colSpan="10" style={{ padding: '0', borderTop: 'none' }}>
                        <div className="accordion-content" style={{ padding: '20px', background: 'var(--bg)' }}>
                          <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Project Details</h4>
                          <div className="ld-kv" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                            <p><strong>Project Name:</strong> {projectDetailsMap[r._id].name || 'N/A'}</p>
                            <p><strong>Status:</strong> {projectDetailsMap[r._id].status || 'N/A'}</p>
                            <p><strong>Location:</strong> {projectDetailsMap[r._id].locationDetails || 'N/A'}</p>
                            <p><strong>Working Hours:</strong> {projectDetailsMap[r._id].workingHours || 'N/A'}</p>
                            <p><strong>Manpower Count:</strong> {projectDetailsMap[r._id].manpowerCount || 'N/A'}</p>
                            <p><strong>Budget:</strong> {projectDetailsMap[r._id].budget ? `${projectDetailsMap[r._id].budget}` : 'N/A'}</p>
                            <p><strong>Site Engineer:</strong> {projectDetailsMap[r._id].assignedSiteEngineer?.name || 'Not Assigned'}</p>
                            <p><strong>Project Engineer:</strong> {projectDetailsMap[r._id].assignedProjectEngineer?.name || 'Not Assigned'}</p>
                            <p><strong>Created At:</strong> {projectDetailsMap[r._id].createdAt ? new Date(projectDetailsMap[r._id].createdAt).toLocaleString() : 'N/A'}</p>
                            <p><strong>Created By:</strong> {projectDetailsMap[r._id].createdBy?.name || 'N/A'}</p>
                          </div>
                          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                            <button className="assign-btn" onClick={() => {
                              try {
                                localStorage.setItem('projectsFocusId', projectDetailsMap[r._id]._id)
                                localStorage.setItem('projectId', projectDetailsMap[r._id]._id)
                              } catch {}
                              window.location.href = '/project-detail'
                            }}>
                              View Full Project Details
                            </button>
                            <button
                              className="link-btn"
                              onClick={() => handleViewVariationsTable(r)}
                            >
                              View Variations
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {projectMap[r._id] && expandedVariationRows[projectMap[r._id]._id] && (
                    <tr key={`${r._id}-variations`} className="accordion-row">
                      <td colSpan="10" style={{ padding: '0', borderTop: 'none' }}>
                        <div className="accordion-content" style={{ padding: '16px', background: 'var(--bg)' }}>
                          <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Variations ({(projectVariationsMap[projectMap[r._id]._id] || []).length})</h4>
                          {(projectVariationsMap[projectMap[r._id]._id] || []).length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>No variations found for this project.</p>
                          ) : (
                            <div className="table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Variation #</th>
                                    <th>Offer Ref</th>
                                    <th>Status</th>
                                    <th>Grand Total</th>
                                    <th>Created By</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(projectVariationsMap[projectMap[r._id]._id] || []).sort((a,b)=> (a.variationNumber||0)-(b.variationNumber||0)).map((v) => (
                                    <tr key={v._id}>
                                      <td data-label="Variation #">{v.variationNumber || 'N/A'}</td>
                                      <td data-label="Offer Ref">{v.offerReference || 'N/A'}</td>
                                      <td data-label="Status">
                                        <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : 'blue'}`}>
                                          {v.managementApproval?.status || 'draft'}
                                        </span>
                                      </td>
                                      <td data-label="Grand Total">{(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                                      <td data-label="Created By">
                                        {v.createdBy?._id === currentUser?.id ? 'You' : (v.createdBy?.name || 'N/A')}
                                        {v.createdBy?._id !== currentUser?.id && v.createdBy && (
                                          <button className="link-btn" onClick={() => setProfileUser(v.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
                                        )}
                                      </td>
                                      <td data-label="Created At">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</td>
                                      <td data-label="Actions">
                                        <button
                                          className="save-btn"
                                          onClick={() => {
                                            try {
                                              localStorage.setItem('variationId', v._id)
                                            } catch {}
                                            window.location.href = '/variation-detail'
                                          }}
                                        >
                                          View
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredRevisions.length > 0 && (
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
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredRevisions.length)} of {filteredRevisions.length}
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
      {editModal.open && (
        <div className="modal-overlay" onClick={() => setEditModal({ open: false, revision: null, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Revision</h2>
              <button onClick={() => setEditModal({ open: false, revision: null, form: null })} className="close-btn">×</button>
            </div>
            {editModal.form && (
              <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                <div className="form-section">
                  <div className="section-header">
                    <h3>Cover & Basic Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Submitted To (Client Company)</label>
                    <input type="text" value={editModal.form.submittedTo} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, submittedTo: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Attention (Contact Person)</label>
                    <input type="text" value={editModal.form.attention} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, attention: e.target.value } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Reference</label>
                      <input type="text" value={editModal.form.offerReference} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, offerReference: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Number</label>
                      <input type="text" value={editModal.form.enquiryNumber} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, enquiryNumber: e.target.value } })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Date</label>
                      <input type="date" value={editModal.form.offerDate} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, offerDate: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Date</label>
                      <input type="date" value={editModal.form.enquiryDate} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, enquiryDate: e.target.value } })} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Project Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Project Title</label>
                    <input type="text" value={editModal.form.projectTitle} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, projectTitle: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Introduction</label>
                    <textarea value={editModal.form.introductionText} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, introductionText: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Scope of Work</h3>
                  </div>
                  {editModal.form.scopeOfWork.map((s, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: editModal.form.scopeOfWork.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Description</label>
                          <textarea value={s.description} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: editModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Qty</label>
                          <input type="number" value={s.quantity} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: editModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit</label>
                          <input type="text" value={s.unit} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: editModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 2 }}>
                          <label>Location/Remarks</label>
                          <input type="text" value={s.locationRemarks} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: editModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, locationRemarks: e.target.value } : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, scopeOfWork: [...editModal.form.scopeOfWork, { description: '', quantity: '', unit: '', locationRemarks: '' }] } })}>+ Add Scope Item</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Price Schedule</h3>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Currency</label>
                      <input type="text" value={editModal.form.priceSchedule.currency} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, currency: e.target.value } } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>VAT %</label>
                      <input type="number" value={editModal.form.priceSchedule.taxDetails.vatRate} onChange={e => {
                        const items = editModal.form.priceSchedule.items
                        const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                        const vat = sub * (Number(e.target.value || 0) / 100)
                        const grand = sub + vat
                        setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...editModal.form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: Number(vat.toFixed(2)) } } } })
                      }} />
                    </div>
                  </div>
                  {editModal.form.priceSchedule.items.map((it, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => {
                          const items = editModal.form.priceSchedule.items.filter((_, idx) => idx !== i)
                          const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                          const vat = sub * (Number(editModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...editModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                        }}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Description</label>
                          <input type="text" value={it.description} onChange={e => {
                            const items = editModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x)
                            setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Qty</label>
                          <input type="number" value={it.quantity} onChange={e => {
                            const items = editModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value, totalAmount: Number((Number(e.target.value || 0) * Number(x.unitRate || 0)).toFixed(2)) } : x)
                            const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                            const vat = sub * (Number(editModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                            const grand = sub + vat
                            setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...editModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit</label>
                          <input type="text" value={it.unit} onChange={e => {
                            const items = editModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x)
                            setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit Rate</label>
                          <input type="number" value={it.unitRate} onChange={e => {
                            const items = editModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unitRate: e.target.value, totalAmount: Number((Number(x.quantity || 0) * Number(e.target.value || 0)).toFixed(2)) } : x)
                            const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                            const vat = sub * (Number(editModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                            const grand = sub + vat
                            setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...editModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Amount</label>
                          <input type="number" value={Number(it.totalAmount || 0)} readOnly />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, priceSchedule: { ...editModal.form.priceSchedule, items: [...editModal.form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } } })}>+ Add Item</button>
                  </div>

                  <div className="totals-card">
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Sub Total</label>
                        <input type="number" readOnly value={Number(editModal.form.priceSchedule.subTotal || 0)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>VAT Amount</label>
                        <input type="number" readOnly value={Number(editModal.form.priceSchedule.taxDetails.vatAmount || 0)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Grand Total</label>
                        <input type="number" readOnly value={Number(editModal.form.priceSchedule.grandTotal || 0)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Our Viewpoints / Special Terms</h3>
                  </div>
                  <div className="form-group">
                    <label>Our Viewpoints / Special Terms</label>
                    <textarea value={editModal.form.ourViewpoints} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, ourViewpoints: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Exclusions</h3>
                  </div>
                  {editModal.form.exclusions.map((ex, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, exclusions: editModal.form.exclusions.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                          <input type="text" value={ex} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, exclusions: editModal.form.exclusions.map((x, idx) => idx === i ? e.target.value : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, exclusions: [...editModal.form.exclusions, ''] } })}>+ Add Exclusion</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Payment Terms</h3>
                  </div>
                  {editModal.form.paymentTerms.map((p, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Term {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, paymentTerms: editModal.form.paymentTerms.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Milestone</label>
                          <input type="text" value={p.milestoneDescription} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, paymentTerms: editModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Amount %</label>
                          <input type="number" value={p.amountPercent} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, paymentTerms: editModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, amountPercent: e.target.value } : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setEditModal({ ...editModal, form: { ...editModal.form, paymentTerms: [...editModal.form.paymentTerms, { milestoneDescription: '', amountPercent: '' }] } })}>+ Add Payment Term</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Delivery, Completion, Warranty & Validity</h3>
                  </div>
                  <div className="form-group">
                    <label>Delivery / Completion Timeline</label>
                    <input type="text" value={editModal.form.deliveryCompletionWarrantyValidity.deliveryTimeline} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, deliveryCompletionWarrantyValidity: { ...editModal.form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Warranty Period</label>
                      <input type="text" value={editModal.form.deliveryCompletionWarrantyValidity.warrantyPeriod} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, deliveryCompletionWarrantyValidity: { ...editModal.form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Validity (Days)</label>
                      <input type="number" value={editModal.form.deliveryCompletionWarrantyValidity.offerValidity} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, deliveryCompletionWarrantyValidity: { ...editModal.form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } } })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Authorized Signatory</label>
                    <input type="text" value={editModal.form.deliveryCompletionWarrantyValidity.authorizedSignatory} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, deliveryCompletionWarrantyValidity: { ...editModal.form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } } })} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setEditModal({ open: false, revision: null, form: null, mode: 'edit' })}>Cancel</button>
                  <button type="button" className="save-btn" onClick={async () => {
                    try {
                      const token = localStorage.getItem('token')
                      if (editModal.mode === 'create') {
                        await api.post(`/api/revisions`, { sourceRevisionId: editModal.revision._id, data: editModal.form })
                        setNotify({ open: true, title: 'Revision Created', message: 'New revision created successfully.' })
                      } else {
                        await api.put(`/api/revisions/${editModal.revision._id}`, editModal.form)
                        setNotify({ open: true, title: 'Saved', message: 'Revision updated successfully.' })
                      }
                      await fetchRevisions()
                      setEditModal({ open: false, revision: null, form: null, mode: 'edit' })
                    } catch (e) {
                      setNotify({ open: true, title: 'Save Failed', message: e.response?.data?.message || 'Failed to save revision' })
                    }
                  }}>{editModal.mode === 'create' ? 'Create Revision' : 'Save Changes'}</button>
                </div>
              </div>
            )}
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

      {approvalsView && (
        <div className="modal-overlay history" onClick={() => setApprovalsView(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approvals & Rejections</h2>
              <button onClick={() => setApprovalsView(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {(() => {
                const rev = approvalsView
                const rawLogs = Array.isArray(rev.managementApproval?.logs) ? rev.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
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

                if (cycles.length === 0 && (rev.managementApproval?.requestedBy || rev.managementApproval?.approvedBy)) {
                  cycles.push({
                    requestedAt: rev.updatedAt || rev.createdAt,
                    requestedBy: rev.managementApproval?.requestedBy,
                    requestNote: rev.managementApproval?.comments,
                    decidedAt: rev.managementApproval?.approvedAt,
                    decidedBy: rev.managementApproval?.approvedBy,
                    decisionNote: rev.managementApproval?.comments,
                    decisionStatus: rev.managementApproval?.status
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
                          <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<>
                            by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                            {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)}
                          </div>
                          {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                          <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<>
                            by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
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
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, revision: null, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Revision' : 'Reject Revision'}</h2>
              <button onClick={() => setApprovalModal({ open: false, revision: null, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, revision: null, action: null, note: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  if (!approvalModal.revision || !approvalModal.action) return
                  await approveRevision(approvalModal.revision, approvalModal.action, approvalModal.note)
                  setApprovalModal({ open: false, revision: null, action: null, note: '' })
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createProjectModal.open && createProjectModal.revision && (
        <div className="modal-overlay" onClick={() => setCreateProjectModal({ open: false, revision: null, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', assignedProjectEngineerId: '' }, engineers: [], ack: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Project</h2>
              <button onClick={() => setCreateProjectModal({ open: false, revision: null, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', assignedProjectEngineerId: '' }, engineers: [], ack: false })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              {currentUser?.roles?.includes('estimation_engineer') && (
                <div className="edit-item" style={{ background: '#FEF3C7', border: '1px solid #F59E0B', padding: 14, marginBottom: 14, color: '#7C2D12' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span aria-hidden="true" style={{ fontSize: 20, lineHeight: '20px', marginTop: 2 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Warning</div>
                      <div style={{ lineHeight: 1.4 }}>This action cannot be undone. Only managers can delete projects once created.</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" value={createProjectModal.form.name} onChange={e => setCreateProjectModal({ ...createProjectModal, form: { ...createProjectModal.form, name: e.target.value } })} />
              </div>
              <div className="form-group">
                <label>Location Details</label>
                <input type="text" value={createProjectModal.form.locationDetails} onChange={e => setCreateProjectModal({ ...createProjectModal, form: { ...createProjectModal.form, locationDetails: e.target.value } })} />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Working Hours</label>
                  <input type="text" value={createProjectModal.form.workingHours} onChange={e => setCreateProjectModal({ ...createProjectModal, form: { ...createProjectModal.form, workingHours: e.target.value } })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Manpower Count</label>
                  <input type="number" value={createProjectModal.form.manpowerCount} onChange={e => setCreateProjectModal({ ...createProjectModal, form: { ...createProjectModal.form, manpowerCount: Number(e.target.value || 0) } })} />
                </div>
              </div>
              <div className="form-group">
                <label>Assign Project Engineer</label>
                <select value={createProjectModal.form.assignedProjectEngineerId} onChange={e => setCreateProjectModal({ ...createProjectModal, form: { ...createProjectModal.form, assignedProjectEngineerId: e.target.value } })}>
                  <option value="">-- Select --</option>
                  {createProjectModal.engineers.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              {createProjectModal.form.assignedProjectEngineerId && (
                <div className="form-group">
                  <button type="button" className="link-btn" onClick={() => {
                    const u = createProjectModal.engineers.find(x => String(x._id) === String(createProjectModal.form.assignedProjectEngineerId))
                    if (u) setProfileUser(u)
                  }}>View Profile</button>
                </div>
              )}
              {currentUser?.roles?.includes('estimation_engineer') && (
                <div className="form-group" style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                    <input id="ack-project-create" type="checkbox" style={{ marginTop: 2 }} checked={createProjectModal.ack} onChange={e => setCreateProjectModal({ ...createProjectModal, ack: e.target.checked })} />
                    <label htmlFor="ack-project-create" style={{ color: 'var(--text)', cursor: 'pointer' }}>
                      I understand this action cannot be undone and requires management involvement to reverse.
                    </label>
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setCreateProjectModal({ open: false, revision: null, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', assignedProjectEngineerId: '' }, engineers: [], ack: false })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  disabled={(currentUser?.roles?.includes('estimation_engineer') && !createProjectModal.ack) || isSubmitting} 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('create-project')
                    setIsSubmitting(true)
                    try {
                      const token = localStorage.getItem('token')
                      // final guard on server side too
                      const body = { ...createProjectModal.form }
                      await api.post(`/api/projects/from-revision/${createProjectModal.revision._id}`, body)
                      setCreateProjectModal({ open: false, revision: null, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', assignedProjectEngineerId: '' }, engineers: [], ack: false })
                      setNotify({ open: true, title: 'Project Created', message: 'Project created from approved revision. Redirecting to Projects...' })
                      setTimeout(() => { window.location.href = '/projects' }, 800)
                    } catch (e) {
                      setNotify({ open: true, title: 'Create Project Failed', message: e.response?.data?.message || 'We could not create the project. Please try again.' })
                    } finally {
                      setIsSubmitting(false)
                      setLoadingAction(null)
                    }
                  }}
                >
                  <ButtonLoader loading={loadingAction === 'create-project'}>
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete.open && confirmDelete.revision && (
        <div className="modal-overlay" onClick={() => setConfirmDelete({ open: false, revision: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Revision</h2>
              <button onClick={() => setConfirmDelete({ open: false, revision: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to delete Revision {confirmDelete.revision.revisionNumber}? This action cannot be undone.</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setConfirmDelete({ open: false, revision: null })}>Cancel</button>
                <button type="button" className="reject-btn" onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    await api.delete(`/api/revisions/${confirmDelete.revision._id}`)
                    setConfirmDelete({ open: false, revision: null })
                    setNotify({ open: true, title: 'Revision Deleted', message: 'The revision was deleted successfully.' })
                    await fetchRevisions()
                  } catch (e) {
                    setConfirmDelete({ open: false, revision: null })
                    setNotify({ open: true, title: 'Delete Failed', message: e.response?.data?.message || 'We could not delete the revision. Please try again.' })
                  }
                }}>Confirm Delete</button>
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

      {projectModal.open && projectModal.project && (
        <div className="modal-overlay" onClick={() => setProjectModal({ open: false, project: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2>Project Details</h2>
              <button onClick={() => setProjectModal({ open: false, project: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <div className="ld-kv" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <p><strong>Project Name:</strong> {projectModal.project.name || 'N/A'}</p>
                <p><strong>Status:</strong> {projectModal.project.status || 'N/A'}</p>
                <p><strong>Location:</strong> {projectModal.project.locationDetails || 'N/A'}</p>
                <p><strong>Working Hours:</strong> {projectModal.project.workingHours || 'N/A'}</p>
                <p><strong>Manpower Count:</strong> {projectModal.project.manpowerCount || 'N/A'}</p>
                <p><strong>Budget:</strong> {projectModal.project.budget ? `${projectModal.project.budget}` : 'N/A'}</p>
                <p><strong>Site Engineer:</strong> {projectModal.project.assignedSiteEngineer?.name || 'Not Assigned'}</p>
                <p><strong>Project Engineer:</strong> {projectModal.project.assignedProjectEngineer?.name || 'Not Assigned'}</p>
                <p><strong>Created At:</strong> {projectModal.project.createdAt ? new Date(projectModal.project.createdAt).toLocaleString() : 'N/A'}</p>
                <p><strong>Created By:</strong> {projectModal.project.createdBy?.name || 'N/A'}</p>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button className="assign-btn" onClick={() => {
                  try {
                    localStorage.setItem('projectsFocusId', projectModal.project._id)
                    localStorage.setItem('projectId', projectModal.project._id)
                  } catch {}
                  window.location.href = '/project-detail'
                }}>
                  View Full Project Details
                </button>
                <button
                  className="link-btn"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/api/project-variations?parentProject=${projectModal.project._id}`)
                      const list = Array.isArray(res.data) ? res.data : []
                      if (list.length === 0) {
                        setNotify({ open: true, title: 'No Variations', message: 'No variations found for this project.' })
                        return
                      }
                      setVariationsForProject(list)
                      setSelectedProjectForList(projectModal.project)
                      setShowVariationsListModal(true)
                    } catch (e) {
                      setNotify({ open: true, title: 'Open Failed', message: 'We could not load the variations. Please try again.' })
                    }
                  }}
                >
                  View Variations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {diffModal.open && diffModal.revision && diffModal.revision.diffFromParent && Array.isArray(diffModal.revision.diffFromParent) && diffModal.revision.diffFromParent.length > 0 && (
        <div className="modal-overlay" onClick={() => setDiffModal({ open: false, revision: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Changes from Parent</h2>
              <button onClick={() => setDiffModal({ open: false, revision: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Revision #{diffModal.revision.revisionNumber} includes the following changes from the parent quotation:
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
                    {diffModal.revision.diffFromParent.map((diff, idx) => {
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
                <button type="button" className="save-btn" onClick={() => setDiffModal({ open: false, revision: null })}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVariationsListModal && selectedProjectForList && (
        <div className="modal-overlay" onClick={() => setShowVariationsListModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', width: '900px' }}>
            <div className="modal-header">
              <h2>Variations for {selectedProjectForList.name}</h2>
              <button onClick={() => setShowVariationsListModal(false)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {variationsForProject.length === 0 ? (
                <p>No variations found for this project.</p>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Variation #</th>
                        <th>Offer Ref</th>
                        <th>Status</th>
                        <th>Grand Total</th>
                        <th>Created By</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variationsForProject.sort((a,b)=> (a.variationNumber||0)-(b.variationNumber||0)).map((v) => (
                        <tr key={v._id}>
                          <td data-label="Variation #">{v.variationNumber || 'N/A'}</td>
                          <td data-label="Offer Ref">{v.offerReference || 'N/A'}</td>
                          <td data-label="Status">
                            <span className={`status-badge ${v.managementApproval?.status === 'approved' ? 'approved' : v.managementApproval?.status === 'rejected' ? 'rejected' : 'blue'}`}>
                              {v.managementApproval?.status || 'draft'}
                            </span>
                          </td>
                          <td data-label="Grand Total">{(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                          <td data-label="Created By">
                            {v.createdBy?._id === currentUser?.id ? 'You' : (v.createdBy?.name || 'N/A')}
                            {v.createdBy?._id !== currentUser?.id && v.createdBy && (
                              <button className="link-btn" onClick={() => setProfileUser(v.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </td>
                          <td data-label="Created At">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}</td>
                          <td data-label="Actions">
                            <button
                              className="save-btn"
                              onClick={() => {
                                try {
                                  localStorage.setItem('variationId', v._id)
                                  setShowVariationsListModal(false)
                                } catch {}
                                window.location.href = '/variation-detail'
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RevisionManagement


