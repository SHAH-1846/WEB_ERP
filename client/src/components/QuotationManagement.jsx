import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './LeadManagement.css'
import logo from '../assets/logo/WBES_Logo.png'

function QuotationManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [leads, setLeads] = useState([])
  const [quotations, setQuotations] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [historyQuote, setHistoryQuote] = useState(null)
  const [myQuotationsOnly, setMyQuotationsOnly] = useState(false)
  const [approvalModal, setApprovalModal] = useState({ open: false, quote: null, action: null, note: '' })
  const [approvalsView, setApprovalsView] = useState(null)

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

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user')) || null)
    void fetchLeads()
    void fetchQuotations()
  }, [])

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get('http://localhost:5000/api/leads', { headers: { Authorization: `Bearer ${token}` } })
      setLeads(res.data)
    } catch {}
  }

  const fetchQuotations = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get('http://localhost:5000/api/quotations', { headers: { Authorization: `Bearer ${token}` } })
      setQuotations(res.data)
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
    setForm({
      ...form,
      lead: '',
      companyInfo: defaultCompany,
      offerDate: new Date().toISOString().slice(0,10),
      enquiryDate: '',
      projectTitle: '',
      introductionText: '',
      scopeOfWork: [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
      priceSchedule: {
        items: [{ description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }],
        subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 }
      },
      exclusions: [''],
      paymentTerms: [{ milestoneDescription: '', amountPercent: '' }],
      deliveryCompletionWarrantyValidity: { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = { ...form }
      // ensure totals
      const totals = recalcTotals(payload.priceSchedule.items, payload.priceSchedule.taxDetails.vatRate)
      payload.priceSchedule.subTotal = totals.subTotal
      payload.priceSchedule.taxDetails.vatAmount = totals.vatAmount
      payload.priceSchedule.grandTotal = totals.grandTotal
      if (editing) {
        await axios.put(`http://localhost:5000/api/quotations/${editing._id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
      } else {
        await axios.post('http://localhost:5000/api/quotations', payload, { headers: { Authorization: `Bearer ${token}` } })
      }
      await fetchQuotations()
      setShowModal(false)
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving quotation')
    }
  }

  const approveQuotation = async (q, status, note) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/quotations/${q._id}/approve`, { status, note }, { headers: { Authorization: `Bearer ${token}` } })
      await fetchQuotations()
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update approval')
    }
  }

  const sendForApproval = async (q) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(`http://localhost:5000/api/quotations/${q._id}/approve`, { status: 'pending' }, { headers: { Authorization: `Bearer ${token}` } })
      await fetchQuotations()
      alert('Approval request sent')
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to send for approval')
    }
  }

  const exportPDF = async (q) => {
    try {
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(q.companyInfo?.logo || logo)
      const isPending = (q.managementApproval?.status || 'pending') === 'pending'

      const currency = q.priceSchedule?.currency || 'AED'
      // Fetch lead details and site visits for inclusion
      let leadFull = q.lead || null
      let siteVisits = []
      try {
        const token = localStorage.getItem('token')
        const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
        if (leadId) {
          const resLead = await axios.get(`http://localhost:5000/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
          leadFull = resLead.data
          const resVisits = await axios.get(`http://localhost:5000/api/leads/${leadId}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
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

  return (
    <div className="lead-management">
      <div className="header">
        <h1>Quotation Management</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myQuotationsOnly} onChange={() => setMyQuotationsOnly(!myQuotationsOnly)} />
            My Quotations
          </label>
          {canCreate() && (
            <button className="add-btn" onClick={openCreate}>Create Quotation</button>
          )}
        </div>
      </div>

      <div className="leads-grid">
        {quotations.filter(q => !myQuotationsOnly || q.createdBy?._id === currentUser?.id).map(q => (
          <div key={q._id} className="lead-card">
            <div className="lead-header">
              <h3>{q.projectTitle || q.lead?.projectTitle || 'Quotation'}</h3>
              <span className={`status-badge ${q.managementApproval?.status === 'approved' ? 'green' : (q.managementApproval?.status === 'rejected' ? 'red' : 'blue')}`}>
                {q.managementApproval?.status || 'pending'}
              </span>
            </div>
            <div className="lead-details">
              <p><strong>Customer:</strong> {q.lead?.customerName || 'N/A'}</p>
              <p><strong>Enquiry #:</strong> {q.enquiryNumber || q.lead?.enquiryNumber || 'N/A'}</p>
              <p><strong>Offer Ref:</strong> {q.offerReference || 'N/A'}</p>
              <p><strong>Grand Total:</strong> {q.priceSchedule?.currency || 'AED'} {Number(q.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
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
            <div className="lead-actions">
              <button className="assign-btn" onClick={() => {
                setEditing(q)
                setForm({
                  lead: q.lead?._id || q.lead,
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
                })
                setShowModal(true)
              }}>Edit</button>
              <button className="save-btn" onClick={() => exportPDF(q)}>Export</button>
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
              {q.managementApproval?.status !== 'approved' && q.managementApproval?.status !== 'rejected' && (
                <button className="save-btn" onClick={() => sendForApproval(q)}>Send for Approval</button>
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
                    const token = localStorage.getItem('token')
                    const res = await axios.get(`http://localhost:5000/api/leads/${q.lead._id}`, { headers: { Authorization: `Bearer ${token}` } })
                    const visitsRes = await axios.get(`http://localhost:5000/api/leads/${q.lead._id}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
                    const detail = { ...res.data, siteVisits: visitsRes.data }
                    localStorage.setItem('leadDetail', JSON.stringify(detail))
                    localStorage.setItem('leadId', q.lead._id)
                    window.location.href = '/lead-detail'
                  } catch { alert('Unable to open lead') }
                }}>View Lead</button>
              )}
              {q.edits?.length > 0 && (
                <button className="link-btn" onClick={() => setHistoryQuote(q)}>View Edit History</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Quotation' : 'Create Quotation'}</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSave} className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
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
    </div>
  )
}

export default QuotationManagement


