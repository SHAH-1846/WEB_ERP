import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import './LeadManagement.css'
import './LoadingComponents.css'
import { Spinner, PageSkeleton, ButtonLoader } from './LoadingComponents'

function ProjectDetail() {
  const [project, setProject] = useState(null)
  const [lead, setLead] = useState(null)
  const [quotation, setQuotation] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [variations, setVariations] = useState([])
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [editModal, setEditModal] = useState({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
  const [editProjectWarningModal, setEditProjectWarningModal] = useState({ open: false, existingVariations: [] })
  const [deleteModal, setDeleteModal] = useState({ open: false })
  const [projectEngineers, setProjectEngineers] = useState([])
  const [profileUser, setProfileUser] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewFiles, setPreviewFiles] = useState([])
  const [attachmentsToRemove, setAttachmentsToRemove] = useState([])
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles(prev => [...prev, ...files])
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewFiles(prev => [...prev, { file, preview: reader.result, type: 'image' }])
        }
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('video/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewFiles(prev => [...prev, { file, preview: reader.result, type: 'video' }])
        }
        reader.readAsDataURL(file)
      } else {
        setPreviewFiles(prev => [...prev, { file, preview: null, type: 'document' }])
      }
    })
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewFiles(prev => prev.filter((_, i) => i !== index))
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

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      try {
        const focus = localStorage.getItem('projectsFocusId') || localStorage.getItem('projectId')
        if (!focus) {
          setIsLoading(false)
          return
        }
        const res = await api.get(`/api/projects/${focus}`)
        const pj = res.data
        setProject(pj)
        if (pj.leadId?._id) {
          const resLead = await api.get(`/api/leads/${pj.leadId._id}`)
          setLead(resLead.data)
        }
        if (pj.sourceQuotation?._id) {
          const resQ = await api.get(`/api/quotations/${pj.sourceQuotation._id}`)
          setQuotation(resQ.data)
        }
        if (pj.sourceRevision?.parentQuotation) {
          const resR = await api.get(`/api/revisions?parentQuotation=${pj.sourceRevision.parentQuotation}`)
          setRevisions(Array.isArray(resR.data) ? resR.data : [])
        }
        // Fetch project variations
        try {
          const resV = await api.get(`/api/project-variations?parentProject=${focus}`)
          setVariations(Array.isArray(resV.data) ? resV.data : [])
        } catch (err) {
          console.error('Error fetching variations:', err)
          setVariations([])
        }
        // Preload project engineers for name mapping and profile view
        try {
          const resEng = await api.get('/api/projects/project-engineers')
          setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
        } catch {}
      } catch (e) {
        console.error('Error loading project:', e)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const exportProjectPDF = async () => {
    try {
      if (!project) return
      await ensurePdfMake()
      const token = localStorage.getItem('token')
      // Fetch site visits
      let siteVisits = []
      try {
        const resVisits = await api.get(`/api/site-visits/project/${project._id}`)
        siteVisits = Array.isArray(resVisits.data) ? resVisits.data : []
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
      if (lead) {
        const leadRows = [
          ['Customer Name', lead.customerName || ''],
          ['Project Title', lead.projectTitle || ''],
          ['Enquiry Number', lead.enquiryNumber || ''],
          ['Enquiry Date', lead.enquiryDate ? new Date(lead.enquiryDate).toLocaleDateString() : ''],
          ['Submission Due Date', lead.submissionDueDate ? new Date(lead.submissionDueDate).toLocaleDateString() : ''],
          ['Scope Summary', lead.scopeSummary || ''],
          ['Name', lead.name || ''],
          ['Budget', lead.budget ? `${lead.budget}` : ''],
          ['Location Details', lead.locationDetails || ''],
          ['Working Hours', lead.workingHours || ''],
          ['Manpower Count', String(lead.manpowerCount || '')],
          ['Status', lead.status || ''],
          ['Created At', lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''],
          ['Created By', lead.createdBy?.name || 'N/A']
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
      if (Array.isArray(revisions) && revisions.length > 0) {
        const sortedRevs = revisions.sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0))
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

  if (isLoading) {
    return (
      <div className="lead-management" style={{ padding: 24 }}>
        <PageSkeleton showHeader={true} showContent={true} />
      </div>
    )
  }

  if (!project) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Project Details</h2>
      <p>Nothing to display.</p>
    </div>
  )

  return (
    <div className="lead-detail">
      <div className="ld-header">
        <div className="ld-title">
          <div className="title-row">
            <h1>{project.name}</h1>
          </div>
          <span className="ld-subtitle">Status: {project.status}</span>
        </div>
        <div className="ld-sticky-actions">
          <button className="save-btn" onClick={exportProjectPDF}>Export</button>
          <button className="assign-btn" onClick={async () => {
            try {
              const token = localStorage.getItem('token')
              const resEng = await api.get('/api/projects/project-engineers')
              setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
            } catch {}
            // Check if variations already exist for this project
            if (variations && Array.isArray(variations) && variations.length > 0) {
              // Show warning modal instead of opening edit modal
              setEditProjectWarningModal({ open: true, existingVariations: variations })
              return
            }
            // Reset file states
            setSelectedFiles([])
            setPreviewFiles([])
            setAttachmentsToRemove([])
            setEditModal({ open: true, form: { 
              name: project.name || '', 
              locationDetails: project.locationDetails || '', 
              workingHours: project.workingHours || '', 
              manpowerCount: project.manpowerCount || '', 
              status: project.status || 'active', 
              assignedProjectEngineer: Array.isArray(project.assignedProjectEngineer) 
                ? project.assignedProjectEngineer.map(e => typeof e === 'object' ? e._id : e)
                : []
            } })
          }}>Edit</button>
          {lead?._id && (
            <button className="link-btn" onClick={() => { try { localStorage.setItem('leadId', lead._id) } catch {}; window.location.href = '/lead-detail' }}>View Lead</button>
          )}
          {quotation?._id && (
            <button className="link-btn" onClick={() => { try { localStorage.setItem('quotationId', quotation._id) } catch {}; window.location.href = '/quotation-detail' }}>View Quotation</button>
          )}
          {project.sourceRevision?._id && (
            <button className="link-btn" onClick={() => { try { localStorage.setItem('revisionId', project.sourceRevision._id) } catch {}; window.location.href = '/revision-detail' }}>View Source Revision</button>
          )}
          {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && (
            <button className="reject-btn" onClick={() => setDeleteModal({ open: true })}>Delete Project</button>
          )}
        </div>
      </div>

      <div className="ld-grid">
          <div className="ld-card ld-section">
          <h3>Project Overview</h3>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td data-label="Field">Location</td><td data-label="Value">{project.locationDetails || 'N/A'}</td></tr>
                <tr><td data-label="Field">Working Hours</td><td data-label="Value">{project.workingHours || 'N/A'}</td></tr>
                <tr><td data-label="Field">Manpower</td><td data-label="Value">{project.manpowerCount || 'N/A'}</td></tr>
                <tr>
                  <td data-label="Field">Project Engineer(s)</td>
                  <td data-label="Value">
                    {Array.isArray(project.assignedProjectEngineer) && project.assignedProjectEngineer.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {project.assignedProjectEngineer.map((eng, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{eng.name || 'N/A'}</span>
                            {eng._id && (
                              <button 
                                className="link-btn" 
                                onClick={() => setProfileUser(eng)}
                              >
                                View Profile
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : 'Not Assigned'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {lead && (
          <div className="ld-card ld-section">
            <h3>Lead Details</h3>
            <div className="ld-kv">
              <p><strong>Customer:</strong> {lead.customerName || 'N/A'}</p>
              <p><strong>Project Title:</strong> {lead.projectTitle || 'N/A'}</p>
              <p><strong>Enquiry #:</strong> {lead.enquiryNumber || 'N/A'}</p>
            </div>
          </div>
        )}

        {quotation && (
          <div className="ld-card ld-section">
            <h3>Quotation Summary</h3>
            <div className="ld-kv">
              <p><strong>Offer Ref:</strong> {quotation.offerReference || 'N/A'}</p>
              <p><strong>Currency:</strong> {quotation.priceSchedule?.currency || 'AED'}</p>
              <p><strong>Grand Total:</strong> {Number(quotation.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
            </div>
          </div>
        )}

        {Array.isArray(revisions) && revisions.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Related Revisions ({revisions.length})</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.sort((a,b)=> (a.revisionNumber||0)-(b.revisionNumber||0)).map(r => (
                    <tr key={r._id}>
                      <td data-label="#">{r.revisionNumber}</td>
                      <td data-label="Status">{r.managementApproval?.status || 'pending'}</td>
                      <td data-label="Grand Total">{(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                      <td data-label="Actions">
                        <button className="link-btn" onClick={() => { try { localStorage.setItem('revisionId', r._id) } catch {}; window.location.href = '/revision-detail' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {Array.isArray(variations) && variations.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Related Variations ({variations.length})</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variations.sort((a,b)=> (a.variationNumber||0)-(b.variationNumber||0)).map(v => (
                    <tr key={v._id}>
                      <td data-label="#">{v.variationNumber}</td>
                      <td data-label="Status">{v.managementApproval?.status || 'draft'}</td>
                      <td data-label="Grand Total">{(v.priceSchedule?.currency || 'AED')} {Number(v.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                      <td data-label="Actions">
                        <button className="link-btn" onClick={() => { try { localStorage.setItem('variationId', v._id) } catch {}; window.location.href = '/variation-detail' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {Array.isArray(project.edits) && project.edits.length > 0 && (
          <div className="ld-card ld-section">
            <div className="edit-header">
              <h3 style={{ margin: 0 }}>Project Edit History</h3>
              <button className="link-btn" onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? 'Hide' : 'View'}</button>
            </div>
            {historyOpen && (
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

      {/* Attachments Section */}
      {Array.isArray(project.attachments) && project.attachments.length > 0 && (
        <div className="ld-card ld-section">
          <h3>Attachments ({project.attachments.length})</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '20px',
            marginTop: '15px'
          }}>
            {project.attachments.map((attachment, index) => {
              const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/')
              const isVideo = attachment.mimetype && attachment.mimetype.startsWith('video/')
              const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
              const fileUrl = attachment.path.startsWith('http') 
                ? attachment.path 
                : `${apiBase}${attachment.path}`

              const formatFileSize = (bytes) => {
                if (bytes === 0) return '0 Bytes'
                const k = 1024
                const sizes = ['Bytes', 'KB', 'MB', 'GB']
                const i = Math.floor(Math.log(bytes) / Math.log(k))
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
              }

              return (
                <div 
                  key={index} 
                  style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '8px', 
                    padding: '12px',
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: (isImage || isVideo) ? 'pointer' : 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onClick={(isImage || isVideo) ? () => {
                    const newWindow = window.open('', '_blank')
                    if (isImage) {
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>${attachment.originalName}</title>
                            <style>
                              body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
                              img { max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
                            </style>
                          </head>
                          <body>
                            <img src="${fileUrl}" alt="${attachment.originalName}" />
                          </body>
                        </html>
                      `)
                    } else if (isVideo) {
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>${attachment.originalName}</title>
                            <style>
                              body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                              video { max-width: 100%; max-height: 90vh; border-radius: 8px; }
                            </style>
                          </head>
                          <body>
                            <video src="${fileUrl}" controls autoplay style="width: 100%; max-width: 1200px;"></video>
                          </body>
                        </html>
                      `)
                    }
                  } : undefined}
                >
                  {isImage ? (
                    <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
                      <img 
                        src={fileUrl} 
                        alt={attachment.originalName}
                        style={{ 
                          width: '100%', 
                          height: '150px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          border: '1px solid #eee'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          const fallback = e.target.nextSibling
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <div style={{ 
                        display: 'none',
                        width: '100%', 
                        height: '150px', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        border: '1px solid #eee'
                      }}>
                        <span style={{ fontSize: '12px', textAlign: 'center', color: '#666' }}>Image not available</span>
                      </div>
                    </div>
                  ) : isVideo ? (
                    <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
                      <video 
                        src={fileUrl}
                        style={{ 
                          width: '100%', 
                          height: '150px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          border: '1px solid #eee'
                        }}
                        controls={false}
                        muted
                        onError={(e) => {
                          e.target.style.display = 'none'
                          const fallback = e.target.nextSibling.nextSibling
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <div style={{ 
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <div style={{ 
                        display: 'none',
                        width: '100%', 
                        height: '150px', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        border: '1px solid #eee'
                      }}>
                        <span style={{ fontSize: '12px', textAlign: 'center', color: '#666' }}>Video not available</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      height: '150px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      border: '1px solid #eee'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#666', marginBottom: '8px' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <div style={{ fontSize: '11px', color: '#666', wordBreak: 'break-word' }}>
                          {attachment.originalName.length > 20 
                            ? attachment.originalName.substring(0, 20) + '...' 
                            : attachment.originalName}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      color: '#333',
                      marginBottom: '4px',
                      wordBreak: 'break-word'
                    }}>
                      {attachment.originalName.length > 25 
                        ? attachment.originalName.substring(0, 25) + '...' 
                        : attachment.originalName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
                      {formatFileSize(attachment.size)}
                    </div>
                    <a 
                      href={fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
                    >
                      {isImage ? 'View Full Size' : isVideo ? 'Play Video' : 'Download'}
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
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
      {editModal.open && (
        <div className="modal-overlay" onClick={() => setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Project</h2>
              <button onClick={() => setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Project Name *</label>
                <input type="text" value={editModal.form.name} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, name: e.target.value } })} required />
              </div>
              <div className="form-group">
                <label>Location Details *</label>
                <input type="text" value={editModal.form.locationDetails} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, locationDetails: e.target.value } })} required />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Working Hours</label>
                  <input type="text" value={editModal.form.workingHours} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, workingHours: e.target.value } })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Manpower Count</label>
                  <input type="number" value={editModal.form.manpowerCount} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, manpowerCount: Number(e.target.value || 0) } })} />
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editModal.form.status} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, status: e.target.value } })}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              <div className="form-group">
                <label>Project Engineer(s)</label>
                <div style={{ 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg)'
                }}>
                  {projectEngineers.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '8px' }}>No project engineers available</p>
                  ) : (
                    projectEngineers.map(u => {
                      const isSelected = Array.isArray(editModal.form.assignedProjectEngineer) 
                        ? editModal.form.assignedProjectEngineer.includes(u._id)
                        : editModal.form.assignedProjectEngineer === u._id
                      
                      return (
                        <div key={u._id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px', 
                          borderBottom: '1px solid var(--border-light)',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            id={`eng-${u._id}`}
                            checked={isSelected}
                            onChange={(e) => {
                              const currentEngineers = Array.isArray(editModal.form.assignedProjectEngineer) 
                                ? editModal.form.assignedProjectEngineer 
                                : []
                              
                              let newEngineers
                              if (e.target.checked) {
                                newEngineers = [...currentEngineers, u._id]
                              } else {
                                newEngineers = currentEngineers.filter(id => id !== u._id)
                              }
                              
                              setEditModal({ 
                                ...editModal, 
                                form: { ...editModal.form, assignedProjectEngineer: newEngineers } 
                              })
                            }}
                            style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <label htmlFor={`eng-${u._id}`} style={{ cursor: 'pointer', flex: 1, margin: 0 }}>
                            {u.name} ({u.email})
                          </label>
                        </div>
                      )
                    })
                  )}
                </div>
                {Array.isArray(editModal.form.assignedProjectEngineer) && editModal.form.assignedProjectEngineer.length > 0 && (
                  <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {editModal.form.assignedProjectEngineer.length} engineer{editModal.form.assignedProjectEngineer.length === 1 ? '' : 's'} selected
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Attachments (Documents, Images & Videos)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,video/*"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Accepted: Images (JPEG, PNG, GIF, WebP), Documents (PDF, DOC, DOCX, XLS, XLSX), Videos (MP4, MOV, AVI, WMV, WebM, etc.). Max 10MB per file.
                </small>
                
                {/* Display existing attachments when editing */}
                {project && project.attachments && project.attachments.length > 0 && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px' }}>Existing Attachments:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {project.attachments.map((attachment, index) => {
                        const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/')
                        const isVideo = attachment.mimetype && attachment.mimetype.startsWith('video/')
                        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
                        const fileUrl = attachment.path.startsWith('http') ? attachment.path : `${apiBase}${attachment.path}`
                        const isMarkedForRemoval = attachmentsToRemove.includes(index.toString())
                        
                        return (
                          <div 
                            key={index} 
                            style={{ 
                              position: 'relative', 
                              border: isMarkedForRemoval ? '2px solid #dc3545' : '1px solid #ddd', 
                              borderRadius: '4px', 
                              padding: '8px',
                              maxWidth: '150px',
                              opacity: isMarkedForRemoval ? 0.5 : 1,
                              backgroundColor: isMarkedForRemoval ? '#ffe6e6' : '#fff'
                            }}
                          >
                            {isImage && attachment.path ? (
                              <img 
                                src={fileUrl} 
                                alt={attachment.originalName}
                                style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            ) : isVideo && attachment.path ? (
                              <video 
                                src={fileUrl}
                                style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                                controls={false}
                                muted
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            ) : (
                              <div style={{ 
                                width: '100%', 
                                height: '100px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px'
                              }}>
                                <span style={{ fontSize: '12px', textAlign: 'center' }}>{attachment.originalName}</span>
                              </div>
                            )}
                            <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>
                              {attachment.originalName.length > 15 ? attachment.originalName.substring(0, 15) + '...' : attachment.originalName}
                            </div>
                            <div style={{ fontSize: '10px', color: '#999' }}>
                              {formatFileSize(attachment.size)}
                            </div>
                            {!isMarkedForRemoval && (
                              <button
                                type="button"
                                onClick={() => setAttachmentsToRemove(prev => [...prev, index.toString()])}
                                style={{
                                  position: 'absolute',
                                  top: '5px',
                                  right: '5px',
                                  background: 'rgba(220, 53, 69, 0.9)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                ×
                              </button>
                            )}
                            {isMarkedForRemoval && (
                              <div style={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#dc3545'
                              }}>
                                Will Remove
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Display new files being uploaded */}
                {previewFiles.length > 0 && (
                  <div style={{ marginTop: '15px' }}>
                    {project && project.attachments && project.attachments.length > 0 && (
                      <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px' }}>New Attachments:</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {previewFiles.map((item, index) => (
                        <div key={index} style={{ 
                          position: 'relative', 
                          border: '1px solid #ddd', 
                          borderRadius: '4px', 
                          padding: '8px',
                          maxWidth: '150px'
                        }}>
                          {item.type === 'image' && item.preview ? (
                            <img 
                              src={item.preview} 
                              alt={item.file.name}
                              style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          ) : item.type === 'video' && item.preview ? (
                            <video 
                              src={item.preview}
                              style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                              controls={false}
                              muted
                            />
                          ) : (
                            <div style={{ 
                              width: '100%', 
                              height: '100px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '4px'
                            }}>
                              <span style={{ fontSize: '12px', textAlign: 'center' }}>{item.file.name}</span>
                            </div>
                          )}
                          <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>
                            {item.file.name.length > 15 ? item.file.name.substring(0, 15) + '...' : item.file.name}
                          </div>
                          <div style={{ fontSize: '10px', color: '#999' }}>
                            {formatFileSize(item.file.size)}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              background: 'rgba(255, 0, 0, 0.7)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('save-project')
                    setIsSubmitting(true)
                    try {
                      // Safety check: verify no variations exist before saving
                      if (variations && Array.isArray(variations) && variations.length > 0) {
                        setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
                        setEditProjectWarningModal({ open: true, existingVariations: variations })
                        return
                      }
                      
                      // Use FormData for file uploads
                      const formData = new FormData()
                      Object.keys(editModal.form).forEach(key => {
                        if (key === 'assignedProjectEngineer') return // Skip, handle separately
                        formData.append(key, editModal.form[key])
                      })
                      
                      // Append engineer IDs separately (FormData doesn't handle arrays well)
                      if (Array.isArray(editModal.form.assignedProjectEngineer)) {
                        editModal.form.assignedProjectEngineer.forEach(id => {
                          formData.append('assignedProjectEngineer', id)
                        })
                      }
                      
                      // Append new files
                      selectedFiles.forEach(file => {
                        formData.append('attachments', file)
                      })
                      
                      // Append attachments to remove
                      attachmentsToRemove.forEach(index => {
                        formData.append('removeAttachments', index)
                      })
                      
                      await api.patch(`/api/projects/${project._id}`, formData)
                      const res = await api.get(`/api/projects/${project._id}`)
                      setProject(res.data)
                      setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
                      setSelectedFiles([])
                      setPreviewFiles([])
                      setAttachmentsToRemove([])
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
      {editProjectWarningModal.open && (
        <div className="modal-overlay" onClick={() => setEditProjectWarningModal({ open: false, existingVariations: [] })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cannot Edit Project</h2>
              <button onClick={() => setEditProjectWarningModal({ open: false, existingVariations: [] })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div style={{ padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                  ⚠️ This project cannot be edited because it has {editProjectWarningModal.existingVariations.length} existing variation{editProjectWarningModal.existingVariations.length > 1 ? 's' : ''}.
                </p>
              </div>
              <p style={{ marginBottom: '16px' }}>
                This project has existing variation quotations. 
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
                <button type="button" className="save-btn" onClick={() => setEditProjectWarningModal({ open: false, existingVariations: [] })}>Understood</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteModal.open && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Project</h2>
              <button onClick={() => setDeleteModal({ open: false })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to delete project "{project.name}"? This cannot be undone.</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setDeleteModal({ open: false })}>Cancel</button>
                <button 
                  type="button" 
                  className="reject-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('delete-project')
                    setIsSubmitting(true)
                    try {
                      await api.delete(`/api/projects/${project._id}`)
                      setDeleteModal({ open: false })
                      setNotify({ open: true, title: 'Deleted', message: 'Project deleted successfully. Redirecting...' })
                      // Redirect to projects listing after short delay
                      setTimeout(() => {
                        window.location.href = '/projects'
                      }, 1500)
                    } catch (error) {
                      setDeleteModal({ open: false })
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
    </div>
  )
}

export default ProjectDetail


