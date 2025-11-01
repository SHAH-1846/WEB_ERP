import { useEffect, useState } from 'react'
import axios from 'axios'
import './LeadManagement.css'
import './LeadDetail.css'
import logo from '../assets/logo/WBES_Logo.png'

function RevisionDetail() {
  const [revision, setRevision] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('token')
        const rid = localStorage.getItem('revisionId')
        if (!rid) return
        const res = await fetch(`http://localhost:5000/api/revisions/${rid}`, { headers: { Authorization: `Bearer ${token}` } })
        const rev = await res.json()
        setRevision(rev)
      } catch {}
    }
    load()
  }, [])

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

  const exportPDF = async () => {
    try {
      if (!revision) return
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(revision.companyInfo?.logo || logo)
      const currency = revision.priceSchedule?.currency || 'AED'

      // Lead details and site visits
      let leadFull = revision.lead || null
      let siteVisits = []
      try {
        const token = localStorage.getItem('token')
        const leadId = typeof revision.lead === 'object' ? revision.lead?._id : revision.lead
        if (leadId) {
          const resLead = await axios.get(`http://localhost:5000/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
          leadFull = resLead.data
          const resVisits = await axios.get(`http://localhost:5000/api/leads/${leadId}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
          siteVisits = Array.isArray(resVisits.data) ? resVisits.data : []
        }
      } catch {}

      const coverFieldsRaw = [
        ['Submitted To', revision.submittedTo],
        ['Attention', revision.attention],
        ['Offer Reference', revision.offerReference],
        ['Enquiry Number', revision.enquiryNumber || leadFull?.enquiryNumber],
        ['Offer Date', revision.offerDate ? new Date(revision.offerDate).toLocaleDateString() : ''],
        ['Enquiry Date', revision.enquiryDate ? new Date(revision.enquiryDate).toLocaleDateString() : ''],
        ['Project Title', revision.projectTitle || leadFull?.projectTitle]
      ]
      const coverFields = coverFieldsRaw.filter(([, v]) => v && String(v).trim().length > 0)

      const scopeRows = (revision.scopeOfWork || [])
        .filter(s => (s?.description || '').trim().length > 0)
        .map((s, i) => [
          String(i + 1),
          s.description,
          String(s.quantity || ''),
          s.unit || '',
          s.locationRemarks || ''
        ])

      const priceItems = (revision.priceSchedule?.items || [])
        .filter(it => (it?.description || '').trim().length > 0 || Number(it.quantity) > 0 || Number(it.unitRate) > 0)
      const priceRows = priceItems.map((it, i) => [
        String(i + 1),
        it.description || '',
        String(it.quantity || 0),
        it.unit || '',
        `${currency} ${Number(it.unitRate || 0).toFixed(2)}`,
        `${currency} ${Number((it.quantity || 0) * (it.unitRate || 0)).toFixed(2)}`
      ])

      const exclusions = (revision.exclusions || []).map(x => String(x || '').trim()).filter(Boolean)
      const paymentTerms = (revision.paymentTerms || []).filter(p => (p?.milestoneDescription || '').trim().length > 0 || String(p?.amountPercent || '').trim().length > 0)

      const dcwv = revision.deliveryCompletionWarrantyValidity || {}
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
                { text: revision.companyInfo?.name || 'Company', style: 'brand' },
                { text: [revision.companyInfo?.address, revision.companyInfo?.phone, revision.companyInfo?.email].filter(Boolean).join(' | '), color: '#64748b', fontSize: 9 }
              ]
            ],
            columnGap: 12
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }] }
        ]
      }

      const content = []
      content.push({ text: `Revision ${revision.revisionNumber} — Commercial Quotation`, style: 'h1', margin: [0, 0, 0, 8] })

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
                  [{ text: 'Sub Total', style: 'tdKey' }, { text: `${currency} ${Number(revision.priceSchedule?.subTotal || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: `VAT (${revision.priceSchedule?.taxDetails?.vatRate || 0}%)`, style: 'tdKey' }, { text: `${currency} ${Number(revision.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: 'Grand Total', style: 'th' }, { text: `${currency} ${Number(revision.priceSchedule?.grandTotal || 0).toFixed(2)}`, style: 'th', alignment: 'right' }]
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ],
          margin: [0, 8, 0, 0]
        })
      }

      if ((revision.ourViewpoints || '').trim().length > 0 || exclusions.length > 0) {
        content.push({ text: 'Our Viewpoints / Special Terms', style: 'h2', margin: [0, 12, 0, 6] })
        if ((revision.ourViewpoints || '').trim().length > 0) {
          content.push({ text: revision.ourViewpoints, margin: [0, 0, 0, 6] })
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

      const filename = `Revision_${revision.revisionNumber}_${revision.projectTitle || 'Quotation'}.pdf`
      window.pdfMake.createPdf(docDefinition).download(filename)
    } catch (e) {
      alert('Failed to export PDF')
    }
  }

  if (!revision) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Revision Details</h2>
      <p>Nothing to display.</p>
    </div>
  )

  const currency = revision.priceSchedule?.currency || 'AED'

  return (
    <div className="lead-detail">
      <div className="ld-header">
        <div className="ld-title">
          <div className="title-row">
            <h1>Revision {revision.revisionNumber} — {revision.projectTitle || revision.lead?.projectTitle || 'Revision'}</h1>
          </div>
          <span className="ld-subtitle">Parent Offer Ref: {revision.parentQuotation?.offerReference || 'N/A'}</span>
        </div>
        <div className="ld-sticky-actions">
          <button className="save-btn" onClick={exportPDF}>Export</button>
          <button className="link-btn" onClick={() => {
            if (revision.parentQuotation?._id) {
              localStorage.setItem('quotationId', revision.parentQuotation._id)
              window.location.href = '/quotation-detail'
            }
          }}>View Approved Quotation</button>
          {revision.lead?._id && (
            <button className="link-btn" onClick={async () => {
              try {
                const token = localStorage.getItem('token')
                const res = await fetch(`http://localhost:5000/api/leads/${revision.lead._id}`, { headers: { Authorization: `Bearer ${token}` } })
                const leadData = await res.json()
                const visitsRes = await fetch(`http://localhost:5000/api/leads/${revision.lead._id}/site-visits`, { headers: { Authorization: `Bearer ${token}` } })
                const visits = await visitsRes.json()
                localStorage.setItem('leadDetail', JSON.stringify({ ...leadData, siteVisits: visits }))
                localStorage.setItem('leadId', revision.lead._id)
                window.location.href = '/lead-detail'
              } catch { alert('Unable to open lead') }
            }}>View Lead</button>
          )}
        </div>
      </div>

      <div className="ld-grid">
        {revision.lead && (
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
                  <tr><td data-label="Field">Customer</td><td data-label="Value">{revision.lead.customerName || 'N/A'}</td></tr>
                  <tr><td data-label="Field">Project Title</td><td data-label="Value">{revision.lead.projectTitle || 'N/A'}</td></tr>
                  <tr><td data-label="Field">Enquiry #</td><td data-label="Value">{revision.lead.enquiryNumber || 'N/A'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="ld-card ld-section">
          <h3>Revision Overview</h3>
          <div className="ld-kv">
            <p><strong>Submitted To:</strong> {revision.submittedTo || 'N/A'}</p>
            <p><strong>Attention:</strong> {revision.attention || 'N/A'}</p>
            <p><strong>Offer Date:</strong> {revision.offerDate ? new Date(revision.offerDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry Date:</strong> {revision.enquiryDate ? new Date(revision.enquiryDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry #:</strong> {revision.enquiryNumber || revision.lead?.enquiryNumber || 'N/A'}</p>
            <p><strong>Currency:</strong> {currency}</p>
            <p><strong>Grand Total:</strong> {Number(revision.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
            <p><strong>Created By:</strong> {revision.createdBy?._id === currentUser?.id ? 'You' : (revision.createdBy?.name || 'N/A')}</p>
          </div>
        </div>

        {Array.isArray(revision.scopeOfWork) && revision.scopeOfWork.length > 0 && (
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
                  {revision.scopeOfWork.map((s, i) => (
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

        {Array.isArray(revision.priceSchedule?.items) && revision.priceSchedule.items.length > 0 && (
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
                  {revision.priceSchedule.items.map((it, i) => (
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

        {(revision.ourViewpoints || (revision.exclusions || []).length > 0) && (
          <div className="ld-card ld-section">
            <h3>Our Viewpoints / Special Terms</h3>
            {revision.ourViewpoints && <div style={{ marginBottom: 8 }}>{revision.ourViewpoints}</div>}
            {(revision.exclusions || []).length > 0 && (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Exclusion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revision.exclusions || []).map((ex, i) => (
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

        {Array.isArray(revision.paymentTerms) && revision.paymentTerms.length > 0 && (
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
                  {revision.paymentTerms.map((p, i) => (
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

        {revision.deliveryCompletionWarrantyValidity && (
          <div className="ld-card ld-section">
            <h3>Delivery, Completion, Warranty & Validity</h3>
            <div className="ld-kv">
              <p><strong>Delivery Timeline:</strong> {revision.deliveryCompletionWarrantyValidity.deliveryTimeline || 'N/A'}</p>
              <p><strong>Warranty Period:</strong> {revision.deliveryCompletionWarrantyValidity.warrantyPeriod || 'N/A'}</p>
              <p><strong>Offer Validity:</strong> {revision.deliveryCompletionWarrantyValidity.offerValidity || 'N/A'} days</p>
              <p><strong>Authorized Signatory:</strong> {revision.deliveryCompletionWarrantyValidity.authorizedSignatory || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RevisionDetail


