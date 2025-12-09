import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../lib/api'
import { Modal } from '../design-system/Modal'
import { FormField, FormRow, FormSection } from '../design-system/FormField'
import '../design-system/Modal.css'
import '../design-system/FormField.css'
import logo from '../assets/logo/WBES_Logo.png'

// Google Docs-style Rich Text Editor using contentEditable (compatible with React 19)
function ScopeOfWorkEditor({ value, onChange }) {
  const editorRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [fontSize, setFontSize] = useState('14')
  const [customFontSize, setCustomFontSize] = useState('')
  const [fontFamily, setFontFamily] = useState('Arial')
  const [textColor, setTextColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('#ffff00')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML
      const newValue = value || ''
      if (currentHtml !== newValue) {
        editorRef.current.innerHTML = newValue
      }
    }
  }, [value])

  const handleInput = (e) => {
    const html = e.target.innerHTML
    onChange(html)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const handleUndo = () => {
    document.execCommand('undo', false, null)
    editorRef.current?.focus()
  }

  const handleRedo = () => {
    document.execCommand('redo', false, null)
    editorRef.current?.focus()
  }

  const applyFontSize = (size) => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontSize = `${size}px`
      try {
        range.surroundContents(span)
      } catch (e) {
        // If surroundContents fails, try a different approach
        const contents = range.extractContents()
        span.appendChild(contents)
        range.insertNode(span)
      }
    }
    editorRef.current?.focus()
  }

  const handleFontSizeChange = (e) => {
    const size = e.target.value
    setFontSize(size)
    setCustomFontSize('')
    applyFontSize(size)
  }

  const handleCustomFontSizeChange = (e) => {
    const value = e.target.value
    setCustomFontSize(value)
    if (value && !isNaN(value) && value > 0) {
      applyFontSize(value)
    }
  }

  const handleCustomFontSizeKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (customFontSize && !isNaN(customFontSize) && customFontSize > 0) {
        setFontSize(customFontSize)
        applyFontSize(customFontSize)
      }
    }
  }

  const handleFontFamilyChange = (e) => {
    const family = e.target.value
    setFontFamily(family)
    document.execCommand('fontName', false, family)
    editorRef.current?.focus()
  }

  const handleTextColorChange = (e) => {
    const color = e.target.value
    setTextColor(color)
    document.execCommand('foreColor', false, color)
    editorRef.current?.focus()
  }

  const handleHighlightColorChange = (e) => {
    const color = e.target.value
    setHighlightColor(color)
    document.execCommand('backColor', false, color)
    editorRef.current?.focus()
  }

  const handleFormatBlock = (e) => {
    const format = e.target.value
    if (format === 'p') {
      document.execCommand('formatBlock', false, '<p>')
    } else {
      document.execCommand('formatBlock', false, `<${format}>`)
    }
    editorRef.current?.focus()
  }

  const handleInsertLink = () => {
    setShowLinkModal(true)
    setLinkUrl('')
  }

  const handleLinkModalSave = () => {
    if (linkUrl && linkUrl.trim()) {
      const url = linkUrl.trim()
      // Ensure URL has protocol
      const finalUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
      document.execCommand('createLink', false, finalUrl)
    }
    setShowLinkModal(false)
    setLinkUrl('')
    editorRef.current?.focus()
  }

  const handleLinkModalCancel = () => {
    setShowLinkModal(false)
    setLinkUrl('')
    editorRef.current?.focus()
  }

  const handleListStyleChange = (listType, style) => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const listElement = range.commonAncestorContainer.nodeType === 1 
        ? range.commonAncestorContainer.closest('ul, ol')
        : range.commonAncestorContainer.parentElement?.closest('ul, ol')
      
      if (listElement) {
        listElement.style.listStyleType = style
      } else {
        // Create new list with style
        if (listType === 'ul') {
          document.execCommand('insertUnorderedList', false, null)
          setTimeout(() => {
            const newList = editorRef.current?.querySelector('ul:last-of-type')
            if (newList) {
              newList.style.listStyleType = style
            }
          }, 10)
        } else {
          document.execCommand('insertOrderedList', false, null)
          setTimeout(() => {
            const newList = editorRef.current?.querySelector('ol:last-of-type')
            if (newList) {
              newList.style.listStyleType = style
            }
          }, 10)
        }
      }
    }
    editorRef.current?.focus()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input)', width: '100%', minWidth: '100%' }}>
      {/* Toolbar - Row 1: Undo/Redo and Format */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        padding: '8px', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexWrap: 'wrap',
        alignItems: 'center',
        width: '100%'
      }}>
        {/* Undo/Redo */}
        <button type="button" onClick={handleUndo} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Undo">
          ↶
        </button>
        <button type="button" onClick={handleRedo} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Redo">
          ↷
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        {/* Font Style Dropdown */}
        <select 
          onChange={handleFormatBlock}
          style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontSize: '12px', width: '120px', minWidth: '120px', maxWidth: '120px' }}
          title="Format"
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        
        {/* Font Family */}
        <select 
          value={fontFamily}
          onChange={handleFontFamilyChange}
          style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontSize: '12px', width: '140px', minWidth: '140px', maxWidth: '140px' }}
          title="Font Family"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
        </select>
        
        {/* Font Size */}
        <select 
          value={fontSize}
          onChange={handleFontSizeChange}
          style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontSize: '12px', width: '60px' }}
          title="Font Size"
        >
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="36">36</option>
          <option value="48">48</option>
          <option value="72">72</option>
        </select>
        <input
          type="number"
          value={customFontSize}
          onChange={handleCustomFontSizeChange}
          onKeyPress={handleCustomFontSizeKeyPress}
          placeholder="Custom"
          min="1"
          max="200"
          style={{ 
            padding: '4px 6px', 
            border: '1px solid var(--border)', 
            borderRadius: '4px', 
            background: 'var(--input)', 
            fontSize: '12px', 
            width: '60px',
            marginLeft: '4px'
          }}
          title="Custom Font Size (press Enter to apply)"
        />
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        {/* Text Formatting */}
        <button type="button" onClick={() => execCommand('bold')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontWeight: 'bold' }} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => execCommand('italic')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontStyle: 'italic' }} title="Italic">
          <em>I</em>
        </button>
        <button type="button" onClick={() => execCommand('underline')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', textDecoration: 'underline' }} title="Underline">
          <u>U</u>
        </button>
        
        {/* Text Color */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <input
            type="color"
            value={textColor}
            onChange={handleTextColorChange}
            style={{ width: '32px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
            title="Text Color"
          />
        </div>
        
        {/* Highlight Color */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <input
            type="color"
            value={highlightColor}
            onChange={handleHighlightColorChange}
            style={{ width: '32px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
            title="Highlight Color"
          />
        </div>
      </div>
      
      {/* Toolbar - Row 2: Alignment, Lists, Links */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        padding: '8px', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexWrap: 'wrap',
        alignItems: 'center',
        width: '100%'
      }}>
        {/* Alignment */}
        <button type="button" onClick={() => execCommand('justifyLeft')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Align Left">
          ⬅
        </button>
        <button type="button" onClick={() => execCommand('justifyCenter')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Align Center">
          ⬌
        </button>
        <button type="button" onClick={() => execCommand('justifyRight')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Align Right">
          ➡
        </button>
        <button type="button" onClick={() => execCommand('justifyFull')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Justify">
          ⬌⬌
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        {/* Bullet List with Styles */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" onClick={() => handleListStyleChange('ul', 'disc')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Bullet List">
            •
          </button>
          <select 
            onChange={(e) => handleListStyleChange('ul', e.target.value)}
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              width: '100%', 
              height: '100%', 
              opacity: 0, 
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Bullet List Style"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="disc">• Disc</option>
            <option value="circle">○ Circle</option>
            <option value="square">■ Square</option>
            <option value="none">None</option>
          </select>
        </div>
        
        {/* Numbered List with Styles */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" onClick={() => handleListStyleChange('ol', 'decimal')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Numbered List">
            1.
          </button>
          <select 
            onChange={(e) => handleListStyleChange('ol', e.target.value)}
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              width: '100%', 
              height: '100%', 
              opacity: 0, 
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Numbered List Style"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="decimal">1. Decimal</option>
            <option value="decimal-leading-zero">01. Decimal Leading Zero</option>
            <option value="lower-roman">i. Lower Roman</option>
            <option value="upper-roman">I. Upper Roman</option>
            <option value="lower-alpha">a. Lower Alpha</option>
            <option value="upper-alpha">A. Upper Alpha</option>
            <option value="lower-latin">a. Lower Latin</option>
            <option value="upper-latin">A. Upper Latin</option>
          </select>
        </div>
        
        {/* Indentation */}
        <button type="button" onClick={() => execCommand('outdent')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Decrease Indent">
          ⬅
        </button>
        <button type="button" onClick={() => execCommand('indent')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Increase Indent">
          ➡
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        {/* Link */}
        <button type="button" onClick={handleInsertLink} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Insert Link">
          🔗
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        {/* Clear Formatting */}
        <button type="button" onClick={() => execCommand('removeFormat')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Clear Formatting">
          Clear
        </button>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          minHeight: '200px',
          padding: '12px 12px 12px 24px',
          outline: isFocused ? '2px solid var(--primary)' : 'none',
          outlineOffset: '-2px',
          color: 'var(--text)',
          fontFamily: fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: '1.5',
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'auto'
        }}
      />
      <style>{`
        [contenteditable="true"] ul,
        [contenteditable="true"] ol {
          padding-left: 32px !important;
          margin-left: 0 !important;
          margin-top: 8px !important;
          margin-bottom: 8px !important;
          list-style-position: outside !important;
        }
        [contenteditable="true"] li {
          margin-bottom: 4px !important;
          padding-left: 8px !important;
        }
        [contenteditable="true"] ul {
          list-style-type: disc !important;
        }
        [contenteditable="true"] ol {
          list-style-type: decimal !important;
        }
        [contenteditable="true"] img {
          max-width: 100%;
          height: auto;
          margin: 8px 0;
        }
        [contenteditable="true"] a {
          color: var(--primary);
          text-decoration: underline;
        }
        [contenteditable="true"] h1,
        [contenteditable="true"] h2,
        [contenteditable="true"] h3,
        [contenteditable="true"] h4 {
          margin-top: 12px;
          margin-bottom: 8px;
          font-weight: bold;
        }
        [contenteditable="true"] h1 { font-size: 2em; }
        [contenteditable="true"] h2 { font-size: 1.5em; }
        [contenteditable="true"] h3 { font-size: 1.17em; }
        [contenteditable="true"] h4 { font-size: 1em; }
      `}</style>
      
      {/* Link Insert Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={handleLinkModalCancel}
        title="Insert Link"
        size="small"
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              URL:
            </label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLinkModalSave()
                }
              }}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleLinkModalCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--input)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLinkModalSave}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: 'var(--primary)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Insert
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Shared Create/Edit Quotation Modal Component
 * Used consistently across Leads and Quotations sections
 */
export function CreateQuotationModal({
  isOpen,
  onClose,
  onSave,
  editing = null,
  preSelectedLeadId = null,
  leads = [],
  source = 'leads' // 'leads' or 'quotations'
}) {
  const [currentUser, setCurrentUser] = useState(null)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })

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
    scopeOfWork: '',
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
  }, [])

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
        scopeOfWork: editing.scopeOfWork?.length 
          ? (Array.isArray(editing.scopeOfWork) 
              ? editing.scopeOfWork.map(item => item.description || '').join('<br>') 
              : editing.scopeOfWork)
          : '',
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
        scopeOfWork: '',
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
    // Pre-populate form with lead data if preSelectedLeadId is provided
    if (preSelectedLeadId && leads.length > 0 && currentUser && !editing) {
      const selectedLead = leads.find(l => l._id === preSelectedLeadId)
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
  }, [preSelectedLeadId, leads, currentUser, editing])

  const recalcTotals = (items, vatRate) => {
    const sub = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitRate || 0)), 0)
    const vat = sub * (Number(vatRate || 0) / 100)
    const grand = sub + vat
    return { subTotal: Number(sub.toFixed(2)), vatAmount: Number(vat.toFixed(2)), grandTotal: Number(grand.toFixed(2)) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form }
      const totals = recalcTotals(payload.priceSchedule.items, payload.priceSchedule.taxDetails.vatRate)
      payload.priceSchedule.subTotal = totals.subTotal
      payload.priceSchedule.taxDetails.vatAmount = totals.vatAmount
      payload.priceSchedule.grandTotal = totals.grandTotal
      
      // Convert scopeOfWork string to array format for backend compatibility
      if (typeof payload.scopeOfWork === 'string') {
        payload.scopeOfWork = payload.scopeOfWork ? [{ description: payload.scopeOfWork, quantity: '', unit: '', locationRemarks: '' }] : []
      }
      
      await onSave(payload, editing)
      onClose()
    } catch (err) {
      setNotify({ open: true, title: 'Save Failed', message: err.response?.data?.message || 'We could not save this quotation. Please try again.' })
    }
  }

  const handleOpenInNewTab = () => {
    let url = ''
    if (source === 'leads') {
      if (editing) {
        // For editing from leads, we still use the quotations route
        url = `/quotations/edit/${editing._id}`
      } else if (form.lead || preSelectedLeadId) {
        const leadId = form.lead || preSelectedLeadId
        url = `/leads/create-quotation/${leadId}`
      } else {
        url = `/leads/create-quotation`
      }
    } else {
      // source === 'quotations'
      if (editing) {
        url = `/quotations/edit/${editing._id}`
      } else {
        url = `/quotations/create`
      }
    }
    window.open(url, '_blank')
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

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editing ? 'Edit Quotation' : 'Create Quotation'}
        size="medium"
        className=""
        closeOnOverlayClick={true}
        headerActions={
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="link-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Open in New Tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Open in New Tab
          </button>
        }
      >
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
            <FormField>
              <ScopeOfWorkEditor
                value={typeof form.scopeOfWork === 'string' ? form.scopeOfWork : ''}
                onChange={(value) => setForm({ ...form, scopeOfWork: value })}
              />
            </FormField>
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
                      value={it.description || ''} 
                      onChange={e => onChangeItem(i, 'description', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Qty" className="flex-1">
                    <input 
                      type="number" 
                      value={it.quantity || ''} 
                      onChange={e => onChangeItem(i, 'quantity', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Unit" className="flex-1">
                    <input 
                      type="text" 
                      value={it.unit || ''} 
                      onChange={e => onChangeItem(i, 'unit', e.target.value)} 
                    />
                  </FormField>
                  <FormField label="Unit Rate" className="flex-1">
                    <input 
                      type="number" 
                      value={it.unitRate || ''} 
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
                    value={ex || ''} 
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
                      value={p.milestoneDescription || ''} 
                      onChange={e => setForm({ ...form, paymentTerms: form.paymentTerms.map((x, idx) => idx === i ? { ...x, milestoneDescription: e.target.value } : x) })} 
                    />
                  </FormField>
                  <FormField label="Amount %" className="flex-1">
                    <input 
                      type="number" 
                      value={p.amountPercent || ''} 
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
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn">
              {editing ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

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
    </>
  )
}

