import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import './ProjectManagement.css'
import './LoadingComponents.css'
import { Spinner, SkeletonCard, SkeletonTableRow, ButtonLoader, PageSkeleton } from './LoadingComponents'

function ProjectManagement() {
  const [projects, setProjects] = useState([])
  const [siteEngineers, setSiteEngineers] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [assignData, setAssignData] = useState({ siteEngineerId: '' })
  const [deleteModal, setDeleteModal] = useState({ open: false, project: null })
  const [revisionData, setRevisionData] = useState({
    type: 'price',
    description: ''
  })
  const [editProjectModal, setEditProjectModal] = useState({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
  const [visitData, setVisitData] = useState({
    visitAt: '',
    siteLocation: '',
    engineerName: '',
    workProgressSummary: '',
    safetyObservations: '',
    qualityMaterialCheck: '',
    issuesFound: '',
    actionItems: '',
    weatherConditions: '',
    description: ''
  })
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [projectEngineers, setProjectEngineers] = useState([])
  const [profileUser, setProfileUser] = useState(null)
  const [historyOpen, setHistoryOpen] = useState({})
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('projectViewMode')
    return saved === 'table' ? 'table' : 'card' // default to 'card' if not set
  })
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [revisions, setRevisions] = useState([])
  const [selectedRevisionFilter, setSelectedRevisionFilter] = useState('')
  const [variationModal, setVariationModal] = useState({ open: false, project: null, form: null })
  const [allVariations, setAllVariations] = useState([])
  const [variationWarningModal, setVariationWarningModal] = useState({ open: false, project: null, existingVariations: [] })
  const [editProjectWarningModal, setEditProjectWarningModal] = useState({ open: false, project: null, existingVariations: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)
  
  const defaultCompany = useMemo(() => ({
    logo: null,
    name: 'WBES',
    address: 'Dubai, UAE',
    phone: '+971-00-000-0000',
    email: 'info@wbes.example'
  }), [])

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

  const exportProjectPDF = async (project) => {
    try {
      await ensurePdfMake()
      const token = localStorage.getItem('token')
      // Fetch all related data
      let siteVisits = []
      let quotation = null
      let allRevisions = []
      let leadFull = null
      try {
        const resVisits = await api.get(`/api/site-visits/project/${project._id}`)
        siteVisits = Array.isArray(resVisits.data) ? resVisits.data : []
      } catch {}
      try {
        const leadId = typeof project.leadId === 'object' ? project.leadId?._id : project.leadId
        if (leadId) {
          const leadRes = await api.get(`/api/leads/${leadId}`)
          leadFull = leadRes.data
        }
      } catch {}
      try {
        if (project.sourceQuotation?._id) {
          const qRes = await api.get(`/api/quotations/${project.sourceQuotation._id}`)
          quotation = qRes.data
        }
      } catch {}
      try {
        if (project.sourceRevision?.parentQuotation) {
          const revRes = await api.get(`/api/revisions?parentQuotation=${project.sourceRevision.parentQuotation}`)
          allRevisions = Array.isArray(revRes.data) ? revRes.data : []
        }
      } catch {}

      const content = []
      content.push({ text: `Project — ${project.name}`, style: 'h1', margin: [0, 0, 0, 8] })

      // 1. PROJECT DETAILS (Complete)
      const projectRows = [
        ['Project Name', project.name || ''],
        ['Status', project.status || ''],
        ['Location Details', project.locationDetails || ''],
        ['Working Hours', project.workingHours || ''],
        ['Manpower Count', String(project.manpowerCount || '')],
        ['Budget', project.budget ? `${project.budget}` : ''],
        ['Site Engineer', project.assignedSiteEngineer?.name || 'Not Assigned'],
        ['Project Engineer', project.assignedProjectEngineer?.name || 'Not Assigned'],
        ['Created At', project.createdAt ? new Date(project.createdAt).toLocaleString() : ''],
        ['Created By', project.createdBy?.name || 'N/A']
      ].filter(([, v]) => v && String(v).trim().length > 0)
      content.push({ text: 'Project Details', style: 'h2', margin: [0, 6, 0, 6] })
      content.push({
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
            ...projectRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
          ]
        },
        layout: 'lightHorizontalLines'
      })

      // 2. LEAD DETAILS (Complete)
      if (leadFull) {
        const leadRows = [
          ['Customer Name', leadFull.customerName || ''],
          ['Project Title', leadFull.projectTitle || ''],
          ['Enquiry Number', leadFull.enquiryNumber || ''],
          ['Enquiry Date', leadFull.enquiryDate ? new Date(leadFull.enquiryDate).toLocaleDateString() : ''],
          ['Submission Due Date', leadFull.submissionDueDate ? new Date(leadFull.submissionDueDate).toLocaleDateString() : ''],
          ['Scope Summary', leadFull.scopeSummary || ''],
          ['Name', leadFull.name || ''],
          ['Budget', leadFull.budget ? `${leadFull.budget}` : ''],
          ['Location Details', leadFull.locationDetails || ''],
          ['Working Hours', leadFull.workingHours || ''],
          ['Manpower Count', String(leadFull.manpowerCount || '')],
          ['Status', leadFull.status || ''],
          ['Created At', leadFull.createdAt ? new Date(leadFull.createdAt).toLocaleString() : ''],
          ['Created By', leadFull.createdBy?.name || 'N/A']
        ].filter(([, v]) => v && String(v).trim().length > 0)
        if (leadRows.length > 0) {
          content.push({ text: 'Lead Details', style: 'h2', margin: [0, 12, 0, 6] })
          content.push({
            table: {
              widths: ['30%', '70%'],
              body: [
                [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                ...leadRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
              ]
            },
            layout: 'lightHorizontalLines'
          })
        }
      }

      // 3. QUOTATION DETAILS (Complete)
      if (quotation) {
        const q = quotation
        const currency = q.priceSchedule?.currency || 'AED'
        
        // Basic Quotation Info
        const qBasicRows = [
          ['Submitted To', q.submittedTo || ''],
          ['Attention', q.attention || ''],
          ['Offer Reference', q.offerReference || ''],
          ['Enquiry Number', q.enquiryNumber || ''],
          ['Offer Date', q.offerDate ? new Date(q.offerDate).toLocaleDateString() : ''],
          ['Enquiry Date', q.enquiryDate ? new Date(q.enquiryDate).toLocaleDateString() : ''],
          ['Project Title', q.projectTitle || ''],
          ['Introduction Text', q.introductionText || ''],
          ['Our Viewpoints', q.ourViewpoints || ''],
          ['Created At', q.createdAt ? new Date(q.createdAt).toLocaleString() : ''],
          ['Created By', q.createdBy?.name || 'N/A']
        ].filter(([, v]) => v && String(v).trim().length > 0)
        if (qBasicRows.length > 0) {
          content.push({ text: 'Quotation Details', style: 'h2', margin: [0, 12, 0, 6] })
          content.push({
            table: {
              widths: ['30%', '70%'],
              body: [
                [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                ...qBasicRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
              ]
            },
            layout: 'lightHorizontalLines'
          })
        }

        // Company Info
        if (q.companyInfo && (q.companyInfo.name || q.companyInfo.address || q.companyInfo.phone || q.companyInfo.email)) {
          const compRows = [
            ['Company Name', q.companyInfo.name || ''],
            ['Address', q.companyInfo.address || ''],
            ['Phone', q.companyInfo.phone || ''],
            ['Email', q.companyInfo.email || '']
          ].filter(([, v]) => v && String(v).trim().length > 0)
          if (compRows.length > 0) {
            content.push({ text: 'Company Information', style: 'h2', margin: [0, 12, 0, 6] })
            content.push({
              table: {
                widths: ['30%', '70%'],
                body: [
                  [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                  ...compRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }
        }

        // Scope of Work
        if (Array.isArray(q.scopeOfWork) && q.scopeOfWork.length > 0) {
          const scopeRows = q.scopeOfWork
            .filter(s => (s?.description || '').trim().length > 0)
            .map((s, i) => [String(i + 1), s.description || '', String(s.quantity || ''), s.unit || '', s.locationRemarks || ''])
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
        }

        // Price Schedule
        if (q.priceSchedule) {
          const priceItems = (q.priceSchedule.items || [])
            .filter(it => (it?.description || '').trim().length > 0 || Number(it.quantity) > 0 || Number(it.unitRate) > 0)
          const priceRows = priceItems.map((it, i) => [
            String(i + 1),
            it.description || '',
            String(it.quantity || 0),
            it.unit || '',
            `${currency} ${Number(it.unitRate || 0).toFixed(2)}`,
            `${currency} ${Number((it.quantity || 0) * (it.unitRate || 0)).toFixed(2)}`
          ])
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
        }

        // Exclusions
        if (Array.isArray(q.exclusions) && q.exclusions.length > 0) {
          const exclText = q.exclusions.map(x => String(x || '').trim()).filter(Boolean).join(', ')
          if (exclText) {
            content.push({ text: 'Exclusions', style: 'h2', margin: [0, 12, 0, 6] })
            content.push({ text: exclText, margin: [0, 0, 0, 0] })
          }
        }

        // Payment Terms
        if (Array.isArray(q.paymentTerms) && q.paymentTerms.length > 0) {
          const payRows = q.paymentTerms
            .filter(p => (p?.milestoneDescription || '').trim().length > 0 || String(p?.amountPercent || '').trim().length > 0)
            .map(p => [p.milestoneDescription || '', `${p.amountPercent || 0}%`])
          if (payRows.length > 0) {
            content.push({ text: 'Payment Terms', style: 'h2', margin: [0, 12, 0, 6] })
            content.push({
              table: {
                widths: ['70%', '30%'],
                body: [
                  [{ text: 'Milestone Description', style: 'th' }, { text: 'Amount %', style: 'th' }],
                  ...payRows
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }
        }

        // Delivery/Completion/Warranty/Validity
        if (q.deliveryCompletionWarrantyValidity) {
          const dcwv = q.deliveryCompletionWarrantyValidity
          const dcwvRows = [
            ['Delivery Timeline', dcwv.deliveryTimeline || ''],
            ['Warranty Period', dcwv.warrantyPeriod || ''],
            ['Offer Validity (Days)', typeof dcwv.offerValidity === 'number' ? String(dcwv.offerValidity) : (dcwv.offerValidity || '')],
            ['Authorized Signatory', dcwv.authorizedSignatory || '']
          ].filter(([, v]) => v && String(v).trim().length > 0)
          if (dcwvRows.length > 0) {
            content.push({ text: 'Delivery/Completion/Warranty/Validity', style: 'h2', margin: [0, 12, 0, 6] })
            content.push({
              table: {
                widths: ['30%', '70%'],
                body: [
                  [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                  ...dcwvRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }
        }

        // Management Approval
        if (q.managementApproval) {
          const maRows = [
            ['Status', q.managementApproval.status || ''],
            ['Approved By', q.managementApproval.approvedBy?.name || ''],
            ['Approved At', q.managementApproval.approvedAt ? new Date(q.managementApproval.approvedAt).toLocaleString() : ''],
            ['Comments', q.managementApproval.comments || '']
          ].filter(([, v]) => v && String(v).trim().length > 0)
          if (maRows.length > 0) {
            content.push({ text: 'Management Approval', style: 'h2', margin: [0, 12, 0, 6] })
            content.push({
              table: {
                widths: ['30%', '70%'],
                body: [
                  [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                  ...maRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }
        }
      }

      // 4. ALL REVISIONS DETAILS (Complete)
      if (Array.isArray(allRevisions) && allRevisions.length > 0) {
        const sortedRevs = allRevisions.sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0))
        sortedRevs.forEach((rev, idx) => {
          const currency = rev.priceSchedule?.currency || 'AED'
          content.push({ text: `Revision #${rev.revisionNumber}`, style: 'h2', margin: [0, 12, 0, 6] })
          
          // Basic Revision Info
          const revBasicRows = [
            ['Submitted To', rev.submittedTo || ''],
            ['Attention', rev.attention || ''],
            ['Offer Reference', rev.offerReference || ''],
            ['Enquiry Number', rev.enquiryNumber || ''],
            ['Offer Date', rev.offerDate ? new Date(rev.offerDate).toLocaleDateString() : ''],
            ['Enquiry Date', rev.enquiryDate ? new Date(rev.enquiryDate).toLocaleDateString() : ''],
            ['Project Title', rev.projectTitle || ''],
            ['Introduction Text', rev.introductionText || ''],
            ['Our Viewpoints', rev.ourViewpoints || ''],
            ['Created At', rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ''],
            ['Created By', rev.createdBy?.name || 'N/A']
          ].filter(([, v]) => v && String(v).trim().length > 0)
          if (revBasicRows.length > 0) {
            content.push({
              table: {
                widths: ['30%', '70%'],
                body: [
                  [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                  ...revBasicRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }

          // Scope of Work
          if (Array.isArray(rev.scopeOfWork) && rev.scopeOfWork.length > 0) {
            const scopeRows = rev.scopeOfWork
              .filter(s => (s?.description || '').trim().length > 0)
              .map((s, i) => [String(i + 1), s.description || '', String(s.quantity || ''), s.unit || '', s.locationRemarks || ''])
            if (scopeRows.length > 0) {
              content.push({ text: 'Scope of Work', style: 'h3', margin: [0, 8, 0, 4] })
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
          }

          // Price Schedule
          if (rev.priceSchedule) {
            const priceItems = (rev.priceSchedule.items || [])
              .filter(it => (it?.description || '').trim().length > 0 || Number(it.quantity) > 0 || Number(it.unitRate) > 0)
            const priceRows = priceItems.map((it, i) => [
              String(i + 1),
              it.description || '',
              String(it.quantity || 0),
              it.unit || '',
              `${currency} ${Number(it.unitRate || 0).toFixed(2)}`,
              `${currency} ${Number((it.quantity || 0) * (it.unitRate || 0)).toFixed(2)}`
            ])
            if (priceRows.length > 0) {
              content.push({ text: 'Price Schedule', style: 'h3', margin: [0, 8, 0, 4] })
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
                        [{ text: 'Sub Total', style: 'tdKey' }, { text: `${currency} ${Number(rev.priceSchedule?.subTotal || 0).toFixed(2)}`, alignment: 'right' }],
                        [{ text: `VAT (${rev.priceSchedule?.taxDetails?.vatRate || 0}%)`, style: 'tdKey' }, { text: `${currency} ${Number(rev.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)}`, alignment: 'right' }],
                        [{ text: 'Grand Total', style: 'th' }, { text: `${currency} ${Number(rev.priceSchedule?.grandTotal || 0).toFixed(2)}`, style: 'th', alignment: 'right' }]
                      ]
                    },
                    layout: 'lightHorizontalLines'
                  }
                ],
                margin: [0, 8, 0, 0]
              })
            }
          }

          // Management Approval
          if (rev.managementApproval) {
            const maRows = [
              ['Status', rev.managementApproval.status || ''],
              ['Approved By', rev.managementApproval.approvedBy?.name || ''],
              ['Approved At', rev.managementApproval.approvedAt ? new Date(rev.managementApproval.approvedAt).toLocaleString() : ''],
              ['Comments', rev.managementApproval.comments || '']
            ].filter(([, v]) => v && String(v).trim().length > 0)
            if (maRows.length > 0) {
              content.push({ text: 'Management Approval', style: 'h3', margin: [0, 8, 0, 4] })
              content.push({
                table: {
                  widths: ['30%', '70%'],
                  body: [
                    [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                    ...maRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                  ]
                },
                layout: 'lightHorizontalLines'
              })
            }
          }
        })
      }

      // 5. SITE VISITS DETAILS (Complete)
      if (Array.isArray(siteVisits) && siteVisits.length > 0) {
        siteVisits.forEach((visit, idx) => {
          content.push({ text: `Site Visit #${idx + 1}`, style: 'h2', margin: [0, 12, 0, 6] })
          const visitRows = [
            ['Visit Date & Time', visit.visitAt ? new Date(visit.visitAt).toLocaleString() : ''],
            ['Site Location', visit.siteLocation || ''],
            ['Engineer Name', visit.engineerName || ''],
            ['Work Progress Summary', visit.workProgressSummary || ''],
            ['Safety Observations', visit.safetyObservations || ''],
            ['Quality/Material Check', visit.qualityMaterialCheck || ''],
            ['Issues Found', visit.issuesFound || ''],
            ['Action Items', visit.actionItems || ''],
            ['Weather Conditions', visit.weatherConditions || ''],
            ['Description', visit.description || ''],
            ['Created At', visit.createdAt ? new Date(visit.createdAt).toLocaleString() : ''],
            ['Created By', visit.createdBy?.name || 'N/A']
          ].filter(([, v]) => v && String(v).trim().length > 0)
          if (visitRows.length > 0) {
            content.push({
              table: {
                widths: ['30%', '70%'],
                body: [
                  [{ text: 'Field', style: 'th' }, { text: 'Value', style: 'th' }],
                  ...visitRows.map(([k, v]) => [{ text: k, style: 'tdKey' }, { text: String(v || ''), style: 'tdVal' }])
                ]
              },
              layout: 'lightHorizontalLines'
            })
          }
        })
      }

      const docDefinition = {
        pageMargins: [36, 36, 36, 48],
        content,
        styles: {
          h1: { fontSize: 18, bold: true, color: '#0f172a' },
          h2: { fontSize: 12, bold: true, color: '#0f172a' },
          h3: { fontSize: 11, bold: true, color: '#0f172a' },
          th: { bold: true, fillColor: '#f1f5f9' },
          tdKey: { color: '#64748b' },
          tdVal: { color: '#0f172a' }
        },
        defaultStyle: { fontSize: 10, lineHeight: 1.2 }
      }
      const filename = `Project_${project.name.replace(/\s+/g,'_')}.pdf`
      window.pdfMake.createPdf(docDefinition).download(filename)
    } catch (e) {
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF for this project. Please try again.' })
    }
  }

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'))
    setCurrentUser(userData)
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchProjects(false),
        fetchSiteEngineers(),
        fetchRevisions(),
        fetchAllVariations()
      ])
      setIsLoading(false)
    }
    void loadData()
    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        const resEng = await api.get('/api/projects/project-engineers')
        setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
      } catch {}
    })()
  }, [])

  const fetchAllVariations = async () => {
    try {
      const res = await api.get('/api/project-variations')
      setAllVariations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching variations:', err)
      setAllVariations([])
    }
  }

  const fetchRevisions = async () => {
    try {
      const res = await api.get('/api/revisions')
      // Filter to only approved revisions that have projects
      const allRevisions = Array.isArray(res.data) ? res.data : []
      // Get revisions that have projects
      const revisionsWithProjects = []
      for (const rev of allRevisions) {
        try {
          await api.get(`/api/projects/by-revision/${rev._id}`)
          revisionsWithProjects.push(rev)
        } catch {
          // No project for this revision
        }
      }
      setRevisions(revisionsWithProjects)
    } catch {}
  }

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('projectViewMode', viewMode)
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

  const fetchProjects = async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await api.get('/api/projects')
      setProjects(response.data)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  const fetchSiteEngineers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await api.get('/api/users')
      const engineers = response.data.filter(user => user.roles?.includes('site_engineer'))
      setSiteEngineers(engineers)
    } catch (error) {
      console.error('Error fetching site engineers:', error)
    }
  }

  const assignSiteEngineer = async (e) => {
    e.preventDefault()
    setLoadingAction('assign-engineer')
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/projects/${selectedProject._id}/assign-engineer`, assignData)
      await fetchProjects()
      setShowAssignModal(false)
      setAssignData({ siteEngineerId: '' })
      setNotify({ open: true, title: 'Success', message: 'Site engineer assigned successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Assign Failed', message: error.response?.data?.message || 'We could not assign the engineer. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const createRevision = async (e) => {
    e.preventDefault()
    setLoadingAction('create-revision')
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.post(`/api/projects/${selectedProject._id}/revisions`, revisionData)
      await fetchProjects()
      setShowRevisionModal(false)
      setRevisionData({ type: 'price', description: '' })
      setNotify({ open: true, title: 'Success', message: 'Revision created successfully.' })
    } catch (error) {
      setNotify({ open: true, title: 'Create Failed', message: error.response?.data?.message || 'We could not create the revision. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const approveRevision = async (projectId, revisionId, status) => {
    setLoadingAction(`approve-revision-${revisionId}`)
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await api.patch(`/api/projects/${projectId}/revisions/${revisionId}/approve`, {
        status, comments: ''
      })
      await fetchProjects()
      setNotify({ open: true, title: 'Success', message: `Revision ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (error) {
      setNotify({ open: true, title: 'Process Failed', message: error.response?.data?.message || 'We could not process the revision. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const canAssignEngineer = () => {
    return currentUser?.roles?.some(role => ['admin', 'manager', 'supervisor'].includes(role))
  }

  const canCreateRevision = () => {
    return currentUser?.roles?.some(role => ['admin', 'manager'].includes(role))
  }

  const canCreateSiteVisit = () => {
    return currentUser?.roles?.includes('project_engineer')
  }

  const canCreateVariation = () => {
    return currentUser?.roles?.some(role => ['admin', 'manager', 'estimation_engineer'].includes(role))
  }

  const createVariation = async () => {
    if (isSubmitting) return
    setLoadingAction('create-variation')
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const payload = { ...variationModal.form }
      const project = variationModal.project
      
      // Get source data from project's source revision or quotation
      let sourceData = null
      if (project.sourceRevision) {
        try {
          const revRes = await api.get(`/api/revisions/${typeof project.sourceRevision === 'object' ? project.sourceRevision._id : project.sourceRevision}`)
          sourceData = revRes.data
        } catch {}
      } else if (project.sourceQuotation) {
        try {
          const qRes = await api.get(`/api/quotations/${typeof project.sourceQuotation === 'object' ? project.sourceQuotation._id : project.sourceQuotation}`)
          sourceData = qRes.data
        } catch {}
      }
      
      if (!sourceData) {
        setNotify({ open: true, title: 'Error', message: 'Project has no source quotation or revision to base variation on.' })
        return
      }
      
      const fields = ['companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity']
      let changed = false
      for (const f of fields) {
        if (JSON.stringify(sourceData?.[f] ?? null) !== JSON.stringify(payload?.[f] ?? null)) { changed = true; break }
      }
      if (!changed) { 
        setNotify({ open: true, title: 'No Changes', message: 'No changes detected. Please modify data before creating a variation.' })
        return 
      }
      
      await api.post('/api/project-variations', { parentProjectId: project._id, data: payload })
      setNotify({ open: true, title: 'Variation Created', message: 'The variation quotation was created successfully.' })
      setVariationModal({ open: false, project: null, form: null })
      await fetchProjects()
      await fetchAllVariations()
    } catch (e) {
      setNotify({ open: true, title: 'Create Failed', message: e.response?.data?.message || 'We could not create the variation. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'green',
      completed: 'blue',
      on_hold: 'orange'
    }
    return colors[status] || 'gray'
  }

  // Filter projects based on search and revision
  const filteredProjects = projects.filter(project => {
    // Apply revision filter
    if (selectedRevisionFilter) {
      const projectRevisionId = typeof project.sourceRevision === 'object' ? project.sourceRevision?._id : project.sourceRevision
      if (projectRevisionId !== selectedRevisionFilter) return false
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      const matches = (
        (project.name || '').toLowerCase().includes(term) ||
        (project.locationDetails || '').toLowerCase().includes(term) ||
        (project.leadId?.customerName || '').toLowerCase().includes(term) ||
        (project.leadId?.projectTitle || '').toLowerCase().includes(term) ||
        (project.assignedSiteEngineer?.name || '').toLowerCase().includes(term) ||
        (project.assignedProjectEngineer?.name || '').toLowerCase().includes(term)
      )
      if (!matches) return false
    }
    
    return true
  })
  const totalProjects = projects.length
  const displayedProjects = filteredProjects.length

  // Pagination calculations
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedRevisionFilter])

  // Helper function to render project actions
  const renderProjectActions = (project) => (
    <div className="project-actions">
      {canCreateVariation() && (
        <button className="assign-btn" onClick={async () => {
          // Check if variations already exist for this project
          const projectId = typeof project._id === 'object' ? project._id._id : project._id
          const existingVariations = allVariations.filter(v => {
            const variationProjectId = typeof v.parentProject === 'object' ? v.parentProject?._id : v.parentProject
            return variationProjectId === projectId
          })
          
          if (existingVariations.length > 0) {
            // Show warning modal instead of opening variation modal
            setVariationWarningModal({ open: true, project, existingVariations })
            return
          }
          
          // Get source data from project's source revision or quotation
          let sourceData = null
          if (project.sourceRevision) {
            try {
              const revRes = await api.get(`/api/revisions/${typeof project.sourceRevision === 'object' ? project.sourceRevision._id : project.sourceRevision}`)
              sourceData = revRes.data
            } catch {}
          } else if (project.sourceQuotation) {
            try {
              const qRes = await api.get(`/api/quotations/${typeof project.sourceQuotation === 'object' ? project.sourceQuotation._id : project.sourceQuotation}`)
              sourceData = qRes.data
            } catch {}
          }
          
          if (!sourceData) {
            setNotify({ open: true, title: 'Error', message: 'Project has no source quotation or revision to base variation on.' })
            return
          }
          
          setVariationModal({ open: true, project, form: {
            companyInfo: sourceData.companyInfo || defaultCompany,
            submittedTo: sourceData.submittedTo || '',
            attention: sourceData.attention || '',
            offerReference: sourceData.offerReference || '',
            enquiryNumber: sourceData.enquiryNumber || '',
            offerDate: sourceData.offerDate ? sourceData.offerDate.substring(0,10) : '',
            enquiryDate: sourceData.enquiryDate ? sourceData.enquiryDate.substring(0,10) : '',
            projectTitle: sourceData.projectTitle || project.name || '',
            introductionText: sourceData.introductionText || '',
            scopeOfWork: sourceData.scopeOfWork?.length ? sourceData.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
            priceSchedule: sourceData.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
            ourViewpoints: sourceData.ourViewpoints || '',
            exclusions: sourceData.exclusions?.length ? sourceData.exclusions : [''],
            paymentTerms: sourceData.paymentTerms?.length ? sourceData.paymentTerms : [{ milestoneDescription: '', amountPercent: ''}],
            deliveryCompletionWarrantyValidity: sourceData.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
          } })
        }}>Create Variation Quotation</button>
      )}
      <button className="save-btn" onClick={() => exportProjectPDF(project)}>Export PDF</button>
      <button className="assign-btn" onClick={() => { try { localStorage.setItem('projectId', project._id); localStorage.setItem('projectsFocusId', project._id) } catch {}; window.location.href = '/project-detail' }}>View Details</button>
      <button className="assign-btn" onClick={() => {
        // Check if variations already exist for this project
        const projectId = typeof project._id === 'object' ? project._id._id : project._id
        const existingVariations = allVariations.filter(v => {
          const variationProjectId = typeof v.parentProject === 'object' ? v.parentProject?._id : v.parentProject
          return variationProjectId === projectId
        })
        
        if (existingVariations.length > 0) {
          // Show warning modal instead of opening edit modal
          setEditProjectWarningModal({ open: true, project, existingVariations })
          return
        }
        
        setSelectedProject(project)
        ;(async () => {
          try {
            const token = localStorage.getItem('token')
            const resEng = await api.get('/api/projects/project-engineers')
            setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
          } catch {}
        })()
        setEditProjectModal({ open: true, form: {
          name: project.name || '',
          locationDetails: project.locationDetails || '',
          workingHours: project.workingHours || '',
          manpowerCount: project.manpowerCount || '',
          status: project.status || 'active',
          assignedProjectEngineer: project.assignedProjectEngineer?._id || ''
        } })
      }}>Edit</button>
      {canCreateSiteVisit() && (
        <button onClick={() => {
          setSelectedProject(project)
          setShowVisitModal(true)
        }} className="assign-btn">
          New Site Visit
        </button>
      )}
      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && (
        <button className="reject-btn" onClick={() => setDeleteModal({ open: true, project })}>Delete Project</button>
      )}
    </div>
  )

  return (
    <div className="project-management">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Project Management</h1>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            background: 'var(--bg)', 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            fontWeight: 600,
            border: '1px solid var(--border)'
          }}>
            {(search || selectedRevisionFilter) ? `${displayedProjects} of ${totalProjects}` : totalProjects} {totalProjects === 1 ? 'Project' : 'Projects'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedRevisionFilter}
            onChange={(e) => setSelectedRevisionFilter(e.target.value)}
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
            <option value="">All Revisions</option>
            {revisions.map(rev => (
              <option key={rev._id} value={rev._id}>
                Revision #{rev.revisionNumber} - {rev.projectTitle || rev.lead?.projectTitle || rev.offerReference || 'N/A'}
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

      {isLoading ? (
        viewMode === 'card' ? (
          <div className="projects-grid">
            {Array.from({ length: itemsPerPage }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : (
          <div className="table" style={{ marginTop: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Budget</th>
                  <th>Site Engineer</th>
                  <th>Project Engineer</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <SkeletonTableRow key={idx} columns={8} />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : viewMode === 'card' ? (
        <div className="projects-grid">
          {paginatedProjects.map(project => (
          <div key={project._id} className="project-card">
            <div className="project-header">
              <h3>{project.name}</h3>
              <span className={`status-badge ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            
            <div className="project-details">
              <p><strong>Budget:</strong> AED {project.budget?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {project.locationDetails}</p>
              <p><strong>Working Hours:</strong> {project.workingHours || 'N/A'}</p>
              <p><strong>Manpower:</strong> {project.manpowerCount || 'N/A'}</p>
              <p><strong>Site Engineer:</strong> {project.assignedSiteEngineer?.name || 'Not Assigned'}</p>
              <p><strong>Project Engineer:</strong> {project.assignedProjectEngineer?.name || 'Not Assigned'}{project.assignedProjectEngineer?._id && (
                <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => setProfileUser(project.assignedProjectEngineer)}>View Profile</button>
              )}</p>
              {project.sourceQuotation && (<p><strong>Quotation:</strong> {project.sourceQuotation.offerReference || project.sourceQuotation._id}</p>)}
              {project.sourceRevision && (<p><strong>Source Revision:</strong> #{project.sourceRevision.revisionNumber}</p>)}
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
                          <button 
                            onClick={() => approveRevision(project._id, revision._id, 'approved')} 
                            className="approve-btn"
                            disabled={isSubmitting}
                          >
                            <ButtonLoader loading={loadingAction === `approve-revision-${revision._id}` && !loadingAction.includes('rejected')}>
                              Approve
                            </ButtonLoader>
                          </button>
                          <button 
                            onClick={() => approveRevision(project._id, revision._id, 'rejected')} 
                            className="reject-btn"
                            disabled={isSubmitting}
                          >
                            <ButtonLoader loading={loadingAction === `approve-revision-${revision._id}` && loadingAction.includes('rejected')}>
                              Reject
                            </ButtonLoader>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {renderProjectActions(project)}
            {Array.isArray(project.edits) && project.edits.length > 0 && (
              <div className="ld-card ld-section" style={{ marginTop: 12 }}>
                <div className="edit-header">
                  <h4 style={{ margin: 0 }}>Project Edit History</h4>
                  <button className="link-btn" onClick={() => setHistoryOpen(prev => ({ ...prev, [project._id]: !prev[project._id] }))}>
                    {historyOpen[project._id] ? 'Hide' : 'View'}
                  </button>
                </div>
                {historyOpen[project._id] && (
                  <div className="edits-list">
                    {project.edits.slice().reverse().map((e, i) => (
                      <div key={i} className="edit-item">
                        <div className="edit-header">
                          <span>By {e.editedBy?._id === currentUser?.id ? 'You' : (e.editedBy?.name || 'N/A')}</span>
                          <span>{new Date(e.editedAt).toLocaleString()}</span>
                        </div>
                        <ul className="changes-list">
                          {e.changes.map((c, k) => {
                            const isPE = c.field === 'assignedProjectEngineer'
                            const isSE = c.field === 'assignedSiteEngineer'
                            const nameFrom = (isPE || isSE) ? (projectEngineers.find(u => String(u._id) === String(c.from))?.name || String(c.from || '')) : String(c.from || '')
                            const nameTo = (isPE || isSE) ? (projectEngineers.find(u => String(u._id) === String(c.to))?.name || String(c.to || '')) : String(c.to || '')
                            return (
                              <li key={k}><strong>{c.field}:</strong> {nameFrom} → {nameTo}</li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      ) : isLoading ? (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Status</th>
                <th>Location</th>
                <th>Budget</th>
                <th>Site Engineer</th>
                <th>Project Engineer</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: itemsPerPage }).map((_, idx) => (
                <SkeletonTableRow key={idx} columns={8} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table" style={{ marginTop: '24px' }}>
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Status</th>
                <th>Location</th>
                <th>Budget</th>
                <th>Site Engineer</th>
                <th>Project Engineer</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.map(project => (
                <tr key={project._id}>
                  <td data-label="Project Name">{project.name || 'N/A'}</td>
                  <td data-label="Status">
                    <span className={`status-badge ${getStatusColor(project.status)}`}>
                      {project.status || 'N/A'}
                    </span>
                  </td>
                  <td data-label="Location">{project.locationDetails || 'N/A'}</td>
                  <td data-label="Budget">AED {project.budget?.toLocaleString() || 'N/A'}</td>
                  <td data-label="Site Engineer">{project.assignedSiteEngineer?.name || 'Not Assigned'}</td>
                  <td data-label="Project Engineer">
                    {project.assignedProjectEngineer?.name || 'Not Assigned'}
                    {project.assignedProjectEngineer?._id && (
                      <button className="link-btn" onClick={() => setProfileUser(project.assignedProjectEngineer)} style={{ marginLeft: '6px' }}>
                        View Profile
                      </button>
                    )}
                  </td>
                  <td data-label="Created By">
                    {project.createdBy?._id === currentUser?.id ? 'You' : (project.createdBy?.name || 'N/A')}
                    {project.createdBy?._id !== currentUser?.id && project.createdBy && (
                      <button className="link-btn" onClick={() => setProfileUser(project.createdBy)} style={{ marginLeft: '6px' }}>
                        View Profile
                      </button>
                    )}
                  </td>
                  <td data-label="Actions">
                    {renderProjectActions(project)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredProjects.length > 0 && (
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length}
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

      {showVisitModal && (
        <div className="modal-overlay" onClick={() => setShowVisitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Site Visit</h2>
              <button onClick={() => setShowVisitModal(false)} className="close-btn">×</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (isSubmitting) return
                setLoadingAction('create-site-visit')
                setIsSubmitting(true)
                try {
                  const token = localStorage.getItem('token')
                  await api.post('/api/site-visits', {
                    projectId: selectedProject._id,
                    ...visitData
                  })
                  setShowVisitModal(false)
                  setVisitData({ visitAt: '', siteLocation: '', engineerName: '', workProgressSummary: '', safetyObservations: '', qualityMaterialCheck: '', issuesFound: '', actionItems: '', weatherConditions: '', description: '' })
                  setNotify({ open: true, title: 'Saved', message: 'Site visit saved successfully.' })
                } catch (error) {
                  setNotify({ open: true, title: 'Create Failed', message: error.response?.data?.message || 'We could not create the site visit. Please try again.' })
                } finally {
                  setIsSubmitting(false)
                  setLoadingAction(null)
                }
              }}
              className="assign-form"
            >
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" value={selectedProject?.name || ''} readOnly />
              </div>
              <div className="form-group">
                <label>Date and Time of Visit *</label>
                <input type="datetime-local" value={visitData.visitAt} onChange={e => setVisitData({ ...visitData, visitAt: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Site Location *</label>
                <input type="text" value={visitData.siteLocation} onChange={e => setVisitData({ ...visitData, siteLocation: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Engineer / Inspector Name *</label>
                <input type="text" value={visitData.engineerName} onChange={e => setVisitData({ ...visitData, engineerName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Work Progress Summary *</label>
                <textarea value={visitData.workProgressSummary} onChange={e => setVisitData({ ...visitData, workProgressSummary: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Safety Observations</label>
                <textarea value={visitData.safetyObservations} onChange={e => setVisitData({ ...visitData, safetyObservations: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Quality and Material Check</label>
                <textarea value={visitData.qualityMaterialCheck} onChange={e => setVisitData({ ...visitData, qualityMaterialCheck: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Issues / Non-Conformities Found</label>
                <textarea value={visitData.issuesFound} onChange={e => setVisitData({ ...visitData, issuesFound: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Action Items / Follow-up</label>
                <textarea value={visitData.actionItems} onChange={e => setVisitData({ ...visitData, actionItems: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Weather Conditions</label>
                <input type="text" value={visitData.weatherConditions} onChange={e => setVisitData({ ...visitData, weatherConditions: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Detailed Description / Remarks *</label>
                <textarea value={visitData.description} onChange={e => setVisitData({ ...visitData, description: e.target.value })} required />
              </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowVisitModal(false)} 
                  className="cancel-btn"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="save-btn"
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'create-site-visit'}>
                    {isSubmitting ? 'Saving...' : 'Save Visit'}
                  </ButtonLoader>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteModal.open && deleteModal.project && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false, project: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Project</h2>
              <button onClick={() => setDeleteModal({ open: false, project: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to delete project "{deleteModal.project.name}"? This cannot be undone.</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setDeleteModal({ open: false, project: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="reject-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('delete-project')
                    setIsSubmitting(true)
                    try {
                      const token = localStorage.getItem('token')
                      await api.delete(`/api/projects/${deleteModal.project._id}`)
                      setDeleteModal({ open: false, project: null })
                      setNotify({ open: true, title: 'Deleted', message: 'Project deleted successfully.' })
                      await fetchProjects()
                    } catch (error) {
                      setDeleteModal({ open: false, project: null })
                      setNotify({ open: true, title: 'Delete Failed', message: error.response?.data?.message || 'We could not delete the project. Please try again.' })
                    } finally {
                      setIsSubmitting(false)
                      setLoadingAction(null)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'delete-project'}>
                    {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editProjectModal.open && selectedProject && (
        <div className="modal-overlay" onClick={() => setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Project</h2>
              <button onClick={() => setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Project Name *</label>
                <input type="text" value={editProjectModal.form.name} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, name: e.target.value } })} required />
              </div>
              <div className="form-group">
                <label>Location Details *</label>
                <input type="text" value={editProjectModal.form.locationDetails} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, locationDetails: e.target.value } })} required />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Working Hours</label>
                  <input type="text" value={editProjectModal.form.workingHours} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, workingHours: e.target.value } })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Manpower Count</label>
                  <input type="number" value={editProjectModal.form.manpowerCount} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, manpowerCount: Number(e.target.value || 0) } })} />
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editProjectModal.form.status} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, status: e.target.value } })}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              <div className="form-group">
                <label>Project Engineer</label>
                <select value={editProjectModal.form.assignedProjectEngineer} onChange={e => setEditProjectModal({ ...editProjectModal, form: { ...editProjectModal.form, assignedProjectEngineer: e.target.value } })}>
                  <option value="">-- Select --</option>
                  {projectEngineers.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              {editProjectModal.form.assignedProjectEngineer && (
                <div className="form-group">
                  <button type="button" className="link-btn" onClick={() => {
                    const u = projectEngineers.find(x => String(x._id) === String(editProjectModal.form.assignedProjectEngineer))
                    if (u) setProfileUser(u)
                  }}>View Profile</button>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('save-project')
                    setIsSubmitting(true)
                    try {
                      // Safety check: verify no variations exist before saving
                      const projectId = typeof selectedProject._id === 'object' ? selectedProject._id._id : selectedProject._id
                      const existingVariations = allVariations.filter(v => {
                        const variationProjectId = typeof v.parentProject === 'object' ? v.parentProject?._id : v.parentProject
                        return variationProjectId === projectId
                      })
                      
                      if (existingVariations.length > 0) {
                        setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
                        setEditProjectWarningModal({ open: true, project: selectedProject, existingVariations })
                        return
                      }
                      
                      const token = localStorage.getItem('token')
                      await api.put(`/api/projects/${selectedProject._id}`, editProjectModal.form)
                      setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
                      await fetchProjects()
                      setNotify({ open: true, title: 'Saved', message: 'Project updated successfully.' })
                    } catch (error) {
                      setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not update the project.' })
                    } finally {
                      setIsSubmitting(false)
                      setLoadingAction(null)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'save-project'}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editProjectWarningModal.open && editProjectWarningModal.project && (
        <div className="modal-overlay" onClick={() => setEditProjectWarningModal({ open: false, project: null, existingVariations: [] })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cannot Edit Project</h2>
              <button onClick={() => setEditProjectWarningModal({ open: false, project: null, existingVariations: [] })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div style={{ padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                  ⚠️ This project cannot be edited because it has {editProjectWarningModal.existingVariations.length} existing variation{editProjectWarningModal.existingVariations.length > 1 ? 's' : ''}.
                </p>
              </div>
              <p style={{ marginBottom: '16px' }}>
                Project <strong>{editProjectWarningModal.project.name}</strong> has existing variation quotations. 
                Editing the project is blocked to maintain data integrity and ensure consistency with approved variations.
              </p>
              {editProjectWarningModal.existingVariations.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ marginBottom: '8px', fontWeight: 600 }}>Existing Variations:</p>
                  <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
                    {editProjectWarningModal.existingVariations.map((v, idx) => (
                      <li key={v._id || idx} style={{ marginBottom: '4px' }}>
                        Variation #{v.variationNumber} 
                        {v.offerReference && ` - ${v.offerReference}`}
                        {v.managementApproval?.status && (
                          <span className={`status-badge ${v.managementApproval.status === 'approved' ? 'approved' : v.managementApproval.status === 'rejected' ? 'rejected' : 'blue'}`} style={{ marginLeft: '8px' }}>
                            {v.managementApproval.status}
                          </span>
                        )}
                        <button 
                          className="link-btn" 
                          onClick={() => {
                            try {
                              localStorage.setItem('variationId', v._id)
                              window.location.href = '/variation-detail'
                            } catch {}
                          }}
                          style={{ marginLeft: '8px' }}
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                To make changes to this project, you must first delete or remove all associated variations. 
                Please contact a manager or administrator if you need to modify project details.
              </p>
              <div className="form-actions">
                <button type="button" className="save-btn" onClick={() => setEditProjectWarningModal({ open: false, project: null, existingVariations: [] })}>Understood</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {variationModal.open && variationModal.form && (
        <div className="modal-overlay" onClick={() => setVariationModal({ open: false, project: null, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', width: '900px' }}>
            <div className="modal-header">
              <h2>Create Variation Quotation</h2>
              <button onClick={() => setVariationModal({ open: false, project: null, form: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <div className="form-section">
                <div className="section-header">
                  <h3>Cover & Basic Details</h3>
                </div>
                <div className="form-group">
                  <label>Submitted To (Client Company)</label>
                  <input type="text" value={variationModal.form.submittedTo} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, submittedTo: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Attention (Contact Person)</label>
                  <input type="text" value={variationModal.form.attention} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, attention: e.target.value } })} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Reference</label>
                    <input type="text" value={variationModal.form.offerReference} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, offerReference: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Number</label>
                    <input type="text" value={variationModal.form.enquiryNumber} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, enquiryNumber: e.target.value } })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Date</label>
                    <input type="date" value={variationModal.form.offerDate} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, offerDate: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Date</label>
                    <input type="date" value={variationModal.form.enquiryDate} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, enquiryDate: e.target.value } })} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Project Details</h3>
                </div>
                <div className="form-group">
                  <label>Project Title</label>
                  <input type="text" value={variationModal.form.projectTitle} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, projectTitle: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Introduction</label>
                  <textarea value={variationModal.form.introductionText} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, introductionText: e.target.value } })} />
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Price Schedule</h3>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Currency</label>
                    <input type="text" value={variationModal.form.priceSchedule.currency} onChange={e => setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, currency: e.target.value } } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>VAT Rate (%)</label>
                    <input type="number" value={variationModal.form.priceSchedule.taxDetails.vatRate} onChange={e => {
                      const items = variationModal.form.priceSchedule.items
                      const sub = items.reduce((sum, it) => sum + Number(it.totalAmount || 0), 0)
                      const vat = sub * (Number(e.target.value || 0) / 100)
                      const grand = sub + vat
                      setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...variationModal.form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: Number(vat.toFixed(2)) } } } })
                    }} />
                  </div>
                </div>
                {variationModal.form.priceSchedule.items.map((it, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => {
                        const items = variationModal.form.priceSchedule.items.filter((_, idx) => idx !== i)
                        const sub = items.reduce((sum, it) => sum + Number(it.totalAmount || 0), 0)
                        const vat = sub * (Number(variationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                        const grand = sub + vat
                        setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...variationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                      }}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Description</label>
                        <input type="text" value={it.description} onChange={e => {
                          const items = variationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x)
                          setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Qty</label>
                        <input type="number" value={it.quantity} onChange={e => {
                          const items = variationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value, totalAmount: Number((Number(e.target.value || 0) * Number(x.unitRate || 0)).toFixed(2)) } : x)
                          const sub = items.reduce((sum, it) => sum + Number(it.totalAmount || 0), 0)
                          const vat = sub * (Number(variationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...variationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit</label>
                        <input type="text" value={it.unit} onChange={e => {
                          const items = variationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x)
                          setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit Rate</label>
                        <input type="number" value={it.unitRate} onChange={e => {
                          const items = variationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unitRate: e.target.value, totalAmount: Number((Number(x.quantity || 0) * Number(e.target.value || 0)).toFixed(2)) } : x)
                          const sub = items.reduce((sum, it) => sum + Number(it.totalAmount || 0), 0)
                          const vat = sub * (Number(variationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...variationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Total</label>
                        <input type="number" readOnly value={Number(it.totalAmount || 0)} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setVariationModal({ ...variationModal, form: { ...variationModal.form, priceSchedule: { ...variationModal.form.priceSchedule, items: [...variationModal.form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } } })}>+ Add Item</button>
                </div>
                <div className="form-row" style={{ marginTop: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Sub Total</label>
                    <input type="number" readOnly value={Number(variationModal.form.priceSchedule.subTotal || 0)} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>VAT Amount</label>
                    <input type="number" readOnly value={Number(variationModal.form.priceSchedule.taxDetails.vatAmount || 0)} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Grand Total</label>
                    <input type="number" readOnly value={Number(variationModal.form.priceSchedule.grandTotal || 0)} />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setVariationModal({ open: false, project: null, form: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={createVariation}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'create-variation'}>
                    {isSubmitting ? 'Creating...' : 'Create Variation'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {variationWarningModal.open && variationWarningModal.project && (
        <div className="modal-overlay" onClick={() => setVariationWarningModal({ open: false, project: null, existingVariations: [] })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Variation Already Exists</h2>
              <button onClick={() => setVariationWarningModal({ open: false, project: null, existingVariations: [] })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div style={{ padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                  ⚠️ This project already has {variationWarningModal.existingVariations.length} existing variation{variationWarningModal.existingVariations.length > 1 ? 's' : ''}.
                </p>
              </div>
              <p style={{ marginBottom: '16px' }}>
                A variation quotation already exists for project <strong>{variationWarningModal.project.name}</strong>. 
                You cannot create another variation directly from the project.
              </p>
              {variationWarningModal.existingVariations.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ marginBottom: '8px', fontWeight: 600 }}>Existing Variations:</p>
                  <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
                    {variationWarningModal.existingVariations.map((v, idx) => (
                      <li key={v._id || idx} style={{ marginBottom: '4px' }}>
                        Variation #{v.variationNumber} 
                        {v.offerReference && ` - ${v.offerReference}`}
                        {v.managementApproval?.status && (
                          <span className={`status-badge ${v.managementApproval.status === 'approved' ? 'approved' : v.managementApproval.status === 'rejected' ? 'rejected' : 'blue'}`} style={{ marginLeft: '8px' }}>
                            {v.managementApproval.status}
                          </span>
                        )}
                        <button 
                          className="link-btn" 
                          onClick={() => {
                            try {
                              localStorage.setItem('variationId', v._id)
                              window.location.href = '/variation-detail'
                            } catch {}
                          }}
                          style={{ marginLeft: '8px' }}
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                To create a new variation, you should create it from an approved variation using the "Create Another Variation" button on the variation detail page.
              </p>
              <div className="form-actions">
                <button type="button" className="save-btn" onClick={() => setVariationWarningModal({ open: false, project: null, existingVariations: [] })}>Understood</button>
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
    </div>
  )
}

export default ProjectManagement