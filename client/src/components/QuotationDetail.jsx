import { useEffect, useState } from 'react'
import './LeadManagement.css'
import './LeadDetail.css'
import logo from '../assets/logo/WBES_Logo.png'

function QuotationDetail() {
  const [quotation, setQuotation] = useState(null)
  const [lead, setLead] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [showQuoteHistory, setShowQuoteHistory] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, action: null, note: '' })
  const [approvalsViewOpen, setApprovalsViewOpen] = useState(false)

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
      const isPending = (q.managementApproval?.status || 'pending') === 'pending'
      const currency = q.priceSchedule?.currency || 'AED'

      // Use already loaded lead info when available
      const leadFull = lead || (typeof q.lead === 'object' ? q.lead : null)
      const siteVisits = Array.isArray(lead?.siteVisits) ? lead.siteVisits : []

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
      content.push({ text: 'Commercial Quotation', style: 'h1', margin: [0, 0, 0, 8] })

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

      if ((q.introductionText || '').trim().length > 0) {
        content.push({ text: 'Introduction', style: 'h2', margin: [0, 10, 0, 6] })
        content.push({ text: q.introductionText, margin: [0, 0, 0, 6] })
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

      content.push({ text: isPending ? 'Management Approval: Pending' : `Approved by: ${q.managementApproval?.approvedBy?.name || 'Management'}`, italics: true, color: isPending ? '#b45309' : '#16a34a', margin: [0, 12, 0, 0] })

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
                  { text: isPending ? 'Approval Pending' : 'Approved', color: isPending ? '#b45309' : '#16a34a' },
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
      alert('Failed to export PDF')
    }
  }

  const approveQuotation = async (status, note) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`http://localhost:5000/api/quotations/${quotation._id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, note })
      })
      const res = await fetch(`http://localhost:5000/api/quotations/${quotation._id}`, { headers: { Authorization: `Bearer ${token}` } })
      const updated = await res.json()
      setQuotation(updated)
      setApprovalModal({ open: false, action: null, note: '' })
    } catch (e) {
      alert('Failed to update approval')
    }
  }

  const sendForApproval = async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`http://localhost:5000/api/quotations/${quotation._id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'pending' })
      })
      const res = await fetch(`http://localhost:5000/api/quotations/${quotation._id}`, { headers: { Authorization: `Bearer ${token}` } })
      const updated = await res.json()
      setQuotation(updated)
      alert('Approval request sent')
    } catch (e) {
      alert('Failed to send for approval')
    }
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
        const entries = Object.entries(value).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        return entries.join('\n')
      }
    } catch {}
    return String(value)
  }

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('token')
        const qid = localStorage.getItem('quotationId')
        let initial = null
        const stored = localStorage.getItem('quotationDetail')
        if (stored) initial = JSON.parse(stored)
        if (qid) {
          const res = await fetch(`http://localhost:5000/api/quotations/${qid}`, { headers: { Authorization: `Bearer ${token}` } })
          const q = await res.json()
          setQuotation(q)
          const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
          if (leadId) {
            const resLead = await fetch(`http://localhost:5000/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
            const leadData = await resLead.json()
            const visitsRes = await fetch(`http://localhost:5000/api/leads/${leadId}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
            const visits = await visitsRes.json()
            setLead({ ...leadData, siteVisits: visits })
          }
        } else if (initial) {
          setQuotation(initial)
          const leadId = typeof initial.lead === 'object' ? initial.lead?._id : initial.lead
          if (leadId) {
            const resLead = await fetch(`http://localhost:5000/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
            const leadData = await resLead.json()
            const visitsRes = await fetch(`http://localhost:5000/api/leads/${leadId}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
            const visits = await visitsRes.json()
            setLead({ ...leadData, siteVisits: visits })
          }
        }
      } catch {}
    }
    load()
  }, [])

  if (!quotation) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Quotation Details</h2>
      <p>Nothing to display.</p>
    </div>
  )

  const approvalStatus = quotation.managementApproval?.status || 'pending'

  return (
    <div className="lead-detail">
      <div className="ld-header">
        <div className="ld-title">
          <div className="title-row">
            <h1>{quotation.projectTitle || quotation.lead?.projectTitle || 'Quotation'}</h1>
          </div>
          <span className="ld-subtitle">Offer Ref: {quotation.offerReference || 'N/A'}</span>
        </div>
        <div className="ld-sticky-actions">
          <span className={`status-pill ${approvalStatus}`}>{approvalStatus}</span>
          <button className="save-btn" onClick={() => exportPDF(quotation)}>Export</button>
          {approvalStatus !== 'approved' && approvalStatus !== 'rejected' && (
            <button className="save-btn" onClick={sendForApproval}>Send for Approval</button>
          )}
          <button className="link-btn" onClick={() => setApprovalsViewOpen(true)}>View Approvals/Rejections</button>
          {quotation.edits?.length > 0 && (
            <button className="link-btn" onClick={() => setShowQuoteHistory(!showQuoteHistory)}>
              {showQuoteHistory ? 'Hide Quotation Edit History' : 'View Quotation Edit History'}
            </button>
          )}
        </div>
      </div>

      <div className="ld-grid">
        {lead && (
          <div className="ld-card ld-section">
            <h3>Lead Overview</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Field">Customer</td>
                    <td data-label="Value">{lead.customerName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td data-label="Field">Project Title</td>
                    <td data-label="Value">{lead.projectTitle || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td data-label="Field">Enquiry #</td>
                    <td data-label="Value">{lead.enquiryNumber || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td data-label="Field">Enquiry Date</td>
                    <td data-label="Value">{lead.enquiryDate ? new Date(lead.enquiryDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td data-label="Field">Submission Due</td>
                    <td data-label="Value">{lead.submissionDueDate ? new Date(lead.submissionDueDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td data-label="Field">Scope</td>
                    <td data-label="Value">{lead.scopeSummary || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="ld-card ld-section">
          <h3>Quotation Overview</h3>
          <div className="ld-kv">
            <p><strong>Submitted To:</strong> {quotation.submittedTo || 'N/A'}</p>
            <p><strong>Attention:</strong> {quotation.attention || 'N/A'}</p>
            <p><strong>Offer Date:</strong> {quotation.offerDate ? new Date(quotation.offerDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry Date:</strong> {quotation.enquiryDate ? new Date(quotation.enquiryDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry #:</strong> {quotation.enquiryNumber || lead?.enquiryNumber || 'N/A'}</p>
            <p><strong>Currency:</strong> {quotation.priceSchedule?.currency || 'AED'}</p>
            <p><strong>Sub Total:</strong> {Number(quotation.priceSchedule?.subTotal || 0).toFixed(2)}</p>
            <p><strong>VAT:</strong> {quotation.priceSchedule?.taxDetails?.vatRate || 0}% ({Number(quotation.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)})</p>
            <p><strong>Grand Total:</strong> {Number(quotation.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
            <p>
              <strong>Created By:</strong> {quotation.createdBy?._id === currentUser?.id ? 'You' : (quotation.createdBy?.name || 'N/A')}
              {quotation.createdBy?._id !== currentUser?.id && quotation.createdBy && (
                <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => setProfileUser(quotation.createdBy)}>View Profile</button>
              )}
            </p>
          </div>
          {quotation.managementApproval?.requestedBy?.name && (
            <p><strong>Approval sent by:</strong> {quotation.managementApproval.requestedBy.name} {quotation.managementApproval.requestedBy?._id && (
              <button className="link-btn" onClick={() => setProfileUser(quotation.managementApproval.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
            )}</p>
          )}
          {quotation.managementApproval?.approvedBy?.name && (
            <p><strong>Approved by:</strong> {quotation.managementApproval.approvedBy.name} {quotation.managementApproval.approvedBy?._id && (
              <button className="link-btn" onClick={() => setProfileUser(quotation.managementApproval.approvedBy)} style={{ marginLeft: 6 }}>View Profile</button>
            )}</p>
          )}
        </div>

        {quotation.introductionText && (
          <div className="ld-card ld-section">
            <h3>Introduction</h3>
            <div>{quotation.introductionText}</div>
          </div>
        )}

        {Array.isArray(quotation.scopeOfWork) && quotation.scopeOfWork.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Scope of Work</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Location/Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.scopeOfWork.map((s, i) => (
                    <tr key={i}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Description">{s.description || ''}</td>
                      <td data-label="Qty">{s.quantity || ''}</td>
                      <td data-label="Unit">{s.unit || ''}</td>
                      <td data-label="Location/Remarks">{s.locationRemarks || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {Array.isArray(quotation.priceSchedule?.items) && quotation.priceSchedule.items.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Price Schedule</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.priceSchedule.items.map((it, i) => (
                    <tr key={i}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Description">{it.description || ''}</td>
                      <td data-label="Qty">{it.quantity || 0}</td>
                      <td data-label="Unit">{it.unit || ''}</td>
                      <td data-label="Unit Rate">{Number(it.unitRate || 0).toFixed(2)}</td>
                      <td data-label="Amount">{Number(it.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(quotation.ourViewpoints || (quotation.exclusions || []).length > 0) && (
          <div className="ld-card ld-section">
            <h3>Our Viewpoints / Special Terms</h3>
            {quotation.ourViewpoints && <div style={{ marginBottom: 8 }}>{quotation.ourViewpoints}</div>}
            {(quotation.exclusions || []).length > 0 && (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Exclusion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quotation.exclusions || []).map((ex, i) => (
                      <tr key={i}>
                        <td data-label="#">{i + 1}</td>
                        <td data-label="Exclusion">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {Array.isArray(quotation.paymentTerms) && quotation.paymentTerms.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Payment Terms</h3>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Milestone</th>
                    <th>Amount %</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.paymentTerms.map((p, i) => (
                    <tr key={i}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Milestone">{p.milestoneDescription || ''}</td>
                      <td data-label="Amount %">{p.amountPercent || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {quotation.deliveryCompletionWarrantyValidity && (
          <div className="ld-card ld-section">
            <h3>Delivery, Completion, Warranty & Validity</h3>
            <div className="ld-kv">
              <p><strong>Delivery Timeline:</strong> {quotation.deliveryCompletionWarrantyValidity.deliveryTimeline || 'N/A'}</p>
              <p><strong>Warranty Period:</strong> {quotation.deliveryCompletionWarrantyValidity.warrantyPeriod || 'N/A'}</p>
              <p><strong>Offer Validity:</strong> {quotation.deliveryCompletionWarrantyValidity.offerValidity || 'N/A'} days</p>
              <p><strong>Authorized Signatory:</strong> {quotation.deliveryCompletionWarrantyValidity.authorizedSignatory || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {showQuoteHistory && quotation.edits?.length > 0 && (
        <div className="ld-card ld-section">
          <h3>Quotation Edit History</h3>
          <div className="edits-list">
            {quotation.edits.slice().reverse().map((edit, idx) => (
              <div key={idx} className="edit-item">
                <div className="edit-header">
                  <span>By {edit.editedBy?._id === currentUser?.id ? 'You' : (edit.editedBy?.name || 'N/A')}</span>
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
            ))}
          </div>
        </div>
      )}
      {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && approvalStatus === 'pending' && (
        <div className="ld-card ld-section">
          <div className="ld-actions">
            <button className="approve-btn" onClick={() => setApprovalModal({ open: true, action: 'approved', note: '' })}>Approve</button>
            <button className="reject-btn" onClick={() => setApprovalModal({ open: true, action: 'rejected', note: '' })}>Reject</button>
          </div>
        </div>
      )}

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Quotation' : 'Reject Quotation'}</h2>
              <button onClick={() => setApprovalModal({ open: false, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={() => approveQuotation(approvalModal.action, approvalModal.note)}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {approvalsViewOpen && (
        <div className="modal-overlay history" onClick={() => setApprovalsViewOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approvals & Rejections</h2>
              <button onClick={() => setApprovalsViewOpen(false)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '65vh', overflow: 'auto' }}>
              {(() => {
                const q = quotation
                const logs = q.approvals || q.managementApproval?.logs || []
                const requestedBy = q.managementApproval?.requestedBy
                const approvedBy = q.managementApproval?.approvedBy
                const currentStatus = q.managementApproval?.status || 'pending'
                const note = q.managementApproval?.note
                if ((!Array.isArray(logs) || logs.length === 0) && !requestedBy && !approvedBy) return <p>No approval records.</p>
                return (
                  <div>
                    {requestedBy && (
                      <div className="edit-item">
                        <div className="edit-header">
                          <span>Approval sent by {requestedBy?._id === currentUser?.id ? 'You' : (requestedBy?.name || 'N/A')}</span>
                          {requestedBy?._id && <button className="link-btn" onClick={() => setProfileUser(requestedBy)}>View Profile</button>}
                        </div>
                        {note && <div style={{ whiteSpace: 'pre-wrap' }}><strong>Note:</strong> {note}</div>}
                      </div>
                    )}
                    {approvedBy && (
                      <div className="edit-item">
                        <div className="edit-header">
                          <span>{currentStatus === 'approved' ? 'Approved' : 'Rejected'} by {approvedBy?._id === currentUser?.id ? 'You' : (approvedBy?.name || 'N/A')}</span>
                          {approvedBy?._id && <button className="link-btn" onClick={() => setProfileUser(approvedBy)}>View Profile</button>}
                        </div>
                        {note && <div style={{ whiteSpace: 'pre-wrap' }}><strong>Note:</strong> {note}</div>}
                      </div>
                    )}
                    {Array.isArray(logs) && logs.length > 0 && logs.map((l, i) => (
                      <div key={i} className="edit-item" style={{ marginTop: 8 }}>
                        <div className="edit-header">
                          <span>{l.status?.toUpperCase?.() || 'UPDATE'} — {new Date(l.at || Date.now()).toLocaleString()}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {l.requestedBy?.name && <div>Requested by: {l.requestedBy.name} {l.requestedBy?._id && <button className="link-btn" onClick={() => setProfileUser(l.requestedBy)}>View Profile</button>}</div>}
                          {l.decidedBy?.name && <div>Decided by: {l.decidedBy.name} {l.decidedBy?._id && <button className="link-btn" onClick={() => setProfileUser(l.decidedBy)}>View Profile</button>}</div>}
                          {l.note && <div>Note: {l.note}</div>}
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
    </div>
  )
}

export default QuotationDetail


