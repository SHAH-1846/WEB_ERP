import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../lib/api'
import './LeadManagement.css'
import './LoadingComponents.css'
import { CreateQuotationModal } from './CreateQuotationModal'
import '../design-system'
import logo from '../assets/logo/WBES_Logo.png'
import { Spinner, SkeletonCard, SkeletonTableRow, ButtonLoader, PageSkeleton } from './LoadingComponents'

function QuotationManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [leads, setLeads] = useState([])
  const [quotations, setQuotations] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [historyQuote, setHistoryQuote] = useState(null)
  const [myQuotationsOnly, setMyQuotationsOnly] = useState(false)
  const [selectedLeadFilter, setSelectedLeadFilter] = useState('')
  const [approvalModal, setApprovalModal] = useState({ open: false, quote: null, action: null, note: '' })
  const [sendApprovalConfirmModal, setSendApprovalConfirmModal] = useState({ open: false, quote: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, quote: null })
  const [approvalsView, setApprovalsView] = useState(null)
  const [revisionModal, setRevisionModal] = useState({ open: false, quote: null, form: null })
  const [hasRevisionFor, setHasRevisionFor] = useState({})
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [showRevisionsModal, setShowRevisionsModal] = useState(false)
  const [revisionsForQuotation, setRevisionsForQuotation] = useState([])
  const [selectedQuotationForRevisions, setSelectedQuotationForRevisions] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('quotationViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [revisionCounts, setRevisionCounts] = useState({})
  const [expandedRevisionRows, setExpandedRevisionRows] = useState({}) // Track which rows have expanded revisions
  const [quotationRevisionsMap, setQuotationRevisionsMap] = useState({}) // Store revisions per quotation ID
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [search, setSearch] = useState('')
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
  const [revisionProjectMap, setRevisionProjectMap] = useState({}) // Map revision ID to project info
  const [expandedProjectRows, setExpandedProjectRows] = useState({}) // Track which revision rows have expanded projects
  const [revisionProjectDetailsMap, setRevisionProjectDetailsMap] = useState({}) // Store full project details per revision ID
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
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

  const [form, setForm] = useState({
    lead: '',
    companyInfo: defaultCompany,
    submittedTo: '',
    attention: '',
    offerReference: '',
    enquiryNumber: '',
    offerDate: '',
    enquiryDate: '',
    projectTitle: '',
    introductionText: '',
    scopeOfWork: [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
    priceSchedule: {
      items: [{ description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }],
      subTotal: 0,
      grandTotal: 0,
      currency: 'AED',
      taxDetails: { vatRate: 5, vatAmount: 0 }
    },
    ourViewpoints: '',
    exclusions: [''],
    paymentTerms: [{ milestoneDescription: '', amountPercent: '' }],
    deliveryCompletionWarrantyValidity: {
      deliveryTimeline: '',
      warrantyPeriod: '',
      offerValidity: 30,
      authorizedSignatory: ''
    }
  })

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

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user')) || null)
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchLeads(), fetchQuotations()])
      setIsLoading(false)
    }
    void loadData()
  }, [])

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('quotationViewMode', viewMode)
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

  // Note: Legacy localStorage-based auto-open removed - now using route-based modal
  // The CreateQuotationModal handles pre-selection via props

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads')
      setLeads(res.data)
    } catch {}
  }

  const fetchQuotations = async () => {
    try {
      const res = await api.get('/api/quotations')
      setQuotations(res.data)
      try {
        const revRes = await api.get('/api/revisions')
        const revisions = Array.isArray(revRes.data) ? revRes.data : []
        const map = {}
        const counts = {}
        revisions.forEach(r => {
          const parentId = typeof r.parentQuotation === 'object' ? r.parentQuotation?._id : r.parentQuotation
          if (parentId) {
            map[parentId] = true
            counts[parentId] = (counts[parentId] || 0) + 1
          }
        })
        setHasRevisionFor(map)
        setRevisionCounts(counts)
      } catch {}
    } catch {}
  }

  const canCreate = () => currentUser?.roles?.includes('estimation_engineer')

  const recalcTotals = (items, vatRate) => {
    const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
    const vat = sub * (Number(vatRate || 0) / 100)
    const grand = sub + vat
    return { subTotal: Number(sub.toFixed(2)), vatAmount: Number(vat.toFixed(2)), grandTotal: Number(grand.toFixed(2)) }
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

  const openCreate = () => {
    setEditing(null)
    setShowModal(true)
  }

  const handleSave = async (payload, editingQuote) => {
    if (isSubmitting) return
    setLoadingAction(editingQuote ? 'update-quotation' : 'create-quotation')
    setIsSubmitting(true)
    try {
      if (editingQuote) {
        await api.put(`/api/quotations/${editingQuote._id}`, payload)
      } else {
        await api.post('/api/quotations', payload)
      }
      await fetchQuotations()
      setShowModal(false)
      setEditing(null)
      setNotify({ open: true, title: 'Success', message: editingQuote ? 'Quotation updated successfully.' : 'Quotation created successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Save Failed', message: e.response?.data?.message || 'We could not save the quotation. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const approveQuotation = async (q, status, note) => {
    setLoadingAction(`approve-${q._id}-${status}`)
    setIsSubmitting(true)
    try {
      await api.patch(`/api/quotations/${q._id}/approve`, { status, note })
      await fetchQuotations()
      setApprovalModal({ open: false, quote: null, action: null, note: '' })
      setNotify({ open: true, title: status === 'approved' ? 'Quotation Approved' : 'Quotation Rejected', message: `The quotation has been ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: e.response?.data?.message || 'We could not update approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const sendForApproval = async (q) => {
    setLoadingAction(`send-approval-${q._id}`)
    setIsSubmitting(true)
    try {
      await api.patch(`/api/quotations/${q._id}/approve`, { status: 'pending' })
      await fetchQuotations()
      setSendApprovalConfirmModal({ open: false, quote: null })
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: e.response?.data?.message || 'We could not send for approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const handleDeleteQuotation = async (q) => {
    if (isSubmitting) return
    setLoadingAction(`delete-${q._id}`)
    setIsSubmitting(true)
    try {
      await api.delete(`/api/quotations/${q._id}`)
      await fetchQuotations()
      setDeleteModal({ open: false, quote: null })
      setNotify({ open: true, title: 'Deleted', message: 'Quotation deleted successfully.' })
    } catch (e) {
      setDeleteModal({ open: false, quote: null })
      setNotify({ open: true, title: 'Delete Failed', message: e.response?.data?.message || 'We could not delete the quotation. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const createRevision = async (q) => {
    if (isSubmitting) return
    setLoadingAction('create-revision')
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const payload = { ...revisionModal.form }
      const original = q
      const fields = ['companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity']
      let changed = false
      for (const f of fields) {
        if (JSON.stringify(original?.[f] ?? null) !== JSON.stringify(payload?.[f] ?? null)) { changed = true; break }
      }
      if (!changed) { 
        setNotify({ open: true, title: 'No Changes', message: 'No changes detected. Please modify data before creating a revision.' })
        return 
      }
      await api.post('/api/revisions', { sourceQuotationId: q._id, data: payload })
      setNotify({ open: true, title: 'Revision Created', message: 'The revision was created successfully.' })
      setRevisionModal({ open: false, quote: null, form: null })
      setHasRevisionFor({ ...hasRevisionFor, [q._id]: true })
      await fetchQuotations()
    } catch (e) {
      setNotify({ open: true, title: 'Create Failed', message: e.response?.data?.message || 'We could not create the revision. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const exportPDF = async (q) => {
    try {
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(q.companyInfo?.logo || logo)
      const isPending = q.managementApproval?.status === 'pending'

      const currency = q.priceSchedule?.currency || 'AED'
      // Fetch lead details and site visits for inclusion
      let leadFull = q.lead || null
      let siteVisits = []
      try {
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
        .map((s, i) => [
          String(i + 1),
          s.description,
          String(s.quantity || ''),
          s.unit || '',
          s.locationRemarks || ''
        ])

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

      // Title
      content.push({ text: 'Commercial Quotation', style: 'h1', margin: [0, 0, 0, 8] })

      // Cover & Basic Details
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

      // Lead Details (from lead module)
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

      // Introduction
      if ((q.introductionText || '').trim().length > 0) {
        content.push({ text: 'Introduction', style: 'h2', margin: [0, 10, 0, 6] })
        content.push({ text: q.introductionText, margin: [0, 0, 0, 6] })
      }

      // Scope of Work
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

      // Site Visit Reports (compact table)
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

      // Price Schedule
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

      // Our Viewpoints / Exclusions
      if ((q.ourViewpoints || '').trim().length > 0 || exclusions.length > 0) {
        content.push({ text: 'Our Viewpoints / Special Terms', style: 'h2', margin: [0, 12, 0, 6] })
        if ((q.ourViewpoints || '').trim().length > 0) {
          content.push({ text: q.ourViewpoints, margin: [0, 0, 0, 6] })
        }
        if (exclusions.length > 0) {
          content.push({ text: 'Exclusions', style: 'h3', margin: [0, 6, 0, 4] })
          content.push({ ul: exclusions })
        }
      }

      // Payment Terms
      if (paymentTerms.length > 0) {
        content.push({ text: 'Payment Terms', style: 'h2', margin: [0, 12, 0, 6] })
        content.push({
          table: {
            widths: ['10%', '70%', '20%'],
            body: [
              [{ text: '#', style: 'th' }, { text: 'Milestone', style: 'th' }, { text: 'Amount %', style: 'th' }],
              ...paymentTerms.map((p, i) => [String(i + 1), p.milestoneDescription || '', String(p.amountPercent || '')])
            ]
          },
          layout: 'lightHorizontalLines'
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

      // Approval status line
      if (isPending) {
        content.push({ text: 'Management Approval: Pending', italics: true, color: '#b45309', margin: [0, 12, 0, 0] })
      } else if (q.managementApproval?.status === 'approved') {
        content.push({ text: `Approved by: ${q.managementApproval?.approvedBy?.name || 'Management'}`, italics: true, color: '#16a34a', margin: [0, 12, 0, 0] })
      }

      const docDefinition = {
        pageMargins: [36, 96, 36, 60],
        header,
        footer: function (currentPage, pageCount) {
          return {
            margin: [36, 0, 36, 20],
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }] },
              {
                columns: [
                  { text: isPending ? 'Approval Pending' : (q.managementApproval?.status === 'approved' ? 'Approved' : ''), color: isPending ? '#b45309' : '#16a34a' },
                  { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', color: '#94a3b8' }
                ]
              }
            ]
          }
        },
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
        defaultStyle: { fontSize: 10, lineHeight: 1.2 },
        watermark: isPending ? { text: 'Approval Pending', color: '#94a3b8', opacity: 0.12, bold: true } : undefined
      }

      const filename = `${q.projectTitle || 'Quotation'}_${q.offerReference || q._id}.pdf`
      window.pdfMake.createPdf(docDefinition).download(filename)
    } catch (e) {
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF for this quotation. Please try again.' })
    }
  }

  const hasRevisionChanges = (original, form) => {
    if (!original || !form) return false
    const fields = [
      'companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText',
      'scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity'
    ]
    for (const f of fields) {
      if (JSON.stringify(original?.[f] ?? null) !== JSON.stringify(form?.[f] ?? null)) return true
    }
    return false
  }

  const formatHistoryValue = (field, value) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
      if (Array.isArray(value)) {
        if (field === 'paymentTerms') {
          const terms = value || []
          return terms.map((t, i) => `${i + 1}. ${t?.milestoneDescription || '-'} — ${t?.amountPercent ?? ''}%`).join('\n')
        }
        if (field === 'scopeOfWork') {
          const scopes = value || []
          return scopes.map((s, i) => {
            const qtyUnit = [s?.quantity ?? '', s?.unit || ''].filter(x => String(x).trim().length > 0).join(' ')
            const remarks = s?.locationRemarks ? ` — ${s.locationRemarks}` : ''
            return `${i + 1}. ${s?.description || '-'}${qtyUnit ? ` — Qty: ${qtyUnit}` : ''}${remarks}`
          }).join('\n')
        }
        // Fallback for other arrays
        return value.map((v, i) => {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return `${i + 1}. ${String(v)}`
          if (v && typeof v === 'object') {
            const parts = Object.entries(v).map(([k, val]) => `${k}: ${val}`)
            return `${i + 1}. ${parts.join(', ')}`
          }
          return `${i + 1}. ${String(v)}`
        }).join('\n')
      }
      if (typeof value === 'object') {
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
          if (ps?.subTotal !== undefined) lines.push(`Sub Total: ${ps.subTotal}`)
          if (ps?.taxDetails?.vatRate !== undefined || ps?.taxDetails?.vatAmount !== undefined) {
            const rate = ps?.taxDetails?.vatRate ?? ''
            const amt = ps?.taxDetails?.vatAmount ?? ''
            lines.push(`VAT: ${rate}%${amt !== '' ? ` = ${amt}` : ''}`)
          }
          if (ps?.grandTotal !== undefined) lines.push(`Grand Total: ${ps.grandTotal}`)
          return lines.join('\n')
        }
        if (field === 'deliveryCompletionWarrantyValidity') {
          const d = value || {}
          const lines = []
          if (d?.deliveryTimeline) lines.push(`Delivery Timeline: ${d.deliveryTimeline}`)
          if (d?.warrantyPeriod) lines.push(`Warranty Period: ${d.warrantyPeriod}`)
          if (d?.offerValidity !== undefined) lines.push(`Offer Validity: ${d.offerValidity} days`)
          if (d?.authorizedSignatory) lines.push(`Authorized Signatory: ${d.authorizedSignatory}`)
          return lines.join('\n')
        }
        // Generic object pretty-lines
        const entries = Object.entries(value).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        return entries.join('\n')
      }
    } catch {}
    return String(value)
  }

  const onChangeItem = (idx, field, value) => {
    const items = form.priceSchedule.items.map((it, i) => i === idx ? { ...it, [field]: value, totalAmount: Number((Number(field === 'quantity' ? value : it.quantity || 0) * Number(field === 'unitRate' ? value : it.unitRate || 0)).toFixed(2)) } : it)
    const totals = recalcTotals(items, form.priceSchedule.taxDetails.vatRate)
    setForm({ ...form, priceSchedule: { ...form.priceSchedule, items, subTotal: totals.subTotal, grandTotal: totals.grandTotal, taxDetails: { ...form.priceSchedule.taxDetails, vatAmount: totals.vatAmount } } })
  }

  // Handler for View Revisions in table view (accordion)
  const handleViewRevisionsTable = async (q) => {
    const quotationId = q._id
    const isExpanded = expandedRevisionRows[quotationId]
    
    if (isExpanded) {
      // Collapse: remove from expanded rows
      setExpandedRevisionRows(prev => {
        const next = { ...prev }
        delete next[quotationId]
        return next
      })
    } else {
      // Expand: fetch revisions if not already loaded
      if (!quotationRevisionsMap[quotationId]) {
        try {
          const revRes = await api.get(`/api/revisions?parentQuotation=${quotationId}`)
          const revisions = Array.isArray(revRes.data) ? revRes.data : []
          setQuotationRevisionsMap(prev => ({ ...prev, [quotationId]: revisions }))
          
          // Check which revisions have projects
          const projectChecks = {}
          for (const rev of revisions) {
            try {
              const projectRes = await api.get(`/api/projects/by-revision/${rev._id}`)
              projectChecks[rev._id] = projectRes.data
            } catch {
              // No project for this revision
            }
          }
          setRevisionProjectMap(prev => ({ ...prev, ...projectChecks }))
        } catch (e) {
          setNotify({ open: true, title: 'Load Failed', message: 'We could not load the revisions. Please try again.' })
          return
        }
      }
      setExpandedRevisionRows(prev => ({ ...prev, [quotationId]: true }))
    }
  }

  const fetchRevisionProjectDetails = async (revisionId) => {
    if (revisionProjectDetailsMap[revisionId]) return revisionProjectDetailsMap[revisionId]
    
    try {
      const projectInfo = revisionProjectMap[revisionId]
      if (!projectInfo?._id) return null
      
      const res = await api.get(`/api/projects/${projectInfo._id}`)
      const project = res.data
      setRevisionProjectDetailsMap(prev => ({ ...prev, [revisionId]: project }))
      return project
    } catch {
      return null
    }
  }

  const handleViewProjectFromRevision = async (revision, isTable = false) => {
    if (isTable) {
      // Toggle accordion in table view
      const isExpanded = expandedProjectRows[revision._id]
      setExpandedProjectRows(prev => ({ ...prev, [revision._id]: !isExpanded }))
      
      // Fetch project details if not already loaded
      if (!isExpanded && !revisionProjectDetailsMap[revision._id]) {
        await fetchRevisionProjectDetails(revision._id)
      }
    } else {
      // Open modal in card view
      const project = await fetchRevisionProjectDetails(revision._id)
      if (project) {
        setProjectModal({ open: true, project })
      }
    }
  }

  // Handler for View Variations in table view (accordion)
  const handleViewVariationsTable = async (projectId) => {
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

  // Helper function to render quotation actions (used in both card and table views)
  const renderQuotationActions = (q, isTableView = false) => {
    const isApproved = q.managementApproval?.status === 'approved'
    const canDelete = !isApproved || (currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin'))
    return (
    <div className="lead-actions">
      <button className="assign-btn" onClick={() => {
        setEditing(q)
        setShowModal(true)
      }}>Edit</button>
      <button className="save-btn" onClick={() => exportPDF(q)}>Export</button>
      {canDelete && (
        <button 
          className="reject-btn" 
          onClick={() => setDeleteModal({ open: true, quote: q })}
        >
          Delete
        </button>
      )}
      {q.managementApproval?.status === 'approved' && !hasRevisionFor[q._id] && (
        <button className="assign-btn" onClick={() => {
          setRevisionModal({ open: true, quote: q, form: {
            companyInfo: q.companyInfo || defaultCompany,
            submittedTo: q.submittedTo || '',
            attention: q.attention || '',
            offerReference: q.offerReference || '',
            enquiryNumber: q.enquiryNumber || '',
            offerDate: q.offerDate ? q.offerDate.substring(0,10) : '',
            enquiryDate: q.enquiryDate ? q.enquiryDate.substring(0,10) : '',
            projectTitle: q.projectTitle || q.lead?.projectTitle || '',
            introductionText: q.introductionText || '',
            scopeOfWork: q.scopeOfWork?.length ? q.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
            priceSchedule: q.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
            ourViewpoints: q.ourViewpoints || '',
            exclusions: q.exclusions?.length ? q.exclusions : [''],
            paymentTerms: q.paymentTerms?.length ? q.paymentTerms : [{ milestoneDescription: '', amountPercent: ''}],
            deliveryCompletionWarrantyValidity: q.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
          } })
        }}>Create Revision</button>
      )}
      <button className="assign-btn" onClick={() => {
        try {
          localStorage.setItem('quotationId', q._id)
          localStorage.setItem('quotationDetail', JSON.stringify(q))
          const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
          if (leadId) localStorage.setItem('leadId', leadId)
          window.location.href = '/quotation-detail'
        } catch {
          window.location.href = '/quotation-detail'
        }
      }}>Detailed View</button>
      {q.managementApproval?.status === 'pending' ? (
        <span className="status-badge blue">Approval Pending</span>
      ) : (
        q.managementApproval?.status !== 'approved' && q.managementApproval?.status !== 'pending' && !(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && (
          <button className="save-btn" onClick={() => setSendApprovalConfirmModal({ open: true, quote: q })}>Send for Approval</button>
        )
      )}
      <button className="link-btn" onClick={() => setApprovalsView(q)}>View Approvals/Rejections</button>
      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && q.managementApproval?.status === 'pending' && (
        <>
          <button className="approve-btn" onClick={() => setApprovalModal({ open: true, quote: q, action: 'approved', note: '' })}>Approve</button>
          <button className="reject-btn" onClick={() => setApprovalModal({ open: true, quote: q, action: 'rejected', note: '' })}>Reject</button>
        </>
      )}
      {q.lead?._id && (
        <button className="link-btn" onClick={async () => {
          try {
            const res = await api.get(`/api/leads/${q.lead._id}`)
            const visitsRes = await api.get(`/api/leads/${q.lead._id}/site-visits`)
            const detail = { ...res.data, siteVisits: visitsRes.data }
            localStorage.setItem('leadDetail', JSON.stringify(detail))
            localStorage.setItem('leadId', q.lead._id)
            window.location.href = '/lead-detail'
          } catch { setNotify({ open: true, title: 'Open Lead Failed', message: 'We could not open the linked lead. Please try again.' }) }
        }}>View Lead</button>
      )}
      {q.edits?.length > 0 && (
        <button className="link-btn" onClick={() => setHistoryQuote(q)}>View Edit History</button>
      )}
      <button
        className="link-btn"
        onClick={async () => {
          if (isTableView) {
            // Table view: use accordion
            handleViewRevisionsTable(q)
          } else {
            // Card view: use modal
            try {
              const revRes = await api.get(`/api/revisions?parentQuotation=${q._id}`)
              const revisions = Array.isArray(revRes.data) ? revRes.data : []
              setRevisionsForQuotation(revisions)
              setSelectedQuotationForRevisions(q)
              setShowRevisionsModal(true)
              
              // Check which revisions have projects
              const projectChecks = {}
              for (const rev of revisions) {
                try {
                  const projectRes = await api.get(`/api/projects/by-revision/${rev._id}`)
                  projectChecks[rev._id] = projectRes.data
                } catch {
                  // No project for this revision
                }
              }
              setRevisionProjectMap(prev => ({ ...prev, ...projectChecks }))
            } catch (e) {
              setNotify({ open: true, title: 'Open Failed', message: 'We could not load the revisions. Please try again.' })
            }
          }
        }}
      >
        View Revisions
      </button>
    </div>
    )
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

  // Calculate filtered quotations count
  const filteredQuotations = quotations.filter(q => {
    // Apply "My Quotations" filter
    if (myQuotationsOnly && q.createdBy?._id !== currentUser?.id) return false
    
    // Apply Lead filter
    if (selectedLeadFilter) {
      const qLeadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
      if (qLeadId !== selectedLeadFilter) return false
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (q.projectTitle || q.lead?.projectTitle || '').toLowerCase().includes(term) ||
        (q.offerReference || '').toLowerCase().includes(term) ||
        (q.enquiryNumber || q.lead?.enquiryNumber || '').toLowerCase().includes(term) ||
        (q.lead?.customerName || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    // Apply name filter (project title or offer reference) - using debounced value
    if (debouncedNameFilter.trim()) {
      const term = debouncedNameFilter.toLowerCase()
      const projectTitle = (q.projectTitle || q.lead?.projectTitle || '').toLowerCase()
      const offerRef = (q.offerReference || '').toLowerCase()
      if (!projectTitle.includes(term) && !offerRef.includes(term)) return false
    }
    
    // Apply date modified filter - using debounced value
    if (debouncedDateModifiedFilter) {
      const filterDate = new Date(debouncedDateModifiedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const quotationDate = q.updatedAt ? new Date(q.updatedAt) : null
      if (!quotationDate || quotationDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    // Apply date created filter - using debounced value
    if (debouncedDateCreatedFilter) {
      const filterDate = new Date(debouncedDateCreatedFilter)
      filterDate.setHours(0, 0, 0, 0)
      const quotationDate = q.createdAt ? new Date(q.createdAt) : null
      if (!quotationDate || quotationDate.toDateString() !== filterDate.toDateString()) return false
    }
    
    return true
  })

  // Sort quotations by selected field and direction
  const sortedQuotations = [...filteredQuotations].sort((a, b) => {
    let compareResult = 0
    
    switch (sortField) {
      case 'name':
        // Sort by project title, then offer reference
        const aProjectTitle = (a.projectTitle || a.lead?.projectTitle || '').toLowerCase()
        const bProjectTitle = (b.projectTitle || b.lead?.projectTitle || '').toLowerCase()
        const projectTitleCompare = aProjectTitle.localeCompare(bProjectTitle)
        if (projectTitleCompare !== 0) {
          compareResult = projectTitleCompare
        } else {
          // If project titles are equal, sort by offer reference
          const aOfferRef = (a.offerReference || '').toLowerCase()
          const bOfferRef = (b.offerReference || '').toLowerCase()
          compareResult = aOfferRef.localeCompare(bOfferRef)
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

  const totalQuotations = quotations.length
  const displayedQuotations = sortedQuotations.length

  // Pagination calculations
  const totalPages = Math.ceil(sortedQuotations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedQuotations = sortedQuotations.slice(startIndex, endIndex)

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1)
  }, [myQuotationsOnly, selectedLeadFilter, search, debouncedNameFilter, debouncedDateModifiedFilter, debouncedDateCreatedFilter, sortField, sortDirection])

  return (
    <div className="lead-management">
      <div className="header" ref={headerRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Quotation Management</h1>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(myQuotationsOnly || selectedLeadFilter || search || debouncedNameFilter || debouncedDateModifiedFilter || debouncedDateCreatedFilter) ? `${displayedQuotations} of ${totalQuotations}` : totalQuotations} {totalQuotations === 1 ? 'Quotation' : 'Quotations'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myQuotationsOnly} onChange={() => setMyQuotationsOnly(!myQuotationsOnly)} />
            My Quotations
          </label>
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
          <select
            value={selectedLeadFilter}
            onChange={(e) => setSelectedLeadFilter(e.target.value)}
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
            <option value="">All Leads</option>
            {leads.map(lead => (
              <option key={lead._id} value={lead._id}>
                {lead.projectTitle || lead.name || 'Untitled'} - {lead.customerName || 'N/A'}
              </option>
            ))}
          </select>
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
          {canCreate() && (
            <button className="add-btn" onClick={openCreate}>Create Quotation</button>
          )}
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
                    placeholder="Project title or offer reference..."
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
                    aria-label="Filter by project title or offer reference"
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
          {paginatedQuotations.map(q => (
            <div key={q._id} className="lead-card">
              <div className="lead-header">
                <h3>{q.projectTitle || q.lead?.projectTitle || 'Quotation'}</h3>
                {q.managementApproval?.status && (
                  <span className={`status-badge ${q.managementApproval.status === 'approved' ? 'green' : (q.managementApproval.status === 'rejected' ? 'red' : 'blue')}`}>
                    {q.managementApproval.status === 'pending' ? 'Approval Pending' : q.managementApproval.status}
                  </span>
                )}
              </div>
              <div className="lead-details">
                <p><strong>Customer:</strong> {q.lead?.customerName || 'N/A'}</p>
                <p><strong>Enquiry #:</strong> {q.enquiryNumber || q.lead?.enquiryNumber || 'N/A'}</p>
                <p><strong>Offer Ref:</strong> {q.offerReference || 'N/A'}</p>
                <p><strong>Grand Total:</strong> {q.priceSchedule?.currency || 'AED'} {Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
                <p><strong>Revisions:</strong> {revisionCounts[q._id] || 0}</p>
                <p><strong>Created by:</strong> {q.createdBy?._id === currentUser?.id ? 'You' : (q.createdBy?.name || 'N/A')}</p>
                {q.createdBy?._id !== currentUser?.id && q.createdBy && (
                  <button className="link-btn" onClick={() => setProfileUser(q.createdBy)}>
                    View Profile
                  </button>
                )}
                {q.managementApproval?.requestedBy?.name && (
                  <p><strong>Approval sent by:</strong> {q.managementApproval.requestedBy.name} {q.managementApproval.requestedBy?._id && (
                    <button className="link-btn" onClick={() => setProfileUser(q.managementApproval.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                  )}</p>
                )}
                {q.managementApproval?.approvedBy?.name && (
                  <p><strong>Approved by:</strong> {q.managementApproval.approvedBy.name} {q.managementApproval.approvedBy?._id && (
                    <button className="link-btn" onClick={() => setProfileUser(q.managementApproval.approvedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                  )}</p>
                )}
              </div>
              {renderQuotationActions(q)}
            </div>
          ))}
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Project Title</th>
                <th>Customer</th>
                <th>Enquiry #</th>
                <th>Offer Ref</th>
                <th>Offer Date</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Revisions</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQuotations.map(q => {
                const isExpanded = expandedRevisionRows[q._id]
                const revisions = quotationRevisionsMap[q._id] || []
                return (
                  <>
                    <tr key={q._id}>
                      <td data-label="Project Title">{q.projectTitle || q.lead?.projectTitle || 'Quotation'}</td>
                      <td data-label="Customer">{q.lead?.customerName || 'N/A'}</td>
                      <td data-label="Enquiry #">{q.enquiryNumber || q.lead?.enquiryNumber || 'N/A'}</td>
                      <td data-label="Offer Ref">{q.offerReference || 'N/A'}</td>
                      <td data-label="Offer Date">{q.offerDate ? new Date(q.offerDate).toLocaleDateString() : 'N/A'}</td>
                      <td data-label="Grand Total">{(q.priceSchedule?.currency || 'AED')} {Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                      <td data-label="Status">
                        <span className={`status-badge ${q.managementApproval?.status === 'approved' ? 'green' : (q.managementApproval?.status === 'rejected' ? 'red' : 'blue')}`}>
                          {q.managementApproval?.status === 'pending' ? 'Approval Pending' : (q.managementApproval?.status || 'N/A')}
                        </span>
                      </td>
                      <td data-label="Revisions">{revisionCounts[q._id] || 0}</td>
                      <td data-label="Created By">
                        {q.createdBy?._id === currentUser?.id ? 'You' : (q.createdBy?.name || 'N/A')}
                        {q.createdBy?._id !== currentUser?.id && q.createdBy && (
                          <button className="link-btn" onClick={() => setProfileUser(q.createdBy)} style={{ marginLeft: '6px' }}>
                            View Profile
                          </button>
                        )}
                      </td>
                      <td data-label="Actions">
                        {renderQuotationActions(q, true)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${q._id}-revisions`} className="history-row accordion-row">
                        <td colSpan={10} style={{ padding: '0' }}>
                          <div className="history-panel accordion-content" style={{ padding: '16px' }}>
                            <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Revisions ({(quotationRevisionsMap[q._id] || []).length})</h4>
                            {(quotationRevisionsMap[q._id] || []).length === 0 ? (
                              <p style={{ margin: 0, color: 'var(--text-muted)' }}>No revisions found for this quotation.</p>
                            ) : (
                              <div className="table">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Revision #</th>
                                      <th>Offer Ref</th>
                                      <th>Offer Date</th>
                                      <th>Grand Total</th>
                                      <th>Status</th>
                                      <th>Created By</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(quotationRevisionsMap[q._id] || []).map((r) => (
                                      <>
                                        <tr key={r._id}>
                                          <td data-label="Revision #">
                                            {r.parentQuotation?._id || r.parentQuotation ? (
                                              <button
                                                className="link-btn"
                                                onClick={() => {
                                                  try {
                                                    const parentId = typeof r.parentQuotation === 'object' ? r.parentQuotation._id : r.parentQuotation;
                                                    localStorage.setItem('quotationId', parentId);
                                                    localStorage.setItem('quotationDetail', JSON.stringify(r.parentQuotation || {}));
                                                  } catch {}
                                                  window.location.href = '/quotation-detail';
                                                }}
                                                style={{
                                                  fontSize: 'inherit',
                                                  fontWeight: 600,
                                                  padding: 0,
                                                  textDecoration: 'underline'
                                                }}
                                              >
                                                {r.revisionNumber || 'N/A'}
                                              </button>
                                            ) : (
                                              r.revisionNumber || 'N/A'
                                            )}
                                          </td>
                                          <td data-label="Offer Ref">{r.offerReference || 'N/A'}</td>
                                          <td data-label="Offer Date">{r.offerDate ? new Date(r.offerDate).toLocaleDateString() : 'N/A'}</td>
                                          <td data-label="Grand Total">{(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                                          <td data-label="Status">{r.managementApproval?.status || 'pending'}</td>
                                          <td data-label="Created By">{r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}</td>
                                          <td data-label="Actions">
                                            <button
                                              className="save-btn"
                                              onClick={() => {
                                                try {
                                                  localStorage.setItem('revisionId', r._id)
                                                  localStorage.setItem('revisionDetail', JSON.stringify(r))
                                                  const leadId = typeof r.lead === 'object' ? r.lead?._id : r.lead
                                                  if (leadId) localStorage.setItem('leadId', leadId)
                                                } catch {}
                                                window.location.href = '/revision-detail'
                                              }}
                                            >
                                              View
                                            </button>
                                            {revisionProjectMap[r._id] && (
                                              <button
                                                className="link-btn"
                                                onClick={() => handleViewProjectFromRevision(r, true)}
                                                style={{ marginLeft: '6px' }}
                                              >
                                                View Project
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                        {expandedProjectRows[r._id] && revisionProjectDetailsMap[r._id] && (
                                          <tr className="accordion-row">
                                            <td colSpan="7" style={{ padding: '0', borderTop: 'none' }}>
                                              <div className="accordion-content" style={{ padding: '20px', background: 'var(--bg)' }}>
                                                <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Project Details</h4>
                                                <div className="ld-kv" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                                                  <p><strong>Project Name:</strong> {revisionProjectDetailsMap[r._id].name || 'N/A'}</p>
                                                  <p><strong>Status:</strong> {revisionProjectDetailsMap[r._id].status || 'N/A'}</p>
                                                  <p><strong>Location:</strong> {revisionProjectDetailsMap[r._id].locationDetails || 'N/A'}</p>
                                                  <p><strong>Working Hours:</strong> {revisionProjectDetailsMap[r._id].workingHours || 'N/A'}</p>
                                                  <p><strong>Manpower Count:</strong> {revisionProjectDetailsMap[r._id].manpowerCount || 'N/A'}</p>
                                                  <p><strong>Budget:</strong> {revisionProjectDetailsMap[r._id].budget ? `${revisionProjectDetailsMap[r._id].budget}` : 'N/A'}</p>
                                                  <p><strong>Site Engineer:</strong> {revisionProjectDetailsMap[r._id].assignedSiteEngineer?.name || 'Not Assigned'}</p>
                                                  <p><strong>Project Engineer:</strong> {revisionProjectDetailsMap[r._id].assignedProjectEngineer?.name || 'Not Assigned'}</p>
                                                  <p><strong>Created At:</strong> {revisionProjectDetailsMap[r._id].createdAt ? new Date(revisionProjectDetailsMap[r._id].createdAt).toLocaleString() : 'N/A'}</p>
                                                  <p><strong>Created By:</strong> {revisionProjectDetailsMap[r._id].createdBy?.name || 'N/A'}</p>
                                                </div>
                                                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                                  <button className="assign-btn" onClick={() => {
                                                    try {
                                                      localStorage.setItem('projectsFocusId', revisionProjectDetailsMap[r._id]._id)
                                                      localStorage.setItem('projectId', revisionProjectDetailsMap[r._id]._id)
                                                    } catch {}
                                                    window.location.href = '/project-detail'
                                                  }}>
                                                    View Full Project Details
                                                  </button>
                                                  <button
                                                    className="link-btn"
                                                    onClick={() => handleViewVariationsTable(revisionProjectDetailsMap[r._id]._id)}
                                                  >
                                                    View Variations
                                                  </button>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                        {revisionProjectDetailsMap[r._id] && expandedVariationRows[revisionProjectDetailsMap[r._id]._id] && (
                                          <tr key={`${r._id}-variations`} className="accordion-row">
                                            <td colSpan={7} style={{ padding: '0', borderTop: 'none' }}>
                                              <div className="accordion-content" style={{ padding: '16px', background: 'var(--bg)' }}>
                                                <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Variations ({(projectVariationsMap[revisionProjectDetailsMap[r._id]._id] || []).length})</h4>
                                                {(projectVariationsMap[revisionProjectDetailsMap[r._id]._id] || []).length === 0 ? (
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
                                                        {(projectVariationsMap[revisionProjectDetailsMap[r._id]._id] || []).sort((a,b)=> (a.variationNumber||0)-(b.variationNumber||0)).map((v) => (
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
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredQuotations.length > 0 && (
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredQuotations.length)} of {filteredQuotations.length}
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

      <CreateQuotationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditing(null)
        }}
        source="quotations"
        onSave={handleSave}
        editing={editing}
        leads={leads}
      />

      {/* Legacy modal code - keeping for reference but disabled */}
      {false && showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Quotation' : 'Create Quotation'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); }} className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <div className="form-group">
                <label>Select Lead *</label>
                <select value={form.lead} onChange={e => setForm({ ...form, lead: e.target.value })} required>
                  <option value="">-- Choose Lead --</option>
                  {leads.map(l => (
                    <option value={l._id} key={l._id}>{l.projectTitle || l.name} — {l.customerName}</option>
                  ))}
                </select>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Cover & Basic Details</h3>
                </div>
                <div className="form-group">
                  <label>Submitted To (Client Company)</label>
                  <input type="text" value={form.submittedTo} onChange={e => setForm({ ...form, submittedTo: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Attention (Contact Person)</label>
                  <input type="text" value={form.attention} onChange={e => setForm({ ...form, attention: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Reference</label>
                    <input type="text" value={form.offerReference} onChange={e => setForm({ ...form, offerReference: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Number</label>
                    <input type="text" value={form.enquiryNumber} onChange={e => setForm({ ...form, enquiryNumber: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Date</label>
                    <input type="date" value={form.offerDate} onChange={e => setForm({ ...form, offerDate: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Date</label>
                    <input type="date" value={form.enquiryDate} onChange={e => setForm({ ...form, enquiryDate: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <div className="section-header">
                  <h3>Project Details</h3>
                </div>
                <div className="form-group">
                  <label>Project Title</label>
                  <input type="text" value={form.projectTitle} onChange={e => setForm({ ...form, projectTitle: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Introduction</label>
                  <textarea value={form.introductionText} onChange={e => setForm({ ...form, introductionText: e.target.value })} />
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Scope of Work</h3>
                </div>
                {form.scopeOfWork.map((s, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setForm({ ...form, scopeOfWork: form.scopeOfWork.filter((_, idx) => idx !== i) })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Description</label>
                        <textarea value={s.description} onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Qty</label>
                        <input type="number" value={s.quantity} onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit</label>
                        <input type="text" value={s.unit} onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) })} />
                      </div>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Location/Remarks</label>
                        <input type="text" value={s.locationRemarks} onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, locationRemarks: e.target.value } : x) })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setForm({ ...form, scopeOfWork: [...form.scopeOfWork, { description: '', quantity: '', unit: '', locationRemarks: '' }] })}>+ Add Scope Item</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Price Schedule</h3>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Currency</label>
                    <input type="text" value={form.priceSchedule.currency} onChange={e => setForm({ ...form, priceSchedule: { ...form.priceSchedule, currency: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>VAT %</label>
                    <input type="number" value={form.priceSchedule.taxDetails.vatRate} onChange={e => {
                      const totals = recalcTotals(form.priceSchedule.items, e.target.value)
                      setForm({ ...form, priceSchedule: { ...form.priceSchedule, subTotal: totals.subTotal, grandTotal: totals.grandTotal, taxDetails: { ...form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: totals.vatAmount } } })
                    }} />
                  </div>
                </div>
                {form.priceSchedule.items.map((it, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => {
                        const items = form.priceSchedule.items.filter((_, idx) => idx !== i)
                        const totals = recalcTotals(items, form.priceSchedule.taxDetails.vatRate)
                        setForm({ ...form, priceSchedule: { ...form.priceSchedule, items, subTotal: totals.subTotal, grandTotal: totals.grandTotal, taxDetails: { ...form.priceSchedule.taxDetails, vatAmount: totals.vatAmount } } })
                      }}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Description</label>
                        <input type="text" value={it.description} onChange={e => onChangeItem(i, 'description', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Qty</label>
                        <input type="number" value={it.quantity} onChange={e => onChangeItem(i, 'quantity', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit</label>
                        <input type="text" value={it.unit} onChange={e => onChangeItem(i, 'unit', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit Rate</label>
                        <input type="number" value={it.unitRate} onChange={e => onChangeItem(i, 'unitRate', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Amount</label>
                        <input type="number" value={Number(it.totalAmount || 0)} readOnly />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setForm({ ...form, priceSchedule: { ...form.priceSchedule, items: [...form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } })}>+ Add Item</button>
                </div>

                <div className="totals-card">
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Sub Total</label>
                      <input type="number" readOnly value={Number(form.priceSchedule.subTotal || 0)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>VAT Amount</label>
                      <input type="number" readOnly value={Number(form.priceSchedule.taxDetails.vatAmount || 0)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Grand Total</label>
                      <input type="number" readOnly value={Number(form.priceSchedule.grandTotal || 0)} />
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
                  <textarea value={form.ourViewpoints} onChange={e => setForm({ ...form, ourViewpoints: e.target.value })} />
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Exclusions</h3>
                </div>
                {form.exclusions.map((ex, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setForm({ ...form, exclusions: form.exclusions.filter((_, idx) => idx !== i) })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <input type="text" value={ex} onChange={e => setForm({ ...form, exclusions: form.exclusions.map((x, idx) => idx === i ? e.target.value : x) })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setForm({ ...form, exclusions: [...form.exclusions, ''] })}>+ Add Exclusion</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Payment Terms</h3>
                </div>
                {form.paymentTerms.map((p, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Term {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setForm({ ...form, paymentTerms: form.paymentTerms.filter((_, idx) => idx !== i) })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Milestone</label>
                        <input type="text" value={p.milestoneDescription} onChange={e => setForm({ ...form, paymentTerms: form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Amount %</label>
                        <input type="number" value={p.amountPercent} onChange={e => setForm({ ...form, paymentTerms: form.paymentTerms.map((x, idx) => idx === i ? { ...x, amountPercent: e.target.value } : x) })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setForm({ ...form, paymentTerms: [...form.paymentTerms, { milestoneDescription: '', amountPercent: '' }] })}>+ Add Payment Term</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Delivery, Completion, Warranty & Validity</h3>
                </div>
                <div className="form-group">
                  <label>Delivery / Completion Timeline</label>
                  <input type="text" value={form.deliveryCompletionWarrantyValidity.deliveryTimeline} onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } })} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Warranty Period</label>
                    <input type="text" value={form.deliveryCompletionWarrantyValidity.warrantyPeriod} onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Validity (Days)</label>
                    <input type="number" value={form.deliveryCompletionWarrantyValidity.offerValidity} onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Authorized Signatory</label>
                  <input type="text" value={form.deliveryCompletionWarrantyValidity.authorizedSignatory} onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } })} />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">{editing ? 'Save Changes' : 'Create Quotation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendApprovalConfirmModal.open && (
        <div className="modal-overlay" onClick={() => setSendApprovalConfirmModal({ open: false, quote: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Send for Approval</h2>
              <button onClick={() => setSendApprovalConfirmModal({ open: false, quote: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to send this quotation for approval?</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setSendApprovalConfirmModal({ open: false, quote: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={() => {
                    if (sendApprovalConfirmModal.quote) {
                      sendForApproval(sendApprovalConfirmModal.quote)
                    }
                  }}
                  disabled={isSubmitting && loadingAction === `send-approval-${sendApprovalConfirmModal.quote?._id}`}
                >
                  {isSubmitting && loadingAction === `send-approval-${sendApprovalConfirmModal.quote?._id}` ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, quote: null, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Quotation' : 'Reject Quotation'}</h2>
              <button onClick={() => setApprovalModal({ open: false, quote: null, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, quote: null, action: null, note: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  if (!approvalModal.quote || !approvalModal.action) return
                  await approveQuotation(approvalModal.quote, approvalModal.action, approvalModal.note)
                  setApprovalModal({ open: false, quote: null, action: null, note: '' })
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModal.open && deleteModal.quote && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false, quote: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Quotation</h2>
              <button onClick={() => setDeleteModal({ open: false, quote: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to delete this quotation? This action cannot be undone.</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setDeleteModal({ open: false, quote: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="reject-btn" 
                  onClick={() => handleDeleteQuotation(deleteModal.quote)}
                  disabled={isSubmitting && loadingAction === `delete-${deleteModal.quote._id}`}
                >
                  <ButtonLoader loading={loadingAction === `delete-${deleteModal.quote._id}`}>
                    {isSubmitting && loadingAction === `delete-${deleteModal.quote._id}` ? 'Deleting...' : 'Delete'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {revisionModal.open && (
        <div className="modal-overlay" onClick={() => setRevisionModal({ open: false, quote: null, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Revision</h2>
              <button onClick={() => setRevisionModal({ open: false, quote: null, form: null })} className="close-btn">×</button>
            </div>
            {revisionModal.form && (
              <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                <div className="form-section">
                  <div className="section-header">
                    <h3>Cover & Basic Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Submitted To (Client Company)</label>
                    <input type="text" value={revisionModal.form.submittedTo} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, submittedTo: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Attention (Contact Person)</label>
                    <input type="text" value={revisionModal.form.attention} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, attention: e.target.value } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Reference</label>
                      <input type="text" value={revisionModal.form.offerReference} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, offerReference: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Number</label>
                      <input type="text" value={revisionModal.form.enquiryNumber} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, enquiryNumber: e.target.value } })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Date</label>
                      <input type="date" value={revisionModal.form.offerDate} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, offerDate: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Date</label>
                      <input type="date" value={revisionModal.form.enquiryDate} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, enquiryDate: e.target.value } })} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Project Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Project Title</label>
                    <input type="text" value={revisionModal.form.projectTitle} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, projectTitle: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Introduction</label>
                    <textarea value={revisionModal.form.introductionText} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, introductionText: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Scope of Work</h3>
                  </div>
                  {revisionModal.form.scopeOfWork.map((s, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: revisionModal.form.scopeOfWork.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Description</label>
                          <textarea value={s.description} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: revisionModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Qty</label>
                          <input type="number" value={s.quantity} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: revisionModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit</label>
                          <input type="text" value={s.unit} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: revisionModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 2 }}>
                          <label>Location/Remarks</label>
                          <input type="text" value={s.locationRemarks} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: revisionModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, locationRemarks: e.target.value } : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: [...revisionModal.form.scopeOfWork, { description: '', quantity: '', unit: '', locationRemarks: '' }] } })}>+ Add Scope Item</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Price Schedule</h3>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Currency</label>
                      <input type="text" value={revisionModal.form.priceSchedule.currency} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, currency: e.target.value } } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>VAT %</label>
                      <input type="number" value={revisionModal.form.priceSchedule.taxDetails.vatRate} onChange={e => {
                        const items = revisionModal.form.priceSchedule.items
                        const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                        const vat = sub * (Number(e.target.value || 0) / 100)
                        const grand = sub + vat
                        setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...revisionModal.form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: Number(vat.toFixed(2)) } } } })
                      }} />
                    </div>
                  </div>
                  {revisionModal.form.priceSchedule.items.map((it, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => {
                          const items = revisionModal.form.priceSchedule.items.filter((_, idx) => idx !== i)
                          const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                          const vat = sub * (Number(revisionModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...revisionModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                        }}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Description</label>
                          <input type="text" value={it.description} onChange={e => {
                            const items = revisionModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x)
                            setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Qty</label>
                          <input type="number" value={it.quantity} onChange={e => {
                            const items = revisionModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value, totalAmount: Number((Number(e.target.value || 0) * Number(x.unitRate || 0)).toFixed(2)) } : x)
                            const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                            const vat = sub * (Number(revisionModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                            const grand = sub + vat
                            setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...revisionModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit</label>
                          <input type="text" value={it.unit} onChange={e => {
                            const items = revisionModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x)
                            setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items } } })
                          }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Unit Rate</label>
                          <input type="number" value={it.unitRate} onChange={e => {
                            const items = revisionModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unitRate: e.target.value, totalAmount: Number((Number(x.quantity || 0) * Number(e.target.value || 0)).toFixed(2)) } : x)
                            const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                            const vat = sub * (Number(revisionModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                            const grand = sub + vat
                            setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...revisionModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
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
                    <button type="button" className="link-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: { ...revisionModal.form.priceSchedule, items: [...revisionModal.form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } } })}>+ Add Item</button>
                  </div>

                  <div className="totals-card">
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Sub Total</label>
                        <input type="number" readOnly value={Number(revisionModal.form.priceSchedule.subTotal || 0)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>VAT Amount</label>
                        <input type="number" readOnly value={Number(revisionModal.form.priceSchedule.taxDetails.vatAmount || 0)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Grand Total</label>
                        <input type="number" readOnly value={Number(revisionModal.form.priceSchedule.grandTotal || 0)} />
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
                    <textarea value={revisionModal.form.ourViewpoints} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, ourViewpoints: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Exclusions</h3>
                  </div>
                  {revisionModal.form.exclusions.map((ex, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Item {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, exclusions: revisionModal.form.exclusions.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                          <input type="text" value={ex} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, exclusions: revisionModal.form.exclusions.map((x, idx) => idx === i ? e.target.value : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, exclusions: [...revisionModal.form.exclusions, ''] } })}>+ Add Exclusion</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Payment Terms</h3>
                  </div>
                  {revisionModal.form.paymentTerms.map((p, i) => (
                    <div key={i} className="item-card">
                      <div className="item-header">
                        <span>Term {i + 1}</span>
                        <button type="button" className="cancel-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, paymentTerms: revisionModal.form.paymentTerms.filter((_, idx) => idx !== i) } })}>Remove</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 3 }}>
                          <label>Milestone</label>
                          <input type="text" value={p.milestoneDescription} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, paymentTerms: revisionModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) } })} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Amount %</label>
                          <input type="number" value={p.amountPercent} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, paymentTerms: revisionModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, amountPercent: e.target.value } : x) } })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="section-actions">
                    <button type="button" className="link-btn" onClick={() => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, paymentTerms: [...revisionModal.form.paymentTerms, { milestoneDescription: '', amountPercent: '' }] } })}>+ Add Payment Term</button>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Delivery, Completion, Warranty & Validity</h3>
                  </div>
                  <div className="form-group">
                    <label>Delivery / Completion Timeline</label>
                    <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity.deliveryTimeline} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Warranty Period</label>
                      <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity.warrantyPeriod} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Validity (Days)</label>
                      <input type="number" value={revisionModal.form.deliveryCompletionWarrantyValidity.offerValidity} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } } })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Authorized Signatory</label>
                    <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity.authorizedSignatory} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } } })} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setRevisionModal({ open: false, quote: null, form: null })}>Cancel</button>
                  <button type="button" className="save-btn" disabled={!hasRevisionChanges(revisionModal.quote, revisionModal.form)} onClick={() => createRevision(revisionModal.quote)}>Confirm Revision</button>
                </div>
              </div>
            )}
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
                const q = approvalsView
                const rawLogs = Array.isArray(q.managementApproval?.logs) ? q.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
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

                // Fallback for legacy records without logs
                if (cycles.length === 0 && (q.managementApproval?.requestedBy || q.managementApproval?.approvedBy)) {
                  cycles.push({
                    requestedAt: q.updatedAt || q.createdAt,
                    requestedBy: q.managementApproval?.requestedBy,
                    requestNote: q.managementApproval?.comments,
                    decidedAt: q.managementApproval?.approvedAt,
                    decidedBy: q.managementApproval?.approvedBy,
                    decisionNote: q.managementApproval?.comments,
                    decisionStatus: q.managementApproval?.status
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
                          </>)}</div>
                          {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                          <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<>
                            by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
                            {c.decidedBy?._id && c.decidedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.decidedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)} {c.decisionStatus && <span style={{ marginLeft: 6, textTransform: 'uppercase' }}>({c.decisionStatus})</span>}</div>
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

      {historyQuote && (
        <div className="modal-overlay history" onClick={() => setHistoryQuote(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit History</h2>
              <button onClick={() => setHistoryQuote(null)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {historyQuote.edits && historyQuote.edits.length > 0 ? (
                historyQuote.edits.slice().reverse().map((edit, idx) => (
                  <div key={idx} className="edit-item">
                    <div className="edit-header">
                      <span>By {edit.editedBy?._id === currentUser?.id ? 'You' : edit.editedBy?.name}</span>
                      <span>{new Date(edit.editedAt).toLocaleString()}</span>
                    </div>
                    <ul className="changes-list">
                      {edit.changes.map((c, i) => (
                        <li key={i}>
                          <strong>{c.field}:</strong>
                          <div className="change-diff">
                            <pre className="change-block">{formatHistoryValue(c.field, c.from)}</pre>
                            <span>→</span>
                            <pre className="change-block">{formatHistoryValue(c.field, c.to)}</pre>
                          </div>
                        </li>
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

      {showRevisionsModal && selectedQuotationForRevisions && (
        <div className="modal-overlay" onClick={() => {
          setShowRevisionsModal(false)
          setSelectedQuotationForRevisions(null)
          setRevisionsForQuotation([])
        }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h2>Revisions for {selectedQuotationForRevisions.projectTitle || selectedQuotationForRevisions.offerReference || 'Quotation'}</h2>
              <button onClick={() => {
                setShowRevisionsModal(false)
                setSelectedQuotationForRevisions(null)
                setRevisionsForQuotation([])
              }} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {revisionsForQuotation.length === 0 ? (
                <p>No revisions found for this quotation.</p>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Revision #</th>
                        <th>Offer Ref</th>
                        <th>Offer Date</th>
                        <th>Grand Total</th>
                        <th>Status</th>
                        <th>Created By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revisionsForQuotation.map((r) => (
                        <tr key={r._id}>
                          <td data-label="Revision #">
                            {r.parentQuotation?._id || r.parentQuotation ? (
                              <button
                                className="link-btn"
                                onClick={() => {
                                  try {
                                    const parentId = typeof r.parentQuotation === 'object' ? r.parentQuotation._id : r.parentQuotation;
                                    localStorage.setItem('quotationId', parentId);
                                    localStorage.setItem('quotationDetail', JSON.stringify(r.parentQuotation || {}));
                                  } catch {}
                                  window.location.href = '/quotation-detail';
                                }}
                                style={{
                                  fontSize: 'inherit',
                                  fontWeight: 600,
                                  padding: 0,
                                  textDecoration: 'underline'
                                }}
                              >
                                {r.revisionNumber || 'N/A'}
                              </button>
                            ) : (
                              r.revisionNumber || 'N/A'
                            )}
                          </td>
                          <td data-label="Offer Ref">{r.offerReference || 'N/A'}</td>
                          <td data-label="Offer Date">{r.offerDate ? new Date(r.offerDate).toLocaleDateString() : 'N/A'}</td>
                          <td data-label="Grand Total">{(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                          <td data-label="Status">{r.managementApproval?.status || 'pending'}</td>
                          <td data-label="Created By">{r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}</td>
                          <td data-label="Actions">
                            <button
                              className="save-btn"
                              onClick={() => {
                                try {
                                  localStorage.setItem('revisionId', r._id)
                                  localStorage.setItem('revisionDetail', JSON.stringify(r))
                                  const leadId = typeof r.lead === 'object' ? r.lead?._id : r.lead
                                  if (leadId) localStorage.setItem('leadId', leadId)
                                } catch {}
                                window.location.href = '/revision-detail'
                              }}
                            >
                              View
                            </button>
                            {revisionProjectMap[r._id] && (
                              <button
                                className="link-btn"
                                onClick={() => handleViewProjectFromRevision(r, false)}
                                style={{ marginLeft: '6px' }}
                              >
                                View Project
                              </button>
                            )}
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

      {showVariationsListModal && selectedProjectForList && (
        <div className="modal-overlay" onClick={() => {
          setShowVariationsListModal(false)
          setSelectedProjectForList(null)
          setVariationsForProject([])
        }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', width: '900px' }}>
            <div className="modal-header">
              <h2>Variations for {selectedProjectForList.name}</h2>
              <button onClick={() => {
                setShowVariationsListModal(false)
                setSelectedProjectForList(null)
                setVariationsForProject([])
              }} className="close-btn">×</button>
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

export default QuotationManagement


