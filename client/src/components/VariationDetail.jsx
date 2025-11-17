import { useEffect, useState } from 'react'
import { api, apiFetch } from '../lib/api'
import './LeadManagement.css'
import './LeadDetail.css'
import './LoadingComponents.css'
import logo from '../assets/logo/WBES_Logo.png'
import { Spinner, Skeleton, PageSkeleton, ButtonLoader } from './LoadingComponents'

function VariationDetail() {
  const [variation, setVariation] = useState(null)
  const [lead, setLead] = useState(null)
  const [project, setProject] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [editModal, setEditModal] = useState({ open: false, form: null })
  const [createVariationModal, setCreateVariationModal] = useState({ open: false, form: null })
  const [showHistory, setShowHistory] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [approvalModal, setApprovalModal] = useState({ open: false, action: null, note: '' })
  const [showApprovals, setShowApprovals] = useState(false)
  const [editWarningModal, setEditWarningModal] = useState({ open: false })
  const [sendApprovalConfirmModal, setSendApprovalConfirmModal] = useState({ open: false })
  const [dateFieldsModified, setDateFieldsModified] = useState({ offerDate: false, enquiryDate: false })
  const [originalDateValues, setOriginalDateValues] = useState({ offerDate: null, enquiryDate: null })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const vid = localStorage.getItem('variationId')
        if (!vid) {
          setIsLoading(false)
          return
        }
        const res = await apiFetch(`/api/project-variations/${vid}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch variation: ${res.status} ${res.statusText}`)
        }
        const varData = await res.json()
        if (!varData || !varData._id) {
          throw new Error('Invalid variation data received')
        }
        setVariation(varData)
        
        // Load lead if available
        if (varData.lead) {
          const leadId = typeof varData.lead === 'object' ? varData.lead?._id : varData.lead
          if (leadId) {
            try {
              const resLead = await apiFetch(`/api/leads/${leadId}`)
              const leadData = await resLead.json()
              const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
              const visits = await visitsRes.json()
              setLead({ ...leadData, siteVisits: visits })
            } catch {}
          }
        }
        
        // Load parent project if available
        if (varData.parentProject) {
          const projectId = typeof varData.parentProject === 'object' ? varData.parentProject?._id : varData.parentProject
          if (projectId) {
            try {
              const resProject = await apiFetch(`/api/projects/${projectId}`)
              const projectData = await resProject.json()
              setProject(projectData)
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error loading variation:', e)
        setNotify({ open: true, title: 'Load Failed', message: 'Failed to load variation data. Please try again.' })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
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
      if (!variation) return
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(variation.companyInfo?.logo || logo)
      const currency = variation.priceSchedule?.currency || 'AED'

      const leadFull = lead || (typeof variation.lead === 'object' ? variation.lead : null)
      const siteVisits = Array.isArray(lead?.siteVisits) ? lead.siteVisits : []

      const coverFieldsRaw = [
        ['Submitted To', variation.submittedTo],
        ['Attention', variation.attention],
        ['Offer Reference', variation.offerReference],
        ['Enquiry Number', variation.enquiryNumber || leadFull?.enquiryNumber],
        ['Offer Date', variation.offerDate ? new Date(variation.offerDate).toLocaleDateString() : ''],
        ['Enquiry Date', variation.enquiryDate ? new Date(variation.enquiryDate).toLocaleDateString() : ''],
        ['Project Title', variation.projectTitle || leadFull?.projectTitle]
      ]
      const coverFields = coverFieldsRaw.filter(([, v]) => v && String(v).trim().length > 0)

      const scopeRows = (variation.scopeOfWork || [])
        .filter(s => (s?.description || '').trim().length > 0)
        .map((s, i) => [
          String(i + 1),
          s.description,
          String(s.quantity || ''),
          s.unit || '',
          s.locationRemarks || ''
        ])

      const priceItems = (variation.priceSchedule?.items || [])
        .filter(it => (it?.description || '').trim().length > 0 || Number(it.quantity) > 0 || Number(it.unitRate) > 0)
      const priceRows = priceItems.map((it, i) => [
        String(i + 1),
        it.description || '',
        String(it.quantity || 0),
        it.unit || '',
        `${currency} ${Number(it.unitRate || 0).toFixed(2)}`,
        `${currency} ${Number((it.quantity || 0) * (it.unitRate || 0)).toFixed(2)}`
      ])

      const exclusions = (variation.exclusions || []).map(x => String(x || '').trim()).filter(Boolean)
      const paymentTerms = (variation.paymentTerms || []).filter(p => (p?.milestoneDescription || '').trim().length > 0 || String(p?.amountPercent || '').trim().length > 0)

      const dcwv = variation.deliveryCompletionWarrantyValidity || {}
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
                { text: variation.companyInfo?.name || 'Company', style: 'brand' },
                { text: [variation.companyInfo?.address, variation.companyInfo?.phone, variation.companyInfo?.email].filter(Boolean).join(' | '), color: '#64748b', fontSize: 9 }
              ]
            ],
            columnGap: 12
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }] }
        ]
      }

      const content = []
      content.push({ text: `Variation ${variation.variationNumber} — Commercial Quotation`, style: 'h1', margin: [0, 0, 0, 8] })

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

      if ((variation.introductionText || '').trim().length > 0) {
        content.push({ text: 'Introduction', style: 'h2', margin: [0, 10, 0, 6] })
        content.push({ text: variation.introductionText, margin: [0, 0, 0, 6] })
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
                  [{ text: 'Sub Total', style: 'tdKey' }, { text: `${currency} ${Number(variation.priceSchedule?.subTotal || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: `VAT (${variation.priceSchedule?.taxDetails?.vatRate || 0}%)`, style: 'tdKey' }, { text: `${currency} ${Number(variation.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)}`, alignment: 'right' }],
                  [{ text: 'Grand Total', style: 'th' }, { text: `${currency} ${Number(variation.priceSchedule?.grandTotal || 0).toFixed(2)}`, style: 'th', alignment: 'right' }]
                ]
              },
              layout: 'lightHorizontalLines'
            }
          ],
          margin: [0, 8, 0, 0]
        })
      }

      if ((variation.ourViewpoints || '').trim().length > 0 || exclusions.length > 0) {
        content.push({ text: 'Our Viewpoints / Special Terms', style: 'h2', margin: [0, 12, 0, 6] })
        if ((variation.ourViewpoints || '').trim().length > 0) {
          content.push({ text: variation.ourViewpoints, margin: [0, 0, 0, 6] })
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

      const isPending = variation.managementApproval?.status === 'pending'
      if (isPending) {
        content.push({ text: 'Management Approval: Pending', italics: true, color: '#b45309', margin: [0, 12, 0, 0] })
      } else if (variation.managementApproval?.status === 'approved') {
        content.push({ text: `Approved by: ${variation.managementApproval?.approvedBy?.name || 'Management'}`, italics: true, color: '#16a34a', margin: [0, 12, 0, 0] })
      }

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
                  { text: isPending ? 'Approval Pending' : (variation.managementApproval?.status === 'approved' ? 'Approved' : ''), color: isPending ? '#b45309' : '#16a34a' },
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

      const filename = `Variation_${variation.variationNumber}_${variation.projectTitle || 'Quotation'}.pdf`
      window.pdfMake.createPdf(docDefinition).download(filename)
    } catch (e) {
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF. Please try again.' })
    }
  }

  const approveVariation = async (status, note) => {
    setLoadingAction(`approve-${status}`)
    setIsSubmitting(true)
    try {
      if (!variation) return
      const token = localStorage.getItem('token')
      await apiFetch(`/api/project-variations/${variation._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note })
      })
      const res = await apiFetch(`/api/project-variations/${variation._id}`)
      if (!res.ok) throw new Error('Failed to refresh variation')
      const updated = await res.json()
      if (updated && updated._id) {
        setVariation(updated)
      }
      setApprovalModal({ open: false, action: null, note: '' })
      setNotify({ open: true, title: status === 'approved' ? 'Variation Approved' : 'Variation Rejected', message: `The variation has been ${status === 'approved' ? 'approved' : 'rejected'} successfully.` })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: 'We could not update approval. Please try again.' })
    } finally {
      setIsSubmitting(false)
      setLoadingAction(null)
    }
  }

  const sendForApproval = async () => {
    setLoadingAction('send-approval')
    setIsSubmitting(true)
    try {
      if (!variation) return
      const token = localStorage.getItem('token')
      await apiFetch(`/api/project-variations/${variation._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' })
      })
      const res = await apiFetch(`/api/project-variations/${variation._id}`)
      if (!res.ok) throw new Error('Failed to refresh variation')
      const updated = await res.json()
      if (updated && updated._id) {
        setVariation(updated)
      }
      setSendApprovalConfirmModal({ open: false })
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: 'We could not send for approval. Please try again.' })
    }
  }

  const hasVariationChanges = (original, form) => {
    if (!original || !form) return false
    
    // Normalize date values for comparison
    const normalizeDate = (date) => {
      if (!date) return null
      if (typeof date === 'string') {
        // If it's already in YYYY-MM-DD format, return as is
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date
        // Otherwise try to convert
        try {
          const d = new Date(date)
          if (isNaN(d.getTime())) return null
          return d.toISOString().slice(0, 10)
        } catch {
          return null
        }
      }
      if (date instanceof Date) {
        return date.toISOString().slice(0, 10)
      }
      return null
    }

    const originalOfferDate = normalizeDate(original.offerDate)
    const formOfferDate = form.offerDate || ''
    const originalEnquiryDate = normalizeDate(original.enquiryDate)
    const formEnquiryDate = form.enquiryDate || ''

    // Check date fields only if they were manually modified
    if (dateFieldsModified.offerDate && originalOfferDate !== formOfferDate) return true
    if (dateFieldsModified.enquiryDate && originalEnquiryDate !== formEnquiryDate) return true

    // Compare other fields
    const fields = [
      'companyInfo', 'submittedTo', 'attention', 'offerReference', 'enquiryNumber',
      'projectTitle', 'introductionText', 'scopeOfWork', 'priceSchedule',
      'ourViewpoints', 'exclusions', 'paymentTerms', 'deliveryCompletionWarrantyValidity'
    ]

    for (const field of fields) {
      const originalValue = original[field]
      const formValue = form[field]
      
      // Deep comparison using JSON.stringify
      if (JSON.stringify(originalValue ?? null) !== JSON.stringify(formValue ?? null)) {
        return true
      }
    }

    return false
  }

  const formatHistoryValue = (field, value) => {
    // Handle null/undefined
    if (value === null || value === undefined) return '(empty)'
    
    // Handle date strings (from diffFromParent normalization)
    if (['offerDate', 'enquiryDate'].includes(field)) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
      // If it's already a Date object or ISO string
      if (value instanceof Date || (typeof value === 'string' && value.includes('T'))) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
      // If it's a number (timestamp)
      if (typeof value === 'number') {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString()
          }
        } catch {}
      }
    }
    
    // Handle arrays first (before string check, as arrays might be serialized)
    if (Array.isArray(value)) {
      if (value.length === 0) return '(empty)'
      
      if (field === 'paymentTerms') {
        return value.map((t, i) => {
          if (typeof t === 'string') return `${i + 1}. ${t}`
          if (!t || typeof t !== 'object') return `${i + 1}. ${String(t)}`
          return `${i + 1}. ${t?.milestoneDescription || '-'} — ${t?.amountPercent ?? ''}%`
        }).join('\n')
      }
      
      if (field === 'scopeOfWork') {
        return value.map((s, i) => {
          if (typeof s === 'string') return `${i + 1}. ${s}`
          if (!s || typeof s !== 'object') return `${i + 1}. ${String(s)}`
          const qtyUnit = [s?.quantity ?? '', s?.unit || ''].filter(x => String(x).trim().length > 0).join(' ')
          const remarks = s?.locationRemarks ? ` — ${s.locationRemarks}` : ''
          return `${i + 1}. ${s?.description || '-'}${qtyUnit ? ` — Qty: ${qtyUnit}` : ''}${remarks}`
        }).join('\n')
      }
      
      if (field === 'exclusions') {
        return value.map((v, i) => `${i + 1}. ${String(v)}`).join('\n')
      }
      
      // Generic array handling
      return value.map((v, i) => {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          return `${i + 1}. ${String(v)}`
        }
        if (v && typeof v === 'object') {
          const parts = Object.entries(v).map(([k, val]) => `${k}: ${val}`)
          return `${i + 1}. ${parts.join(', ')}`
        }
        return `${i + 1}. ${String(v)}`
      }).join('\n')
    }
    
    // Handle objects (before string check)
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
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
        if (ps?.subTotal !== undefined && ps?.subTotal !== null) lines.push(`Sub Total: ${ps.subTotal}`)
        if (ps?.taxDetails) {
          const rate = ps?.taxDetails?.vatRate ?? ''
          const amt = ps?.taxDetails?.vatAmount ?? ''
          if (rate !== '' || amt !== '') {
            lines.push(`VAT: ${rate}%${amt !== '' ? ` = ${amt}` : ''}`)
          }
        }
        if (ps?.grandTotal !== undefined && ps?.grandTotal !== null) lines.push(`Grand Total: ${ps.grandTotal}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      if (field === 'deliveryCompletionWarrantyValidity') {
        const d = value || {}
        const lines = []
        if (d?.deliveryTimeline) lines.push(`Delivery Timeline: ${d.deliveryTimeline}`)
        if (d?.warrantyPeriod) lines.push(`Warranty Period: ${d.warrantyPeriod}`)
        if (d?.offerValidity !== undefined && d?.offerValidity !== null) lines.push(`Offer Validity: ${d.offerValidity} days`)
        if (d?.authorizedSignatory) lines.push(`Authorized Signatory: ${d.authorizedSignatory}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      if (field === 'companyInfo') {
        const ci = value || {}
        const lines = []
        if (ci?.name) lines.push(`Name: ${ci.name}`)
        if (ci?.address) lines.push(`Address: ${ci.address}`)
        if (ci?.phone) lines.push(`Phone: ${ci.phone}`)
        if (ci?.email) lines.push(`Email: ${ci.email}`)
        return lines.length > 0 ? lines.join('\n') : '(empty)'
      }
      
      // Generic object handling
      const entries = Object.entries(value).map(([k, v]) => {
        if (v === null || v === undefined) return `${k}: (empty)`
        if (typeof v === 'object') {
          try {
            return `${k}: ${JSON.stringify(v, null, 2)}`
          } catch {
            return `${k}: ${String(v)}`
          }
        }
        return `${k}: ${String(v)}`
      })
      return entries.length > 0 ? entries.join('\n') : '(empty)'
    }
    
    // Handle primitive types
    if (typeof value === 'string') {
      // Try to parse JSON string if value looks like JSON
      if ((value.startsWith('{') || value.startsWith('[')) && value.length > 1) {
        try {
          const parsed = JSON.parse(value)
          // Recursively format the parsed value
          return formatHistoryValue(field, parsed)
        } catch {
          // Not valid JSON, return as string
          return value.trim() || '(empty)'
        }
      }
      return value.trim() || '(empty)'
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    
    // Fallback - try to stringify
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value) || '(empty)'
    }
  }

  if (isLoading) {
    return (
      <div className="lead-management" style={{ padding: 24 }}>
        <PageSkeleton showHeader={true} showContent={true} />
      </div>
    )
  }

  if (!variation) return (
    <div className="lead-management" style={{ padding: 24 }}>
      <h2>Variation Details</h2>
      <p>No variation found.</p>
    </div>
  )

  const currency = variation.priceSchedule?.currency || 'AED'
  const approvalStatus = variation.managementApproval?.status

  return (
    <div className="lead-detail">
      <div className="ld-header">
        <div className="ld-title">
          <div className="title-row">
            <h1>Variation {variation.variationNumber} — {variation.projectTitle || variation.lead?.projectTitle || project?.name || 'Variation'}</h1>
          </div>
          <span className="ld-subtitle">Offer Ref: {variation.offerReference || 'N/A'}</span>
        </div>
        <div className="ld-sticky-actions">
          {approvalStatus ? (
            approvalStatus === 'pending' ? (
              <span className="status-pill pending">Approval Pending</span>
            ) : approvalStatus === 'approved' ? (
              <span className="status-pill approved">approved</span>
            ) : approvalStatus === 'rejected' ? (
              <span className="status-pill rejected">rejected</span>
            ) : null
          ) : null}
          <button className="save-btn" onClick={exportPDF}>Export</button>
          {project && (
            <button className="link-btn" onClick={() => {
              try {
                localStorage.setItem('projectId', project._id)
                localStorage.setItem('projectsFocusId', project._id)
              } catch {}
              window.location.href = '/project-detail'
            }}>View Project</button>
          )}
          {variation.lead?._id && (
            <button className="link-btn" onClick={async () => {
              try {
                const leadId = typeof variation.lead === 'object' ? variation.lead._id : variation.lead
                const res = await apiFetch(`/api/leads/${leadId}`)
                const leadData = await res.json()
                const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
                const visits = await visitsRes.json()
                localStorage.setItem('leadDetail', JSON.stringify({ ...leadData, siteVisits: visits }))
                localStorage.setItem('leadId', leadId)
                window.location.href = '/lead-detail'
              } catch { setNotify({ open: true, title: 'Open Lead Failed', message: 'We could not open the linked lead. Please try again.' }) }
            }}>View Lead</button>
          )}
          {(currentUser?.roles?.includes('estimation_engineer') || variation?.createdBy?._id === currentUser?.id) && (
            <button className="assign-btn" onClick={() => {
              if (approvalStatus === 'approved') {
                setEditWarningModal({ open: true })
              } else {
                const originalOfferDate = variation.offerDate ? String(variation.offerDate).slice(0,10) : ''
                const originalEnquiryDate = variation.enquiryDate ? String(variation.enquiryDate).slice(0,10) : ''
                setOriginalDateValues({ offerDate: originalOfferDate, enquiryDate: originalEnquiryDate })
                setDateFieldsModified({ offerDate: false, enquiryDate: false })
                setEditModal({ open: true, form: {
                  companyInfo: variation.companyInfo || {},
                  submittedTo: variation.submittedTo || '',
                  attention: variation.attention || '',
                  offerReference: variation.offerReference || '',
                  enquiryNumber: variation.enquiryNumber || '',
                  offerDate: originalOfferDate,
                  enquiryDate: originalEnquiryDate,
                  projectTitle: variation.projectTitle || variation.lead?.projectTitle || project?.name || '',
                  introductionText: variation.introductionText || '',
                  scopeOfWork: variation.scopeOfWork || [],
                  priceSchedule: variation.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: variation.priceSchedule?.currency || 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
                  ourViewpoints: variation.ourViewpoints || '',
                  exclusions: variation.exclusions || [],
                  paymentTerms: variation.paymentTerms || [],
                  deliveryCompletionWarrantyValidity: variation.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
                } })
              }
            }}>Edit</button>
          )}
          {approvalStatus === 'pending' ? (
            <span className="status-badge blue">Approval Pending</span>
          ) : (
            (approvalStatus !== 'approved' && (currentUser?.roles?.includes('estimation_engineer') || variation?.createdBy?._id === currentUser?.id)) && (
              <button 
                className="save-btn" 
                onClick={() => setSendApprovalConfirmModal({ open: true })}
                disabled={isSubmitting}
              >
                <ButtonLoader loading={loadingAction === 'send-approval'}>
                  Send for Approval
                </ButtonLoader>
              </button>
            )
          )}
          {(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && approvalStatus === 'pending' && (
            <>
              <button 
                className="approve-btn" 
                onClick={() => setApprovalModal({ open: true, action: 'approved', note: '' })}
                disabled={isSubmitting}
              >
                <ButtonLoader loading={loadingAction === 'approve-approved'}>
                  Approve
                </ButtonLoader>
              </button>
              <button 
                className="reject-btn" 
                onClick={() => setApprovalModal({ open: true, action: 'rejected', note: '' })}
                disabled={isSubmitting}
              >
                <ButtonLoader loading={loadingAction === 'approve-rejected'}>
                  Reject
                </ButtonLoader>
              </button>
            </>
          )}
          {approvalStatus === 'approved' && (currentUser?.roles?.includes('estimation_engineer') || variation?.createdBy?._id === currentUser?.id) && (
            <button className="save-btn" onClick={async () => {
              try {
                // Check if a child variation already exists
                const res = await apiFetch(`/api/project-variations?parentVariation=${variation._id}`)
                const childVariations = await res.json()
                if (Array.isArray(childVariations) && childVariations.length > 0) {
                  setNotify({ open: true, title: 'Not Allowed', message: 'A child variation already exists for this variation.' })
                  return
                }
                // Open create variation modal with pre-populated form
                const originalOfferDate = variation.offerDate ? String(variation.offerDate).slice(0,10) : ''
                const originalEnquiryDate = variation.enquiryDate ? String(variation.enquiryDate).slice(0,10) : ''
                setCreateVariationModal({ open: true, form: {
                  companyInfo: variation.companyInfo || {},
                  submittedTo: variation.submittedTo || '',
                  attention: variation.attention || '',
                  offerReference: variation.offerReference || '',
                  enquiryNumber: variation.enquiryNumber || '',
                  offerDate: originalOfferDate,
                  enquiryDate: originalEnquiryDate,
                  projectTitle: variation.projectTitle || variation.lead?.projectTitle || project?.name || '',
                  introductionText: variation.introductionText || '',
                  scopeOfWork: variation.scopeOfWork?.length ? variation.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
                  priceSchedule: variation.priceSchedule || { items: [], subTotal: 0, grandTotal: 0, currency: 'AED', taxDetails: { vatRate: 5, vatAmount: 0 } },
                  ourViewpoints: variation.ourViewpoints || '',
                  exclusions: variation.exclusions?.length ? variation.exclusions : [''],
                  paymentTerms: variation.paymentTerms?.length ? variation.paymentTerms : [{ milestoneDescription: '', amountPercent: ''}],
                  deliveryCompletionWarrantyValidity: variation.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
                } })
              } catch (e) {
                setNotify({ open: true, title: 'Error', message: 'Could not check for existing child variations. Please try again.' })
              }
            }}>Create Another Variation</button>
          )}
        </div>
      </div>

      <div className="ld-grid">
        {project && (
          <div className="ld-card ld-section">
            <h3>Parent Project</h3>
            <div className="ld-kv">
              <p><strong>Project Name:</strong> {project.name || 'N/A'}</p>
              <p><strong>Status:</strong> {project.status || 'N/A'}</p>
            </div>
          </div>
        )}

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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {variation.companyInfo && (variation.companyInfo.name || variation.companyInfo.address || variation.companyInfo.phone || variation.companyInfo.email) && (
          <div className="ld-card ld-section">
            <h3>Company Information</h3>
            <div className="ld-kv">
              {variation.companyInfo.name && <p><strong>Company Name:</strong> {variation.companyInfo.name}</p>}
              {variation.companyInfo.address && <p><strong>Address:</strong> {variation.companyInfo.address}</p>}
              {variation.companyInfo.phone && <p><strong>Phone:</strong> {variation.companyInfo.phone}</p>}
              {variation.companyInfo.email && <p><strong>Email:</strong> {variation.companyInfo.email}</p>}
            </div>
          </div>
        )}

        <div className="ld-card ld-section">
          <h3>Variation Quotation Overview</h3>
          <div className="ld-kv">
            <p><strong>Submitted To:</strong> {variation.submittedTo || 'N/A'}</p>
            <p><strong>Attention:</strong> {variation.attention || 'N/A'}</p>
            <p><strong>Offer Reference:</strong> {variation.offerReference || 'N/A'}</p>
            <p><strong>Offer Date:</strong> {variation.offerDate ? new Date(variation.offerDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry Date:</strong> {variation.enquiryDate ? new Date(variation.enquiryDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Enquiry #:</strong> {variation.enquiryNumber || lead?.enquiryNumber || 'N/A'}</p>
            <p><strong>Project Title:</strong> {variation.projectTitle || lead?.projectTitle || project?.name || 'N/A'}</p>
            <p><strong>Currency:</strong> {currency}</p>
            <p><strong>Sub Total:</strong> {currency} {Number(variation.priceSchedule?.subTotal || 0).toFixed(2)}</p>
            <p><strong>VAT:</strong> {variation.priceSchedule?.taxDetails?.vatRate || 0}% ({currency} {Number(variation.priceSchedule?.taxDetails?.vatAmount || 0).toFixed(2)})</p>
            <p><strong>Grand Total:</strong> {currency} {Number(variation.priceSchedule?.grandTotal || 0).toFixed(2)}</p>
            <p>
              <strong>Created By:</strong> {variation.createdBy?._id === currentUser?.id ? 'You' : (variation.createdBy?.name || 'N/A')}
              {variation.createdBy?._id !== currentUser?.id && variation.createdBy && (
                <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => setProfileUser(variation.createdBy)}>View Profile</button>
              )}
            </p>
          </div>
          {variation.managementApproval?.requestedBy?.name && (
            <p><strong>Approval sent by:</strong> {variation.managementApproval.requestedBy.name} {variation.managementApproval.requestedBy?._id && (
              <button className="link-btn" onClick={() => setProfileUser(variation.managementApproval.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
            )}</p>
          )}
          {variation.managementApproval?.approvedBy?.name && (
            <p><strong>Approved by:</strong> {variation.managementApproval.approvedBy.name} {variation.managementApproval.approvedBy?._id && (
              <button className="link-btn" onClick={() => setProfileUser(variation.managementApproval.approvedBy)} style={{ marginLeft: 6 }}>View Profile</button>
            )}</p>
          )}
        </div>

        {variation.diffFromParent && Array.isArray(variation.diffFromParent) && variation.diffFromParent.length > 0 && (
          <div className="ld-card ld-section">
            <h3>Changes from Parent</h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
              This variation includes the following changes from the parent {variation.parentVariation ? 'variation' : 'project'}:
            </p>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Previous Value</th>
                    <th>New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {variation.diffFromParent.map((diff, idx) => {
                    const fieldNameMap = {
                      'companyInfo': 'Company Info',
                      'submittedTo': 'Submitted To',
                      'attention': 'Attention',
                      'offerReference': 'Offer Reference',
                      'enquiryNumber': 'Enquiry Number',
                      'offerDate': 'Offer Date',
                      'enquiryDate': 'Enquiry Date',
                      'projectTitle': 'Project Title',
                      'introductionText': 'Introduction',
                      'scopeOfWork': 'Scope of Work',
                      'priceSchedule': 'Price Schedule',
                      'ourViewpoints': 'Our Viewpoints',
                      'exclusions': 'Exclusions',
                      'paymentTerms': 'Payment Terms',
                      'deliveryCompletionWarrantyValidity': 'Delivery & Warranty'
                    }
                    const fieldName = fieldNameMap[diff.field] || diff.field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                    
                    // Format the values for display - ensure we're accessing the correct properties
                    const fromVal = diff.from !== undefined ? diff.from : (diff.fromValue !== undefined ? diff.fromValue : null)
                    const toVal = diff.to !== undefined ? diff.to : (diff.toValue !== undefined ? diff.toValue : null)
                    const fromValue = formatHistoryValue(diff.field, fromVal)
                    const toValue = formatHistoryValue(diff.field, toVal)
                    
                    return (
                      <tr key={idx}>
                        <td data-label="Field"><strong>{fieldName}</strong></td>
                        <td data-label="Previous Value">
                          <pre style={{ 
                            margin: 0, 
                            padding: '10px 12px', 
                            background: '#FEF2F2', 
                            border: '1px solid #FECACA', 
                            borderRadius: '6px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            maxHeight: '200px',
                            overflow: 'auto',
                            color: '#991B1B',
                            fontFamily: 'inherit',
                            fontWeight: 400
                          }}>
                            {fromValue || '(empty)'}
                          </pre>
                        </td>
                        <td data-label="New Value">
                          <pre style={{ 
                            margin: 0, 
                            padding: '10px 12px', 
                            background: '#F0FDF4', 
                            border: '1px solid #BBF7D0', 
                            borderRadius: '6px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            maxHeight: '200px',
                            overflow: 'auto',
                            color: '#166534',
                            fontFamily: 'inherit',
                            fontWeight: 400
                          }}>
                            {toValue || '(empty)'}
                          </pre>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {variation.introductionText && (
          <div className="ld-card ld-section">
            <h3>Introduction</h3>
            <div>{variation.introductionText}</div>
          </div>
        )}

        {Array.isArray(variation.scopeOfWork) && variation.scopeOfWork.length > 0 && (
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
                  {variation.scopeOfWork.map((s, i) => (
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

        {Array.isArray(variation.priceSchedule?.items) && variation.priceSchedule.items.length > 0 && (
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
                  {variation.priceSchedule.items.map((it, i) => (
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

        {(variation.ourViewpoints || (variation.exclusions || []).length > 0) && (
          <div className="ld-card ld-section">
            <h3>Our Viewpoints / Special Terms</h3>
            {variation.ourViewpoints && <div style={{ marginBottom: 8 }}>{variation.ourViewpoints}</div>}
            {(variation.exclusions || []).length > 0 && (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Exclusion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(variation.exclusions || []).map((ex, i) => (
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

        {Array.isArray(variation.paymentTerms) && variation.paymentTerms.length > 0 && (
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
                  {variation.paymentTerms.map((p, i) => (
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

        {variation.deliveryCompletionWarrantyValidity && (
          <div className="ld-card ld-section">
            <h3>Delivery, Completion, Warranty & Validity</h3>
            <div className="ld-kv">
              <p><strong>Delivery Timeline:</strong> {variation.deliveryCompletionWarrantyValidity.deliveryTimeline || 'N/A'}</p>
              <p><strong>Warranty Period:</strong> {variation.deliveryCompletionWarrantyValidity.warrantyPeriod || 'N/A'}</p>
              <p><strong>Offer Validity:</strong> {variation.deliveryCompletionWarrantyValidity.offerValidity || 'N/A'} days</p>
              <p><strong>Authorized Signatory:</strong> {variation.deliveryCompletionWarrantyValidity.authorizedSignatory || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {variation.edits?.length > 0 && (
        <div className="ld-card ld-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistory ? '16px' : '0' }}>
            <h3 style={{ margin: 0 }}>Variation Edit History</h3>
            <button className="link-btn" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide Variation Edit History' : 'View Variation Edit History'}
            </button>
          </div>
          {showHistory && (
            <div className="edits-list">
              {variation.edits.slice().reverse().map((edit, idx) => (
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
          )}
        </div>
      )}

      <div className="ld-card ld-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showApprovals ? '16px' : '0' }}>
          <h3 style={{ margin: 0 }}>Approvals & Rejections</h3>
          <button className="link-btn" onClick={() => setShowApprovals(!showApprovals)}>
            {showApprovals ? 'Hide Approvals/Rejections' : 'View Approvals/Rejections'}
          </button>
        </div>
        {showApprovals && (
          <div>
          {(() => {
            const varData = variation
            const rawLogs = Array.isArray(varData.managementApproval?.logs) ? varData.managementApproval.logs.slice().sort((a, b) => {
              const aTime = a.at ? new Date(a.at).getTime() : 0
              const bTime = b.at ? new Date(b.at).getTime() : 0
              return aTime - bTime
            }) : []
            const cycles = []
            let current = null
            for (const entry of rawLogs) {
              if (entry.status === 'pending') {
                if (current) cycles.push(current)
                current = {
                  requestedAt: entry.at || varData.updatedAt || varData.createdAt,
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
                  current.decidedAt = entry.at || varData.managementApproval?.approvedAt || varData.updatedAt || varData.createdAt
                  current.decidedBy = entry.decidedBy
                  current.decisionNote = entry.note
                  current.decisionStatus = entry.status
                  cycles.push(current)
                  current = null
                } else {
                  cycles.push({ requestedAt: null, requestedBy: null, requestNote: null, decidedAt: entry.at || varData.updatedAt || varData.createdAt, decidedBy: entry.decidedBy, decisionNote: entry.note, decisionStatus: entry.status })
                }
              }
            }
            if (current) cycles.push(current)

            if (cycles.length === 0 && (varData.managementApproval?.requestedBy || varData.managementApproval?.approvedBy)) {
              cycles.push({
                requestedAt: varData.updatedAt || varData.createdAt,
                requestedBy: varData.managementApproval?.requestedBy,
                requestNote: varData.managementApproval?.comments,
                decidedAt: varData.managementApproval?.approvedAt,
                decidedBy: varData.managementApproval?.approvedBy,
                decisionNote: varData.managementApproval?.comments,
                decisionStatus: varData.managementApproval?.status
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
                      <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<> by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                        {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                          <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </>)}</div>
                      {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                      <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<> by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
                        {c.decidedBy?._id && c.decidedBy._id !== currentUser?.id && (
                          <button className="link-btn" onClick={() => setProfileUser(c.decidedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </>)} {c.decisionStatus && <span style={{ marginLeft: 6, textTransform: 'uppercase' }}>({c.decisionStatus})</span>}</div>
                      {c.decisionNote && <div><strong>Decision note:</strong> {c.decisionNote}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
          </div>
        )}
      </div>

      {editModal.open && (
        <div className="modal-overlay" onClick={() => setEditModal({ open: false, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Variation</h2>
              <button onClick={() => setEditModal({ open: false, form: null })} className="close-btn">×</button>
            </div>
            {editModal.form && (
              <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                {variation.managementApproval?.status === 'approved' && (
                  <div style={{ padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                      ⚠️ This variation has been approved and cannot be edited. Please close this modal and contact a manager or administrator to revert the approval status if changes are needed.
                    </p>
                  </div>
                )}
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
                      <input 
                        type="date" 
                        value={editModal.form.offerDate} 
                        onChange={e => {
                          setDateFieldsModified(prev => ({ ...prev, offerDate: true }))
                          setEditModal({ ...editModal, form: { ...editModal.form, offerDate: e.target.value } })
                        }} 
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Date</label>
                      <input 
                        type="date" 
                        value={editModal.form.enquiryDate} 
                        onChange={e => {
                          setDateFieldsModified(prev => ({ ...prev, enquiryDate: true }))
                          setEditModal({ ...editModal, form: { ...editModal.form, enquiryDate: e.target.value } })
                        }} 
                      />
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
                  <button 
                    type="button" 
                    className="save-btn" 
                    disabled={variation.managementApproval?.status === 'approved' || isSubmitting}
                    style={variation.managementApproval?.status === 'approved' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    onClick={async () => {
                      if (isSubmitting) return
                      setLoadingAction('save-variation')
                      setIsSubmitting(true)
                      try {
                        // Prevent saving if variation is approved (safety check)
                        if (variation.managementApproval?.status === 'approved') {
                          setNotify({ open: true, title: 'Cannot Edit', message: 'This variation has been approved and cannot be edited. The approval status must be reverted first.' })
                          return
                        }
                        
                        // Block save if date fields haven't been manually modified
                        if (!dateFieldsModified.offerDate && !dateFieldsModified.enquiryDate) {
                          // Check if dates are different from original (automatic change detected)
                          const currentOfferDate = editModal.form.offerDate || ''
                          const currentEnquiryDate = editModal.form.enquiryDate || ''
                          if (currentOfferDate !== originalDateValues.offerDate || currentEnquiryDate !== originalDateValues.enquiryDate) {
                            setNotify({ open: true, title: 'Date Fields Not Modified', message: 'Offer Date and Enquiry Date have not been manually modified. Please explicitly change these dates if you want to update them, or they will remain unchanged.' })
                            return
                          }
                        }
                        
                        // Check if there are any actual changes
                        if (!hasVariationChanges(variation, editModal.form)) {
                          setNotify({ open: true, title: 'No Changes Detected', message: 'No changes have been made to this variation. Please modify the data before saving.' })
                          return
                        }
                        
                        const token = localStorage.getItem('token')
                        // Create payload excluding date fields if they weren't manually modified
                        const payload = { ...editModal.form }
                        if (!dateFieldsModified.offerDate) {
                          delete payload.offerDate
                        }
                        if (!dateFieldsModified.enquiryDate) {
                          delete payload.enquiryDate
                        }
                        
                        const res = await apiFetch(`/api/project-variations/${variation._id}`, {
                          method: 'PUT',
                          body: JSON.stringify(payload)
                        })
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({}))
                          throw new Error(errorData.message || 'Failed to save changes')
                        }
                        const updated = await res.json()
                        if (updated && updated._id) {
                          setVariation(updated)
                          // Reload lead and project if they changed
                          if (updated.lead) {
                            const leadId = typeof updated.lead === 'object' ? updated.lead?._id : updated.lead
                            if (leadId) {
                              try {
                                const resLead = await apiFetch(`/api/leads/${leadId}`)
                                const leadData = await resLead.json()
                                const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
                                const visits = await visitsRes.json()
                                setLead({ ...leadData, siteVisits: visits })
                              } catch {}
                            }
                          }
                          if (updated.parentProject) {
                            const projectId = typeof updated.parentProject === 'object' ? updated.parentProject?._id : updated.parentProject
                            if (projectId) {
                              try {
                                const resProject = await apiFetch(`/api/projects/${projectId}`)
                                const projectData = await resProject.json()
                                setProject(projectData)
                              } catch {}
                            }
                          }
                        }
                        setEditModal({ open: false, form: null })
                        setDateFieldsModified({ offerDate: false, enquiryDate: false })
                        setOriginalDateValues({ offerDate: null, enquiryDate: null })
                        setNotify({ open: true, title: 'Changes Saved', message: 'Your changes have been saved successfully.' })
                      } catch (e) {
                        setNotify({ open: true, title: 'Save Failed', message: e.message || 'We could not save your changes. Please try again.' })
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {createVariationModal.open && createVariationModal.form && (
        <div className="modal-overlay" onClick={() => setCreateVariationModal({ open: false, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Another Variation</h2>
              <button onClick={() => setCreateVariationModal({ open: false, form: null })} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <div className="form-section">
                <div className="section-header">
                  <h3>Cover & Basic Details</h3>
                </div>
                <div className="form-group">
                  <label>Submitted To (Client Company)</label>
                  <input type="text" value={createVariationModal.form.submittedTo} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, submittedTo: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Attention (Contact Person)</label>
                  <input type="text" value={createVariationModal.form.attention} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, attention: e.target.value } })} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Reference</label>
                    <input type="text" value={createVariationModal.form.offerReference} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, offerReference: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Number</label>
                    <input type="text" value={createVariationModal.form.enquiryNumber} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, enquiryNumber: e.target.value } })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Date</label>
                    <input type="date" value={createVariationModal.form.offerDate} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, offerDate: e.target.value } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Enquiry Date</label>
                    <input type="date" value={createVariationModal.form.enquiryDate} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, enquiryDate: e.target.value } })} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Project Details</h3>
                </div>
                <div className="form-group">
                  <label>Project Title</label>
                  <input type="text" value={createVariationModal.form.projectTitle} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, projectTitle: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Introduction</label>
                  <textarea value={createVariationModal.form.introductionText} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, introductionText: e.target.value } })} />
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Scope of Work</h3>
                </div>
                {createVariationModal.form.scopeOfWork.map((s, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: createVariationModal.form.scopeOfWork.filter((_, idx) => idx !== i) } })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Description</label>
                        <textarea value={s.description} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: createVariationModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) } })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Qty</label>
                        <input type="number" value={s.quantity} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: createVariationModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) } })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit</label>
                        <input type="text" value={s.unit} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: createVariationModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) } })} />
                      </div>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Location/Remarks</label>
                        <input type="text" value={s.locationRemarks} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: createVariationModal.form.scopeOfWork.map((x, idx) => idx === i ? { ...x, locationRemarks: e.target.value } : x) } })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, scopeOfWork: [...createVariationModal.form.scopeOfWork, { description: '', quantity: '', unit: '', locationRemarks: '' }] } })}>+ Add Scope Item</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Price Schedule</h3>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Currency</label>
                    <input type="text" value={createVariationModal.form.priceSchedule.currency} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, currency: e.target.value } } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>VAT %</label>
                    <input type="number" value={createVariationModal.form.priceSchedule.taxDetails.vatRate} onChange={e => {
                      const items = createVariationModal.form.priceSchedule.items
                      const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                      const vat = sub * (Number(e.target.value || 0) / 100)
                      const grand = sub + vat
                      setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...createVariationModal.form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: Number(vat.toFixed(2)) } } } })
                    }} />
                  </div>
                </div>
                {createVariationModal.form.priceSchedule.items.map((it, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => {
                        const items = createVariationModal.form.priceSchedule.items.filter((_, idx) => idx !== i)
                        const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                        const vat = sub * (Number(createVariationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                        const grand = sub + vat
                        setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...createVariationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                      }}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Description</label>
                        <input type="text" value={it.description} onChange={e => {
                          const items = createVariationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x)
                          setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Qty</label>
                        <input type="number" value={it.quantity} onChange={e => {
                          const items = createVariationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value, totalAmount: Number((Number(e.target.value || 0) * Number(x.unitRate || 0)).toFixed(2)) } : x)
                          const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                          const vat = sub * (Number(createVariationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...createVariationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit</label>
                        <input type="text" value={it.unit} onChange={e => {
                          const items = createVariationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x)
                          setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items } } })
                        }} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unit Rate</label>
                        <input type="number" value={it.unitRate} onChange={e => {
                          const items = createVariationModal.form.priceSchedule.items.map((x, idx) => idx === i ? { ...x, unitRate: e.target.value, totalAmount: Number((Number(x.quantity || 0) * Number(e.target.value || 0)).toFixed(2)) } : x)
                          const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
                          const vat = sub * (Number(createVariationModal.form.priceSchedule.taxDetails.vatRate || 0) / 100)
                          const grand = sub + vat
                          setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items, subTotal: Number(sub.toFixed(2)), grandTotal: Number(grand.toFixed(2)), taxDetails: { ...createVariationModal.form.priceSchedule.taxDetails, vatAmount: Number(vat.toFixed(2)) } } } })
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
                  <button type="button" className="link-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, priceSchedule: { ...createVariationModal.form.priceSchedule, items: [...createVariationModal.form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } } })}>+ Add Item</button>
                </div>

                <div className="totals-card">
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Sub Total</label>
                      <input type="number" readOnly value={Number(createVariationModal.form.priceSchedule.subTotal || 0)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>VAT Amount</label>
                      <input type="number" readOnly value={Number(createVariationModal.form.priceSchedule.taxDetails.vatAmount || 0)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Grand Total</label>
                      <input type="number" readOnly value={Number(createVariationModal.form.priceSchedule.grandTotal || 0)} />
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
                  <textarea value={createVariationModal.form.ourViewpoints} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, ourViewpoints: e.target.value } })} />
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Exclusions</h3>
                </div>
                {createVariationModal.form.exclusions.map((ex, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Item {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, exclusions: createVariationModal.form.exclusions.filter((_, idx) => idx !== i) } })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <input type="text" value={ex} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, exclusions: createVariationModal.form.exclusions.map((x, idx) => idx === i ? e.target.value : x) } })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, exclusions: [...createVariationModal.form.exclusions, ''] } })}>+ Add Exclusion</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Payment Terms</h3>
                </div>
                {createVariationModal.form.paymentTerms.map((p, i) => (
                  <div key={i} className="item-card">
                    <div className="item-header">
                      <span>Term {i + 1}</span>
                      <button type="button" className="cancel-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, paymentTerms: createVariationModal.form.paymentTerms.filter((_, idx) => idx !== i) } })}>Remove</button>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 3 }}>
                        <label>Milestone</label>
                        <input type="text" value={p.milestoneDescription} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, paymentTerms: createVariationModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) } })} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Amount %</label>
                        <input type="number" value={p.amountPercent} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, paymentTerms: createVariationModal.form.paymentTerms.map((x, idx) => idx === i ? { ...x, amountPercent: e.target.value } : x) } })} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="section-actions">
                  <button type="button" className="link-btn" onClick={() => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, paymentTerms: [...createVariationModal.form.paymentTerms, { milestoneDescription: '', amountPercent: '' }] } })}>+ Add Payment Term</button>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Delivery, Completion, Warranty & Validity</h3>
                </div>
                <div className="form-group">
                  <label>Delivery / Completion Timeline</label>
                  <input type="text" value={createVariationModal.form.deliveryCompletionWarrantyValidity.deliveryTimeline} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, deliveryCompletionWarrantyValidity: { ...createVariationModal.form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } } })} />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Warranty Period</label>
                    <input type="text" value={createVariationModal.form.deliveryCompletionWarrantyValidity.warrantyPeriod} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, deliveryCompletionWarrantyValidity: { ...createVariationModal.form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } } })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Offer Validity (Days)</label>
                    <input type="number" value={createVariationModal.form.deliveryCompletionWarrantyValidity.offerValidity} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, deliveryCompletionWarrantyValidity: { ...createVariationModal.form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } } })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Authorized Signatory</label>
                  <input type="text" value={createVariationModal.form.deliveryCompletionWarrantyValidity.authorizedSignatory} onChange={e => setCreateVariationModal({ ...createVariationModal, form: { ...createVariationModal.form, deliveryCompletionWarrantyValidity: { ...createVariationModal.form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } } })} />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setCreateVariationModal({ open: false, form: null })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    if (isSubmitting) return
                    setLoadingAction('create-variation')
                    setIsSubmitting(true)
                    try {
                      // Check if there are changes from the parent variation
                      const fields = ['companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity']
                      let changed = false
                      for (const f of fields) {
                        if (JSON.stringify(variation?.[f] ?? null) !== JSON.stringify(createVariationModal.form?.[f] ?? null)) { changed = true; break }
                      }
                      if (!changed) {
                        setNotify({ open: true, title: 'No Changes', message: 'No changes detected. Please modify data before creating a variation.' })
                        return
                      }
                      
                      const res = await apiFetch('/api/project-variations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parentVariationId: variation._id, data: createVariationModal.form })
                      })
                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}))
                        throw new Error(errorData.message || 'Failed to create variation')
                      }
                      const newVariation = await res.json()
                      setCreateVariationModal({ open: false, form: null })
                      setNotify({ open: true, title: 'Variation Created', message: 'The new variation has been created successfully.' })
                      // Navigate to the new variation
                      try {
                        localStorage.setItem('variationId', newVariation._id)
                        window.location.href = '/variation-detail'
                      } catch {}
                    } catch (e) {
                      setNotify({ open: true, title: 'Creation Failed', message: e.message || 'We could not create the variation. Please try again.' })
                    } finally {
                      setIsSubmitting(false)
                      setLoadingAction(null)
                    }
                  }}
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

      {approvalModal.open && (
        <div className="modal-overlay" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{approvalModal.action === 'approved' ? 'Approve Variation' : 'Reject Variation'}</h2>
              <button onClick={() => setApprovalModal({ open: false, action: null, note: '' })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div className="form-group">
                <label>Note</label>
                <textarea value={approvalModal.note} onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setApprovalModal({ open: false, action: null, note: '' })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={() => approveVariation(approvalModal.action, approvalModal.note)}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={isSubmitting}>
                    {isSubmitting ? (approvalModal.action === 'approved' ? 'Approving...' : 'Rejecting...') : 'Confirm'}
                  </ButtonLoader>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editWarningModal.open && (
        <div className="modal-overlay" onClick={() => setEditWarningModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cannot Edit Approved Variation</h2>
              <button onClick={() => setEditWarningModal({ open: false })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <div style={{ padding: '16px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, color: '#7C2D12', fontWeight: 500 }}>
                  ⚠️ This variation has been approved and is locked to prevent modifications.
                </p>
              </div>
              <p style={{ marginBottom: '16px' }}>
                Approved variations cannot be edited to maintain data integrity and ensure consistency with approved quotations.
              </p>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                To make changes to this variation, the approval status must first be reverted. A manager or administrator can reject the variation, which will unlock it for editing.
              </p>
              <div className="form-actions">
                <button type="button" className="save-btn" onClick={() => setEditWarningModal({ open: false })}>Understood</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendApprovalConfirmModal.open && (
        <div className="modal-overlay" onClick={() => setSendApprovalConfirmModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send for Approval</h2>
              <button onClick={() => setSendApprovalConfirmModal({ open: false })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to send this variation for management approval?
              </p>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Once sent, the variation will be marked as "Pending Approval" and managers or administrators will be able to review and approve or reject it.
              </p>
              {variation && (
                <div style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Variation #{variation.variationNumber}</p>
                  {variation.projectTitle && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{variation.projectTitle}</p>
                  )}
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setSendApprovalConfirmModal({ open: false })}>Cancel</button>
                <button 
                  type="button" 
                  className="save-btn" 
                  onClick={async () => {
                    await sendForApproval()
                  }}
                  disabled={isSubmitting}
                >
                  <ButtonLoader loading={loadingAction === 'send-approval'}>
                    {isSubmitting ? 'Sending...' : 'Confirm'}
                  </ButtonLoader>
                </button>
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

export default VariationDetail

