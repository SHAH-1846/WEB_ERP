import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './LeadManagement.css'
import logo from '../assets/logo/WBES_Logo.png'

function RevisionManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [myOnly, setMyOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('createdAt_desc')
  const [editModal, setEditModal] = useState({ open: false, revision: null, form: null })
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [confirmDelete, setConfirmDelete] = useState({ open: false, revision: null })

  const defaultCompany = useMemo(() => ({
    logo,
    name: 'WBES',
    address: 'Dubai, UAE',
    phone: '+971-00-000-0000',
    email: 'info@wbes.example'
  }), [])

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user')) || null)
    void fetchRevisions()
  }, [])

  const fetchRevisions = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get('http://localhost:5000/api/revisions', { headers: { Authorization: `Bearer ${token}` } })
      setRevisions(res.data)
    } catch {}
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

  const filtered = revisions.filter(r => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      (r.projectTitle || '').toLowerCase().includes(term) ||
      (r.parentQuotation?.offerReference || '').toLowerCase().includes(term) ||
      (r.lead?.customerName || '').toLowerCase().includes(term)
    )
  })
  const sorted = filtered.slice().sort((a, b) => {
    switch (sortKey) {
      case 'createdAt_asc': return new Date(a.createdAt) - new Date(b.createdAt)
      case 'rev_asc': return (a.revisionNumber||0) - (b.revisionNumber||0)
      case 'rev_desc': return (b.revisionNumber||0) - (a.revisionNumber||0)
      case 'createdAt_desc':
      default: return new Date(b.createdAt) - new Date(a.createdAt)
    }
  })
  const byParent = sorted.reduce((acc, r) => {
    const key = r.parentQuotation?._id || r.parentQuotation
    if (!acc[key]) acc[key] = { parent: r.parentQuotation, items: [] }
    acc[key].items.push(r)
    return acc
  }, {})

  return (
    <div className="lead-management">
      <div className="header">
        <h1>Revisions Management</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={myOnly} onChange={() => setMyOnly(!myOnly)} />
            My Revisions
          </label>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="createdAt_desc">Newest</option>
            <option value="createdAt_asc">Oldest</option>
            <option value="rev_desc">Revision # desc</option>
            <option value="rev_asc">Revision # asc</option>
          </select>
        </div>
      </div>

      <div className="leads-grid">
        {Object.values(byParent).map((group, gi) => (
          <div key={(group.parent?._id || group.parent) + '_' + gi} className="lead-card" style={{ width: '100%', gridColumn: '1 / -1' }}>
            <div className="lead-header" style={{ justifyContent: 'space-between' }}>
              <h3>Revisions</h3>
              <button className="link-btn" onClick={() => {
                const qid = group.parent?._id || group.parent
                if (qid) {
                  localStorage.setItem('quotationId', qid)
                  window.location.href = '/quotation-detail'
                }
              }}>View Approved Quotation</button>
            </div>
            <div className="table" style={{ marginTop: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th>Revision #</th>
                    <th>Project</th>
                    <th>Offer Ref</th>
                    <th>Customer</th>
                    <th>Grand Total</th>
                    <th>Created By</th>
                    <th>Actions</th>
                    <th>Differences</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items
                    .filter(r => !myOnly || r.createdBy?._id === currentUser?.id)
                    .sort((a,b)=> (a.revisionNumber||0)-(b.revisionNumber||0))
                    .map(r => (
                    <tr key={r._id}>
                      <td data-label="Revision #">{r.revisionNumber}</td>
                      <td data-label="Project">{r.projectTitle || r.lead?.projectTitle || 'Revision'}</td>
                      <td data-label="Offer Ref">{r.offerReference || 'N/A'}</td>
                      <td data-label="Customer">{r.lead?.customerName || 'N/A'}</td>
                      <td data-label="Grand Total">{r.priceSchedule?.currency || 'AED'} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                      <td data-label="Created By">
                        {r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}
                        {r.createdBy?._id && r.createdBy._id !== currentUser?.id && (
                          <button className="link-btn" onClick={() => setProfileUser(r.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <button className="save-btn" onClick={() => exportPDF(r)}>Export</button>
                          {(currentUser?.roles?.includes('estimation_engineer') || currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin') || r.createdBy?._id === currentUser?.id) && (
                            <button className="assign-btn" onClick={() => setEditModal({ open: true, revision: r, form: {
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
                          {currentUser?.roles?.includes('estimation_engineer') && (
                            <button className="reject-btn" onClick={() => setConfirmDelete({ open: true, revision: r })}>Delete Revision</button>
                          )}
                        </div>
                      </td>
                      <td data-label="Differences">
                        {Array.isArray(r.diffFromParent) && r.diffFromParent.length > 0 ? (
                          <details>
                            <summary>View</summary>
                            <div style={{ marginTop: 6 }}>
                              {r.diffFromParent.map((d, i) => (
                                <div key={i} style={{ marginBottom: 8 }}>
                                  <strong>{d.field}:</strong>
                                  {d.field === 'deliveryCompletionWarrantyValidity' ? (
                                    (() => {
                                      const from = d.from || {}
                                      const to = d.to || {}
                                      const labels = {
                                        deliveryTimeline: 'Delivery Timeline',
                                        warrantyPeriod: 'Warranty Period',
                                        offerValidity: 'Offer Validity (Days)',
                                        authorizedSignatory: 'Authorized Signatory'
                                      }
                                      const keys = ['deliveryTimeline','warrantyPeriod','offerValidity','authorizedSignatory']
                                      const items = keys.filter(k => String(from?.[k] ?? '') !== String(to?.[k] ?? ''))
                                      if (items.length === 0) return <div style={{ marginTop: 4 }}>No changes</div>
                                      return (
                                        <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                                          {items.map((k, idx) => (
                                            <li key={idx}>
                                              {labels[k]}: {String(from?.[k] ?? '—')} → {String(to?.[k] ?? '—')}
                                            </li>
                                          ))}
                                        </ul>
                                      )
                                    })()
                                  ) : (
                                    <div className="change-diff">
                                      <pre className="change-block">{JSON.stringify(d.from, null, 2)}</pre>
                                      <span>→</span>
                                      <pre className="change-block">{JSON.stringify(d.to, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
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
                  <button type="button" className="cancel-btn" onClick={() => setEditModal({ open: false, revision: null, form: null })}>Cancel</button>
                  <button type="button" className="save-btn" onClick={async () => {
                    try {
                      const token = localStorage.getItem('token')
                      await axios.put(`http://localhost:5000/api/revisions/${editModal.revision._id}`, editModal.form, { headers: { Authorization: `Bearer ${token}` } })
                      await fetchRevisions()
                      setEditModal({ open: false, revision: null, form: null })
                    } catch (e) { alert(e.response?.data?.message || 'Failed to save revision') }
                  }}>Save Changes</button>
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
                    await axios.delete(`http://localhost:5000/api/revisions/${confirmDelete.revision._id}`, { headers: { Authorization: `Bearer ${token}` } })
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
    </div>
  )
}

export default RevisionManagement


