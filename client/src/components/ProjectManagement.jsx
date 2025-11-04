import { useState, useEffect } from 'react'
import axios from 'axios'
import './ProjectManagement.css'

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
        const resVisits = await axios.get(`http://localhost:5000/api/site-visits/project/${project._id}`, { headers: { Authorization: `Bearer ${token}` } })
        siteVisits = Array.isArray(resVisits.data) ? resVisits.data : []
      } catch {}
      try {
        const leadId = typeof project.leadId === 'object' ? project.leadId?._id : project.leadId
        if (leadId) {
          const leadRes = await axios.get(`http://localhost:5000/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
          leadFull = leadRes.data
        }
      } catch {}
      try {
        if (project.sourceQuotation?._id) {
          const qRes = await axios.get(`http://localhost:5000/api/quotations/${project.sourceQuotation._id}`, { headers: { Authorization: `Bearer ${token}` } })
          quotation = qRes.data
        }
      } catch {}
      try {
        if (project.sourceRevision?.parentQuotation) {
          const revRes = await axios.get(`http://localhost:5000/api/revisions?parentQuotation=${project.sourceRevision.parentQuotation}`, { headers: { Authorization: `Bearer ${token}` } })
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
    fetchProjects()
    fetchSiteEngineers()
    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        const resEng = await axios.get('http://localhost:5000/api/projects/project-engineers', { headers: { Authorization: `Bearer ${token}` } })
        setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
      } catch {}
    })()
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
      setNotify({ open: true, title: 'Assign Failed', message: error.response?.data?.message || 'We could not assign the engineer. Please try again.' })
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
      setRevisionData({ type: 'price', description: '' })
    } catch (error) {
      setNotify({ open: true, title: 'Create Failed', message: error.response?.data?.message || 'We could not create the revision. Please try again.' })
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
      setNotify({ open: true, title: 'Process Failed', message: error.response?.data?.message || 'We could not process the revision. Please try again.' })
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
              <button className="save-btn" onClick={() => exportProjectPDF(project)}>Export PDF</button>
              <button className="assign-btn" onClick={() => { try { localStorage.setItem('projectId', project._id); localStorage.setItem('projectsFocusId', project._id) } catch {}; window.location.href = '/project-detail' }}>View Details</button>
              <button className="assign-btn" onClick={() => {
                setSelectedProject(project)
                ;(async () => {
                  try {
                    const token = localStorage.getItem('token')
                    const resEng = await axios.get('http://localhost:5000/api/projects/project-engineers', { headers: { Authorization: `Bearer ${token}` } })
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
                try {
                  const token = localStorage.getItem('token')
                  await axios.post('http://localhost:5000/api/site-visits', {
                    projectId: selectedProject._id,
                    ...visitData
                  }, {
                    headers: { Authorization: `Bearer ${token}` }
                  })
                  setShowVisitModal(false)
                  setVisitData({ visitAt: '', siteLocation: '', engineerName: '', workProgressSummary: '', safetyObservations: '', qualityMaterialCheck: '', issuesFound: '', actionItems: '', weatherConditions: '', description: '' })
                  setNotify({ open: true, title: 'Saved', message: 'Site visit saved successfully.' })
                } catch (error) {
                  setNotify({ open: true, title: 'Create Failed', message: error.response?.data?.message || 'We could not create the site visit. Please try again.' })
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
                <button type="button" onClick={() => setShowVisitModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Visit</button>
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
                <button type="button" className="reject-btn" onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    await axios.delete(`http://localhost:5000/api/projects/${deleteModal.project._id}`, { headers: { Authorization: `Bearer ${token}` } })
                    setDeleteModal({ open: false, project: null })
                    setNotify({ open: true, title: 'Deleted', message: 'Project deleted successfully.' })
                    fetchProjects()
                  } catch (error) {
                    setDeleteModal({ open: false, project: null })
                    setNotify({ open: true, title: 'Delete Failed', message: error.response?.data?.message || 'We could not delete the project. Please try again.' })
                  }
                }}>Confirm Delete</button>
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
                <button type="button" className="save-btn" onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    await axios.put(`http://localhost:5000/api/projects/${selectedProject._id}`, editProjectModal.form, { headers: { Authorization: `Bearer ${token}` } })
                    setEditProjectModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
                    await fetchProjects()
                    setNotify({ open: true, title: 'Saved', message: 'Project updated successfully.' })
                  } catch (error) {
                    setNotify({ open: true, title: 'Save Failed', message: error.response?.data?.message || 'We could not update the project.' })
                  }
                }}>Save Changes</button>
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