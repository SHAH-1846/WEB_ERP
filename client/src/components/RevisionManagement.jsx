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
      alert('Failed to export PDF')
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
                      <td data-label="Created By">{r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}</td>
                      <td data-label="Actions">
                        <button className="save-btn" onClick={() => exportPDF(r)}>Export</button>
                        <button className="link-btn" onClick={() => {
                          localStorage.setItem('revisionId', r._id)
                          window.location.href = '/revision-detail'
                        }} style={{ marginLeft: 6 }}>View Details</button>
                        {currentUser?.roles?.includes('estimation_engineer') && (
                      <button className="reject-btn" onClick={async () => {
                            try {
                              const token = localStorage.getItem('token')
                              await axios.delete(`http://localhost:5000/api/revisions/${r._id}`, { headers: { Authorization: `Bearer ${token}` } })
                              alert('Revision undone')
                              await fetchRevisions()
                        } catch (e) { alert(e.response?.data?.message || 'Failed to delete revision') }
                      }} style={{ marginLeft: 6 }}>Delete Revision</button>
                        )}
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
    </div>
  )
}

export default RevisionManagement


