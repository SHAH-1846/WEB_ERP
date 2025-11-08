import { useEffect, useState } from 'react'
import { api, apiFetch } from '../lib/api'
import './LeadManagement.css'
import './LeadDetail.css'
import logo from '../assets/logo/WBES_Logo.png'

function RevisionDetail() {
  const [revision, setRevision] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [editModal, setEditModal] = useState({ open: false, form: null })
  const [showHistory, setShowHistory] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [approvalModal, setApprovalModal] = useState({ open: false, action: null, note: '' })
  const [showApprovals, setShowApprovals] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('token')
        const rid = localStorage.getItem('revisionId')
        if (!rid) return
        const res = await apiFetch(`/api/revisions/${rid}`)
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
          const resLead = await api.get(`/api/leads/${leadId}`)
          leadFull = resLead.data
          const resVisits = await api.get(`/api/leads/${leadId}/site-visits`)
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
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF for this revision. Please try again.' })
    }
  }

  const approveRevision = async (status, note) => {
    try {
      if (!revision) return
      const token = localStorage.getItem('token')
      await apiFetch(`/api/revisions/${revision._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note })
      })
      const res = await apiFetch(`/api/revisions/${revision._id}`)
      const updated = await res.json()
      setRevision(updated)
      setApprovalModal({ open: false, action: null, note: '' })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: 'We could not update approval. Please try again.' })
    }
  }

  const sendForApproval = async () => {
    try {
      if (!revision) return
      const token = localStorage.getItem('token')
      await apiFetch(`/api/revisions/${revision._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' })
      })
      const res = await apiFetch(`/api/revisions/${revision._id}`)
      const updated = await res.json()
      setRevision(updated)
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: 'We could not send for approval. Please try again.' })
    }
  }

  if (!revision) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Revision Details</h2>
      <p>Nothing to display.</p>
    </div>
  )

  const currency = revision.priceSchedule?.currency || 'AED'
  const approvalStatus = revision.managementApproval?.status

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
          <button className="link-btn" onClick={async () => {
            try {
              const token = localStorage.getItem('token')
              const res = await apiFetch(`/api/projects/by-revision/${revision._id}`)
              if (res.ok) {
                const pj = await res.json()
                try { localStorage.setItem('projectsFocusId', pj._id) } catch {}
                window.location.href = '/projects'
              } else {
                setNotify({ open: true, title: 'No Project', message: 'No project exists for this revision.' })
              }
            } catch { setNotify({ open: true, title: 'Open Project Failed', message: 'We could not open the linked project.' }) }
          }}>View Project</button>
          <button className="save-btn" onClick={exportPDF}>Export</button>
          {(currentUser?.roles?.includes('estimation_engineer') || revision?.createdBy?._id === currentUser?.id) && (
            <button className="assign-btn" onClick={() => setEditModal({ open: true, form: {
              companyInfo: revision.companyInfo || {},
              submittedTo: revision.submittedTo || '',
              attention: revision.attention || '',
              offerReference: revision.offerReference || '',
              enquiryNumber: revision.enquiryNumber || '',
              offerDate: revision.offerDate ? String(revision.offerDate).slice(0,10) : '',
              enquiryDate: revision.enquiryDate ? String(revision.enquiryDate).slice(0,10) : '',
              projectTitle: revision.projectTitle || revision.lead?.projectTitle || '',
              introductionText: revision.introductionText || '',
              scopeOfWork: revision.scopeOfWork || [],
              priceSchedule: revision.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: revision.priceSchedule?.currency || 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
              ourViewpoints: revision.ourViewpoints || '',
              exclusions: revision.exclusions || [],
              paymentTerms: revision.paymentTerms || [],
              deliveryCompletionWarrantyValidity: revision.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
            } })}>Edit</button>
          )}
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
                const res = await apiFetch(`/api/leads/${revision.lead._id}`)
                const leadData = await res.json()
                const visitsRes = await apiFetch(`/api/leads/${revision.lead._id}/site-visits`)
                const visits = await visitsRes.json()
                localStorage.setItem('leadDetail', JSON.stringify({ ...leadData, siteVisits: visits }))
                localStorage.setItem('leadId', revision.lead._id)
                window.location.href = '/lead-detail'
              } catch { setNotify({ open: true, title: 'Open Lead Failed', message: 'We could not open the linked lead. Please try again.' }) }
            }}>View Lead</button>
          )}
          {approvalStatus === 'pending' ? (
            <span className="status-badge blue">Approval Pending</span>
          ) : (
            (approvalStatus !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || revision?.createdBy?._id === currentUser?.id)) && (
              <button className="save-btn" onClick={sendForApproval}>Send for Approval</button>
            )
          )}
          {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && approvalStatus === 'pending' && (
            <>
              <button className="approve-btn" onClick={() => setApprovalModal({ open: true, action: 'approved', note: '' })}>Approve</button>
              <button className="reject-btn" onClick={() => setApprovalModal({ open: true, action: 'rejected', note: '' })}>Reject</button>
            </>
          )}
          <button className="link-btn" onClick={() => setShowApprovals(!showApprovals)}>{showApprovals ? 'Hide Approvals/Rejections' : 'View Approvals/Rejections'}</button>
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
            <p><strong>Created By:</strong> {revision.createdBy?._id === currentUser?.id ? 'You' : (revision.createdBy?.name || 'N/A')} {revision.createdBy?._id && revision.createdBy._id !== currentUser?.id && (
              <button className="link-btn" onClick={() => setProfileUser(revision.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
            )}</p>
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

      {revision && (
        <div className="ld-card ld-section">
          <button className="link-btn" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Hide Revision Edit History' : 'View Revision Edit History'}
          </button>
          {showHistory && Array.isArray(revision.edits) && revision.edits.length > 0 && (
            <div className="edits-list" style={{ marginTop: 8 }}>
              {revision.edits.slice().reverse().map((edit, idx) => (
                <div key={idx} className="edit-item">
                  <div className="edit-header">
                    <span>By {edit.editedBy?._id === currentUser?.id ? 'You' : (edit.editedBy?.name || 'N/A')}</span>
                    {edit.editedBy?._id && edit.editedBy._id !== currentUser?.id && (
                      <button className="link-btn" onClick={() => setProfileUser(edit.editedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                    )}
                    <span>{new Date(edit.editedAt).toLocaleString()}</span>
                  </div>
                  <ul className="changes-list">
                    {edit.changes.map((c, i) => (
                      <li key={i}>
                        <strong>{c.field}:</strong>
                        <div className="change-diff">
                          <pre className="change-block">{JSON.stringify(c.from, null, 2)}</pre>
                          <span>→</span>
                          <pre className="change-block">{JSON.stringify(c.to, null, 2)}</pre>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showApprovals && (
        <div className="ld-card ld-section">
          <h3>Approvals & Rejections</h3>
          {(() => {
            const rev = revision
            const rawLogs = Array.isArray(rev.managementApproval?.logs) ? rev.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
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

            if (cycles.length === 0 && (rev.managementApproval?.requestedBy || rev.managementApproval?.approvedBy)) {
              cycles.push({
                requestedAt: rev.updatedAt || rev.createdAt,
                requestedBy: rev.managementApproval?.requestedBy,
                requestNote: rev.managementApproval?.comments,
                decidedAt: rev.managementApproval?.approvedAt,
                decidedBy: rev.managementApproval?.approvedBy,
                decisionNote: rev.managementApproval?.comments,
                decisionStatus: rev.managementApproval?.status
              })
            }

            if (cycles.length === 0) return <p>No approval records.</p>

            return (
              <div className="edits-list" style={{ marginTop: 8 }}>
                {cycles.map((c, idx) => (
                  <div key={idx} className="edit-item">
                    <div className="edit-header">
                      <span>Approval Cycle {idx + 1} — {c.decisionStatus ? c.decisionStatus.toUpperCase() : 'PENDING'}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<>
                        by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                        {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                          <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </>)}
                      </div>
                      {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                      <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<>
                        by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
                        {c.decidedBy?._id && c.decidedBy._id !== currentUser?.id && (
                          <button className="link-btn" onClick={() => setProfileUser(c.decidedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </>)} {c.decisionStatus && <span style={{ marginLeft: 6, textTransform: 'uppercase' }}>({c.decisionStatus})</span>}
                      </div>
                      {c.decisionNote && <div><strong>Decision note:</strong> {c.decisionNote}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {editModal.open && (
        <div className="modal-overlay" onClick={() => setEditModal({ open: false, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Revision</h2>
              <button onClick={() => setEditModal({ open: false, form: null })} className="close-btn">×</button>
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
                  <button type="button" className="cancel-btn" onClick={() => setEditModal({ open: false, form: null })}>Cancel</button>
                  <button type="button" className="save-btn" onClick={async () => {
                    try {
                      const token = localStorage.getItem('token')
                      await apiFetch(`/api/revisions/${revision._id}`, {
                        method: 'PUT',
                        body: JSON.stringify(editModal.form)
                      })
                      const res = await apiFetch(`/api/revisions/${revision._id}`)
                      const updated = await res.json()
                      setRevision(updated)
                      setEditModal({ open: false, form: null })
                    } catch {
                      setNotify({ open: true, title: 'Save Failed', message: 'We could not save your changes. Please try again.' })
                    }
                  }}>Save Changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Revision' : 'Reject Revision'}</h2>
              <button onClick={() => setApprovalModal({ open: false, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>Cancel</button>
                <button type="button" className="save-btn" onClick={async () => {
                  if (!approvalModal.action) return
                  await approveRevision(approvalModal.action, approvalModal.note)
                }}>Confirm</button>
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

export default RevisionDetail


