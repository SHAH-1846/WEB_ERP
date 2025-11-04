import { useEffect, useState } from 'react'
import axios from 'axios'
import './LeadManagement.css'

function ProjectDetail() {
  const [project, setProject] = useState(null)
  const [lead, setLead] = useState(null)
  const [quotation, setQuotation] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [editModal, setEditModal] = useState({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
  const [projectEngineers, setProjectEngineers] = useState([])
  const [profileUser, setProfileUser] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

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
      try {
        const token = localStorage.getItem('token')
        const focus = localStorage.getItem('projectsFocusId') || localStorage.getItem('projectId')
        if (!focus) return
        const res = await axios.get(`http://localhost:5000/api/projects/${focus}`, { headers: { Authorization: `Bearer ${token}` } })
        const pj = res.data
        setProject(pj)
        if (pj.leadId?._id) {
          const resLead = await axios.get(`http://localhost:5000/api/leads/${pj.leadId._id}`, { headers: { Authorization: `Bearer ${token}` } })
          setLead(resLead.data)
        }
        if (pj.sourceQuotation?._id) {
          const resQ = await axios.get(`http://localhost:5000/api/quotations/${pj.sourceQuotation._id}`, { headers: { Authorization: `Bearer ${token}` } })
          setQuotation(resQ.data)
        }
        if (pj.sourceRevision?.parentQuotation) {
          const resR = await axios.get(`http://localhost:5000/api/revisions?parentQuotation=${pj.sourceRevision.parentQuotation}`, { headers: { Authorization: `Bearer ${token}` } })
          setRevisions(Array.isArray(resR.data) ? resR.data : [])
        }
        // Preload project engineers for name mapping and profile view
        try {
          const resEng = await axios.get('http://localhost:5000/api/projects/project-engineers', { headers: { Authorization: `Bearer ${token}` } })
          setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
        } catch {}
      } catch (e) {}
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
        const resVisits = await axios.get(`http://localhost:5000/api/site-visits/project/${project._id}`, { headers: { Authorization: `Bearer ${token}` } })
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
              const resEng = await axios.get('http://localhost:5000/api/projects/project-engineers', { headers: { Authorization: `Bearer ${token}` } })
              setProjectEngineers(Array.isArray(resEng.data) ? resEng.data : [])
            } catch {}
            setEditModal({ open: true, form: { name: project.name || '', locationDetails: project.locationDetails || '', workingHours: project.workingHours || '', manpowerCount: project.manpowerCount || '', status: project.status || 'active', assignedProjectEngineer: project.assignedProjectEngineer?._id || '' } })
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
                <tr><td data-label="Field">Site Engineer</td><td data-label="Value">{project.assignedSiteEngineer?.name || 'Not Assigned'}</td></tr>
                <tr><td data-label="Field">Project Engineer</td><td data-label="Value">{project.assignedProjectEngineer?.name || 'Not Assigned'}{project.assignedProjectEngineer?._id && (
                  <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => setProfileUser(project.assignedProjectEngineer)}>View Profile</button>
                )}</td></tr>
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
                <label>Project Engineer</label>
                <select value={editModal.form.assignedProjectEngineer} onChange={e => setEditModal({ ...editModal, form: { ...editModal.form, assignedProjectEngineer: e.target.value } })}>
                  <option value="">-- Select --</option>
                  {projectEngineers.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              {editModal.form.assignedProjectEngineer && (
                <div className="form-group">
                  <button type="button" className="link-btn" onClick={() => {
                    const u = projectEngineers.find(x => String(x._id) === String(editModal.form.assignedProjectEngineer))
                    if (u) setProfileUser(u)
                  }}>View Profile</button>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    await axios.put(`http://localhost:5000/api/projects/${project._id}`, editModal.form, { headers: { Authorization: `Bearer ${token}` } })
                    const res = await axios.get(`http://localhost:5000/api/projects/${project._id}`, { headers: { Authorization: `Bearer ${token}` } })
                    setProject(res.data)
                    setEditModal({ open: false, form: { name: '', locationDetails: '', workingHours: '', manpowerCount: '', status: 'active' } })
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
    </div>
  )
}

export default ProjectDetail


