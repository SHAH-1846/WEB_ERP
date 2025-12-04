import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { FormField, FormRow, FormSection } from '../design-system/FormField'
import { Modal } from '../design-system/Modal'
import '../design-system/FormField.css'
import '../design-system/Modal.css'
import './LeadManagement.css'
import logo from '../assets/logo/WBES_Logo.png'

function QuotationFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { leadId, quotationId } = useParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [leads, setLeads] = useState([])
  const [editing, setEditing] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [isSaving, setIsSaving] = useState(false)

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
    if (quotationId) {
      void fetchQuotation()
    }
  }, [quotationId])

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads')
      setLeads(res.data)
    } catch {}
  }

  const fetchQuotation = async () => {
    try {
      const res = await api.get(`/api/quotations/${quotationId}`)
      setEditing(res.data)
    } catch {}
  }

  useEffect(() => {
    if (editing) {
      // Populate form with editing quotation data
      setForm({
        lead: editing.lead?._id || editing.lead || '',
        companyInfo: editing.companyInfo || defaultCompany,
        submittedTo: editing.submittedTo || '',
        attention: editing.attention || '',
        offerReference: editing.offerReference || '',
        enquiryNumber: editing.enquiryNumber || '',
        offerDate: editing.offerDate ? editing.offerDate.substring(0, 10) : '',
        enquiryDate: editing.enquiryDate ? editing.enquiryDate.substring(0, 10) : '',
        projectTitle: editing.projectTitle || editing.lead?.projectTitle || '',
        introductionText: editing.introductionText || '',
        scopeOfWork: editing.scopeOfWork?.length ? editing.scopeOfWork : [{ description: '', quantity: '', unit: '', locationRemarks: '' }],
        priceSchedule: editing.priceSchedule || {
          items: [{ description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }],
          subTotal: 0,
          grandTotal: 0,
          currency: 'AED',
          taxDetails: { vatRate: 5, vatAmount: 0 }
        },
        ourViewpoints: editing.ourViewpoints || '',
        exclusions: editing.exclusions?.length ? editing.exclusions : [''],
        paymentTerms: editing.paymentTerms?.length ? editing.paymentTerms : [{ milestoneDescription: '', amountPercent: '' }],
        deliveryCompletionWarrantyValidity: editing.deliveryCompletionWarrantyValidity || {
          deliveryTimeline: '',
          warrantyPeriod: '',
          offerValidity: 30,
          authorizedSignatory: currentUser?.name || ''
        }
      })
    } else {
      // Reset form for new quotation
      setForm({
        lead: '',
        companyInfo: defaultCompany,
        submittedTo: '',
        attention: '',
        offerReference: '',
        enquiryNumber: '',
        offerDate: new Date().toISOString().slice(0, 10),
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
          authorizedSignatory: currentUser?.name || ''
        }
      })
    }
  }, [editing, defaultCompany, currentUser])

  useEffect(() => {
    // Pre-populate form with lead data if leadId is provided
    if (leadId && leads.length > 0 && currentUser && !editing) {
      const selectedLead = leads.find(l => l._id === leadId)
      if (selectedLead) {
        setForm(prev => ({
          ...prev,
          lead: selectedLead._id,
          offerDate: new Date().toISOString().slice(0, 10),
          enquiryDate: selectedLead.enquiryDate ? selectedLead.enquiryDate.substring(0, 10) : '',
          projectTitle: selectedLead.projectTitle || '',
          enquiryNumber: selectedLead.enquiryNumber || '',
          deliveryCompletionWarrantyValidity: {
            ...prev.deliveryCompletionWarrantyValidity,
            authorizedSignatory: currentUser?.name || ''
          }
        }))
      }
    }
  }, [leadId, leads, currentUser, editing])

  const recalcTotals = (items, vatRate) => {
    const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
    const vat = sub * (Number(vatRate || 0) / 100)
    const grand = sub + vat
    return { subTotal: Number(sub.toFixed(2)), vatAmount: Number(vat.toFixed(2)), grandTotal: Number(grand.toFixed(2)) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = { ...form }
      const totals = recalcTotals(payload.priceSchedule.items, payload.priceSchedule.taxDetails.vatRate)
      payload.priceSchedule.subTotal = totals.subTotal
      payload.priceSchedule.taxDetails.vatAmount = totals.vatAmount
      payload.priceSchedule.grandTotal = totals.grandTotal
      
      if (editing) {
        await api.put(`/api/quotations/${editing._id}`, payload)
        setNotify({ open: true, title: 'Success', message: 'Quotation updated successfully.' })
      } else {
        await api.post('/api/quotations', payload)
        setNotify({ open: true, title: 'Success', message: 'Quotation created successfully.' })
      }
      
      // Navigate back after a short delay
      setTimeout(() => {
        if (location.pathname.includes('/quotations/')) {
          navigate('/quotations')
        } else {
          navigate('/leads')
        }
      }, 1500)
    } catch (err) {
      setNotify({ open: true, title: 'Save Failed', message: err.response?.data?.message || 'We could not save this quotation. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const onChangeItem = (idx, field, value) => {
    const items = form.priceSchedule.items.map((it, i) => 
      i === idx 
        ? { ...it, [field]: value, totalAmount: Number((Number(field === 'quantity' ? value : it.quantity || 0) * Number(field === 'unitRate' ? value : it.unitRate || 0)).toFixed(2)) } 
        : it
    )
    const totals = recalcTotals(items, form.priceSchedule.taxDetails.vatRate)
    setForm({ 
      ...form, 
      priceSchedule: { 
        ...form.priceSchedule, 
        items, 
        subTotal: totals.subTotal, 
        grandTotal: totals.grandTotal, 
        taxDetails: { ...form.priceSchedule.taxDetails, vatAmount: totals.vatAmount } 
      } 
    })
  }

  const handleCancel = () => {
    if (location.pathname.includes('/quotations/')) {
      navigate('/quotations')
    } else {
      navigate('/leads')
    }
  }

  // Determine source based on the route
  const source = location.pathname.includes('/quotations/') ? 'quotations' : 'leads'

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--bg)', 
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border)'
        }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            color: 'var(--text)',
            margin: 0
          }}>
            {editing ? 'Edit Quotation' : 'Create Quotation'}
          </h1>
          <button
            type="button"
            onClick={handleCancel}
            className="cancel-btn"
            style={{ padding: '8px 16px' }}
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSave}>
          <FormField label="Select Lead" required>
            <select 
              value={form.lead} 
              onChange={e => setForm({ ...form, lead: e.target.value })} 
              required
            >
              <option value="">-- Choose Lead --</option>
              {leads.map(l => (
                <option value={l._id} key={l._id}>
                  {l.projectTitle || l.name} — {l.customerName}
                </option>
              ))}
            </select>
          </FormField>

          <FormSection title="Cover & Basic Details">
            <FormField label="Submitted To (Client Company)">
              <input 
                type="text" 
                value={form.submittedTo} 
                onChange={e => setForm({ ...form, submittedTo: e.target.value })} 
              />
            </FormField>
            <FormField label="Attention (Contact Person)">
              <input 
                type="text" 
                value={form.attention} 
                onChange={e => setForm({ ...form, attention: e.target.value })} 
              />
            </FormField>
            <FormRow>
              <FormField label="Offer Reference">
                <input 
                  type="text" 
                  value={form.offerReference} 
                  onChange={e => setForm({ ...form, offerReference: e.target.value })} 
                />
              </FormField>
              <FormField label="Enquiry Number">
                <input 
                  type="text" 
                  value={form.enquiryNumber} 
                  onChange={e => setForm({ ...form, enquiryNumber: e.target.value })} 
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Offer Date">
                <input 
                  type="date" 
                  value={form.offerDate} 
                  onChange={e => setForm({ ...form, offerDate: e.target.value })} 
                />
              </FormField>
              <FormField label="Enquiry Date">
                <input 
                  type="date" 
                  value={form.enquiryDate} 
                  onChange={e => setForm({ ...form, enquiryDate: e.target.value })} 
                />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Project Details">
            <FormField label="Project Title">
              <input 
                type="text" 
                value={form.projectTitle} 
                onChange={e => setForm({ ...form, projectTitle: e.target.value })} 
              />
            </FormField>
            <FormField label="Introduction">
              <textarea 
                value={form.introductionText} 
                onChange={e => setForm({ ...form, introductionText: e.target.value })} 
              />
            </FormField>
          </FormSection>

          <FormSection title="Scope of Work">
            {form.scopeOfWork.map((s, i) => (
              <div key={i} className="item-card">
                <div className="item-header">
                  <span>Item {i + 1}</span>
                  <button 
                    type="button" 
                    className="cancel-btn" 
                    onClick={() => setForm({ ...form, scopeOfWork: form.scopeOfWork.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <FormRow>
                  <FormField label="Description" className="flex-3">
                    <textarea 
                      value={s.description} 
                      onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) })} 
                    />
                  </FormField>
                  <FormField label="Qty" className="flex-1">
                    <input 
                      type="number" 
                      value={s.quantity} 
                      onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) })} 
                    />
                  </FormField>
                  <FormField label="Unit" className="flex-1">
                    <input 
                      type="text" 
                      value={s.unit} 
                      onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) })} 
                    />
                  </FormField>
                  <FormField label="Location/Remarks" className="flex-2">
                    <input 
                      type="text" 
                      value={s.locationRemarks} 
                      onChange={e => setForm({ ...form, scopeOfWork: form.scopeOfWork.map((x, idx) => idx === i ? { ...x, locationRemarks: e.target.value } : x) })} 
                    />
                  </FormField>
                </FormRow>
              </div>
            ))}
            <div className="section-actions">
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => setForm({ ...form, scopeOfWork: [...form.scopeOfWork, { description: '', quantity: '', unit: '', locationRemarks: '' }] })}
              >
                + Add Scope Item
              </button>
            </div>
          </FormSection>

          <FormSection title="Price Schedule">
            <FormRow>
              <FormField label="Currency">
                <input 
                  type="text" 
                  value={form.priceSchedule.currency} 
                  onChange={e => setForm({ ...form, priceSchedule: { ...form.priceSchedule, currency: e.target.value } })} 
                />
              </FormField>
              <FormField label="VAT %">
                <input 
                  type="number" 
                  value={form.priceSchedule.taxDetails.vatRate} 
                  onChange={e => {
                    const totals = recalcTotals(form.priceSchedule.items, e.target.value)
                    setForm({ 
                      ...form, 
                      priceSchedule: { 
                        ...form.priceSchedule, 
                        subTotal: totals.subTotal, 
                        grandTotal: totals.grandTotal, 
                        taxDetails: { ...form.priceSchedule.taxDetails, vatRate: e.target.value, vatAmount: totals.vatAmount } 
                      } 
                    })
                  }} 
                />
              </FormField>
            </FormRow>
            {form.priceSchedule.items.map((it, i) => (
              <div key={i} className="item-card">
                <div className="item-header">
                  <span>Item {i + 1}</span>
                  <button 
                    type="button" 
                    className="cancel-btn" 
                    onClick={() => {
                      const items = form.priceSchedule.items.filter((_, idx) => idx !== i)
                      const totals = recalcTotals(items, form.priceSchedule.taxDetails.vatRate)
                      setForm({ 
                        ...form, 
                        priceSchedule: { 
                          ...form.priceSchedule, 
                          items, 
                          subTotal: totals.subTotal, 
                          grandTotal: totals.grandTotal, 
                          taxDetails: { ...form.priceSchedule.taxDetails, vatAmount: totals.vatAmount } 
                        } 
                      })
                    }}
                  >
                    Remove
                  </button>
                </div>
                <FormRow>
                  <FormField label="Description" className="flex-3">
                    <input 
                      type="text" 
                      value={it.description} 
                      onChange={e => onChangeItem(i, 'description', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Qty" className="flex-1">
                    <input 
                      type="number" 
                      value={it.quantity} 
                      onChange={e => onChangeItem(i, 'quantity', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Unit" className="flex-1">
                    <input 
                      type="text" 
                      value={it.unit} 
                      onChange={e => onChangeItem(i, 'unit', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Unit Rate" className="flex-1">
                    <input 
                      type="number" 
                      value={it.unitRate} 
                      onChange={e => onChangeItem(i, 'unitRate', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Amount" className="flex-1">
                    <input 
                      type="number" 
                      value={Number(it.totalAmount || 0)} 
                      readOnly 
                    />
                  </FormField>
                </FormRow>
              </div>
            ))}
            <div className="section-actions">
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => setForm({ ...form, priceSchedule: { ...form.priceSchedule, items: [...form.priceSchedule.items, { description: '', quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }] } })}
              >
                + Add Item
              </button>
            </div>

            <div className="totals-card">
              <FormRow>
                <FormField label="Sub Total">
                  <input 
                    type="number" 
                    readOnly 
                    value={Number(form.priceSchedule.subTotal || 0)} 
                  />
                </FormField>
                <FormField label="VAT Amount">
                  <input 
                    type="number" 
                    readOnly 
                    value={Number(form.priceSchedule.taxDetails.vatAmount || 0)} 
                  />
                </FormField>
                <FormField label="Grand Total">
                  <input 
                    type="number" 
                    readOnly 
                    value={Number(form.priceSchedule.grandTotal || 0)} 
                  />
                </FormField>
              </FormRow>
            </div>
          </FormSection>

          <FormSection title="Our Viewpoints / Special Terms">
            <FormField label="Our Viewpoints / Special Terms">
              <textarea 
                value={form.ourViewpoints} 
                onChange={e => setForm({ ...form, ourViewpoints: e.target.value })} 
              />
            </FormField>
          </FormSection>

          <FormSection title="Exclusions">
            {form.exclusions.map((ex, i) => (
              <div key={i} className="item-card">
                <div className="item-header">
                  <span>Item {i + 1}</span>
                  <button 
                    type="button" 
                    className="cancel-btn" 
                    onClick={() => setForm({ ...form, exclusions: form.exclusions.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <FormField>
                  <input 
                    type="text" 
                    value={ex} 
                    onChange={e => setForm({ ...form, exclusions: form.exclusions.map((x, idx) => idx === i ? e.target.value : x) })} 
                  />
                </FormField>
              </div>
            ))}
            <div className="section-actions">
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => setForm({ ...form, exclusions: [...form.exclusions, ''] })}
              >
                + Add Exclusion
              </button>
            </div>
          </FormSection>

          <FormSection title="Payment Terms">
            {form.paymentTerms.map((p, i) => (
              <div key={i} className="item-card">
                <div className="item-header">
                  <span>Term {i + 1}</span>
                  <button 
                    type="button" 
                    className="cancel-btn" 
                    onClick={() => setForm({ ...form, paymentTerms: form.paymentTerms.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <FormRow>
                  <FormField label="Milestone" className="flex-3">
                    <input 
                      type="text" 
                      value={p.milestoneDescription} 
                      onChange={e => setForm({ ...form, paymentTerms: form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) })} 
                    />
                  </FormField>
                  <FormField label="Amount %" className="flex-1">
                    <input 
                      type="number" 
                      value={p.amountPercent} 
                      onChange={e => setForm({ ...form, paymentTerms: form.paymentTerms.map((x, idx) => idx === i ? { ...x, amountPercent: e.target.value } : x) })} 
                    />
                  </FormField>
                </FormRow>
              </div>
            ))}
            <div className="section-actions">
              <button 
                type="button" 
                className="link-btn" 
                onClick={() => setForm({ ...form, paymentTerms: [...form.paymentTerms, { milestoneDescription: '', amountPercent: '' }] })}
              >
                + Add Payment Term
              </button>
            </div>
          </FormSection>

          <FormSection title="Delivery, Completion, Warranty & Validity">
            <FormField label="Delivery / Completion Timeline">
              <input 
                type="text" 
                value={form.deliveryCompletionWarrantyValidity.deliveryTimeline} 
                onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } })} 
              />
            </FormField>
            <FormRow>
              <FormField label="Warranty Period">
                <input 
                  type="text" 
                  value={form.deliveryCompletionWarrantyValidity.warrantyPeriod} 
                  onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } })} 
                />
              </FormField>
              <FormField label="Offer Validity (Days)">
                <input 
                  type="number" 
                  value={form.deliveryCompletionWarrantyValidity.offerValidity} 
                  onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } })} 
                />
              </FormField>
            </FormRow>
            <FormField label="Authorized Signatory">
              <input 
                type="text" 
                value={form.deliveryCompletionWarrantyValidity.authorizedSignatory} 
                onChange={e => setForm({ ...form, deliveryCompletionWarrantyValidity: { ...form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } })} 
              />
            </FormField>
          </FormSection>

          <div className="form-actions">
            <button type="button" onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Quotation')}
            </button>
          </div>
        </form>
      </div>

      {notify.open && (
        <Modal
          isOpen={notify.open}
          onClose={() => setNotify({ open: false, title: '', message: '' })}
          title={notify.title || 'Notice'}
          size="small"
        >
          <p>{notify.message}</p>
          <div className="form-actions">
            <button 
              type="button" 
              className="save-btn" 
              onClick={() => setNotify({ open: false, title: '', message: '' })}
            >
              OK
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default QuotationFormPage

