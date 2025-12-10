import { useEffect, useState, useRef } from 'react'
import { apiFetch } from '../lib/api'
import './LeadManagement.css'
import './LeadDetail.css'
import logo from '../assets/logo/WBES_Logo.png'
import { Modal } from '../design-system/Modal'
import { CreateQuotationModal } from './CreateQuotationModal'

// Google Docs-style Rich Text Editor using contentEditable (compatible with React 19)
function ScopeOfWorkEditor({ value, onChange }) {
  const editorRef = useRef(null)
  const savedSelectionRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [fontSize, setFontSize] = useState('14')
  const [fontSizeInput, setFontSizeInput] = useState('14')
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false)
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

  useEffect(() => {
    if (!showFontSizeDropdown) return
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-font-size-container]')) {
        setShowFontSizeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFontSizeDropdown])

  const handleInput = (e) => {
    const html = e.target.innerHTML
    onChange(html)
    setTimeout(() => saveSelection(), 0)
  }
  
  useEffect(() => {
    if (!isFocused || !editorRef.current) return
    const handleMouseUp = (e) => {
      if (editorRef.current?.contains(e.target)) {
        setTimeout(() => saveSelection(), 0)
      }
    }
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (editorRef.current?.contains(range.anchorNode)) {
          saveSelection()
        }
      }
    }
    editorRef.current.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('mouseup', handleMouseUp)
      }
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [isFocused])

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

  const expandToWord = (range) => {
    try {
      if (range.expand) {
        range.expand('word')
      }
    } catch (e) {
      const textNode = range.startContainer
      if (textNode && textNode.nodeType === 3) {
        const text = textNode.textContent
        const start = range.startOffset
        let wordStart = start
        let wordEnd = start
        while (wordStart > 0 && /\S/.test(text[wordStart - 1])) {
          wordStart--
        }
        while (wordEnd < text.length && /\S/.test(text[wordEnd])) {
          wordEnd++
        }
        if (wordStart < wordEnd) {
          range.setStart(textNode, wordStart)
          range.setEnd(textNode, wordEnd)
        }
      }
    }
  }

  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (editorRef.current && 
          (editorRef.current.contains(range.anchorNode) || editorRef.current.contains(range.focusNode))) {
        if (!range.collapsed) {
          savedSelectionRef.current = range.cloneRange()
        } else {
          savedSelectionRef.current = null
        }
      }
    }
  }

  const applyFontSize = (size) => {
    if (!savedSelectionRef.current) {
      if (editorRef.current) {
        editorRef.current.focus()
      }
      return
    }
    
    const savedRange = savedSelectionRef.current
    
    if (!editorRef.current || 
        !editorRef.current.contains(savedRange.startContainer) || 
        !editorRef.current.contains(savedRange.endContainer)) {
      savedSelectionRef.current = null
      if (editorRef.current) {
        editorRef.current.focus()
      }
      return
    }
    
    const range = savedRange.cloneRange()
    
    if (range.collapsed) {
      if (editorRef.current) {
        editorRef.current.focus()
      }
      return
    }
    
    const selection = window.getSelection()
    selection.removeAllRanges()
    try {
      selection.addRange(range.cloneRange())
    } catch (e) {
      return
    }
    
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      editorRef.current?.focus()
      return
    }
    
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    const startOffset = range.startOffset
    const endOffset = range.endOffset
    
    if (startContainer === endContainer && startContainer.nodeType === 3) {
      const textNode = startContainer
      const text = textNode.textContent
      const beforeText = text.substring(0, startOffset)
      const selectedText = text.substring(startOffset, endOffset)
      const afterText = text.substring(endOffset)
      
      const beforeNode = document.createTextNode(beforeText)
      const span = document.createElement('span')
      span.style.fontSize = `${size}px`
      span.textContent = selectedText
      const afterNode = document.createTextNode(afterText)
      
      const parent = textNode.parentNode
      if (beforeNode.textContent) {
        parent.insertBefore(beforeNode, textNode)
      }
      parent.insertBefore(span, textNode)
      if (afterNode.textContent) {
        parent.insertBefore(afterNode, textNode)
      }
      parent.removeChild(textNode)
    } else {
      const workRange = range.cloneRange()
      const wrapper = document.createElement('span')
      wrapper.style.fontSize = `${size}px`
      const contents = workRange.extractContents()
      if (contents.hasChildNodes()) {
        while (contents.firstChild) {
          wrapper.appendChild(contents.firstChild)
        }
      } else if (contents.nodeType === 3) {
        wrapper.appendChild(contents)
      }
      if (wrapper.textContent.trim() || wrapper.hasChildNodes()) {
        range.insertNode(wrapper)
      }
    }
    
    savedSelectionRef.current = null
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    
    editorRef.current?.focus()
  }

  const applyFontFamily = (family) => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (selection.isCollapsed) {
        expandToWord(range)
      }
      if (!range.collapsed) {
        const span = document.createElement('span')
        span.style.fontFamily = family
        try {
          range.surroundContents(span)
        } catch (e) {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
        }
      }
    }
    editorRef.current?.focus()
  }

  const handleFontSizeInputChange = (e) => {
    const value = e.target.value
    setFontSizeInput(value)
  }

  const handleFontSizeInputBlur = (e) => {
    if (e.relatedTarget && e.relatedTarget.closest('[data-font-size-container]')) {
      return
    }
    
    setShowFontSizeDropdown(false)
    
    if (!savedSelectionRef.current) {
      const numValue = parseFloat(fontSizeInput)
      if (fontSizeInput && !isNaN(numValue) && numValue > 0 && numValue <= 200) {
        const sizeStr = String(Math.round(numValue))
        setFontSize(sizeStr)
        setFontSizeInput(sizeStr)
      } else {
        setFontSizeInput(fontSize)
      }
      return
    }
    
    const numValue = parseFloat(fontSizeInput)
    if (fontSizeInput && !isNaN(numValue) && numValue > 0 && numValue <= 200) {
      const sizeStr = String(Math.round(numValue))
      setFontSize(sizeStr)
      setFontSizeInput(sizeStr)
      applyFontSize(numValue)
    } else {
      setFontSizeInput(fontSize)
    }
  }

  const handleFontSizeInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFontSizeInputBlur()
    }
  }

  const handleFontSizeSelect = (size) => {
    setFontSize(size)
    setFontSizeInput(size)
    setShowFontSizeDropdown(false)
    
    if (!savedSelectionRef.current) {
      return
    }
    
    setTimeout(() => {
      applyFontSize(parseFloat(size))
    }, 10)
  }

  const handleFontFamilyChange = (e) => {
    const family = e.target.value
    setFontFamily(family)
    applyFontFamily(family)
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
      const finalUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
      
      const selection = window.getSelection()
      if (selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0)
        if (selection.isCollapsed) {
          expandToWord(range)
        }
        if (!range.collapsed) {
          const linkElement = range.commonAncestorContainer.nodeType === 1 
            ? range.commonAncestorContainer.closest('a')
            : range.commonAncestorContainer.parentElement?.closest('a')
          
          if (linkElement) {
            linkElement.href = finalUrl
          } else {
            selection.removeAllRanges()
            selection.addRange(range)
            document.execCommand('createLink', false, finalUrl)
          }
        } else {
          const link = document.createElement('a')
          link.href = finalUrl
          link.textContent = finalUrl
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          range.insertNode(link)
          range.setStartAfter(link)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
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
    if (selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0)
      let listElement = null
      
      if (range.commonAncestorContainer.nodeType === 1) {
        listElement = range.commonAncestorContainer.closest('ul, ol')
      } else {
        listElement = range.commonAncestorContainer.parentElement?.closest('ul, ol')
      }
      
      if (listElement) {
        const currentType = listElement.tagName.toLowerCase()
        if ((listType === 'ul' && currentType === 'ol') || (listType === 'ol' && currentType === 'ul')) {
          const newList = document.createElement(listType === 'ul' ? 'ul' : 'ol')
          newList.style.setProperty('list-style-type', style, 'important')
          while (listElement.firstChild) {
            newList.appendChild(listElement.firstChild)
          }
          listElement.parentNode?.replaceChild(newList, listElement)
          listElement = newList
        } else {
          listElement.style.setProperty('list-style-type', style, 'important')
          listElement.setAttribute('data-list-style', style)
        }
      } else {
        if (listType === 'ul') {
          document.execCommand('insertUnorderedList', false, null)
          setTimeout(() => {
            const newList = editorRef.current?.querySelector('ul:last-of-type')
            if (newList) {
              newList.style.setProperty('list-style-type', style, 'important')
              newList.setAttribute('data-list-style', style)
            }
          }, 50)
        } else {
          document.execCommand('insertOrderedList', false, null)
          setTimeout(() => {
            const newList = editorRef.current?.querySelector('ol:last-of-type')
            if (newList) {
              newList.style.setProperty('list-style-type', style, 'important')
              newList.setAttribute('data-list-style', style)
            }
          }, 50)
        }
      }
    }
    editorRef.current?.focus()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input)', width: '100%', minWidth: '100%' }}>
      <div 
        style={{ 
          display: 'flex', 
          gap: '4px', 
          padding: '8px', 
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexWrap: 'wrap',
          alignItems: 'center',
          width: '100%',
          minHeight: '36px',
          boxSizing: 'border-box'
        }}
        onMouseEnter={() => saveSelection()}
        onMouseDown={(e) => saveSelection()}
      >
        <button type="button" onClick={handleUndo} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Undo">
          ↶
        </button>
        <button type="button" onClick={handleRedo} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Redo">
          ↷
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
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
        
        <div 
          style={{ position: 'relative', display: 'inline-block' }} 
          data-font-size-container
          onMouseEnter={() => saveSelection()}
        >
          <input
            type="text"
            value={fontSizeInput}
            onChange={handleFontSizeInputChange}
            onBlur={handleFontSizeInputBlur}
            onKeyPress={handleFontSizeInputKeyPress}
            onMouseDown={(e) => {
              e.preventDefault()
              saveSelection()
              setTimeout(() => {
                e.target.focus()
              }, 0)
            }}
            onFocus={() => {
              saveSelection()
              setShowFontSizeDropdown(true)
            }}
            style={{ 
              padding: '4px 6px', 
              border: '1px solid var(--border)', 
              borderRadius: '4px', 
              background: 'var(--input)', 
              fontSize: '12px', 
              width: '60px',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
            title="Font Size (type custom value or click dropdown)"
          />
          {showFontSizeDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto',
                minWidth: '60px'
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(size => (
                <div
                  key={size}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!savedSelectionRef.current) {
                      saveSelection()
                    }
                    handleFontSizeSelect(String(size))
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    saveSelection()
                  }}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    backgroundColor: fontSize === String(size) ? 'var(--primary)' : 'transparent',
                    color: fontSize === String(size) ? 'white' : 'var(--text)'
                  }}
                  onMouseEnter={(e) => {
                    if (fontSize !== String(size)) {
                      e.target.style.backgroundColor = 'var(--bg)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (fontSize !== String(size)) {
                      e.target.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {size}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        <button type="button" onClick={() => execCommand('bold')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontWeight: 'bold' }} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => execCommand('italic')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', fontStyle: 'italic' }} title="Italic">
          <em>I</em>
        </button>
        <button type="button" onClick={() => execCommand('underline')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', textDecoration: 'underline' }} title="Underline">
          <u>U</u>
        </button>
        
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <input
            type="color"
            value={textColor}
            onChange={handleTextColorChange}
            style={{ width: '32px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
            title="Text Color"
          />
        </div>
        
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
        
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" onClick={() => handleListStyleChange('ul', 'disc')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', pointerEvents: 'none' }} title="Bullet List">
            •
          </button>
          <select 
            onChange={(e) => {
              e.stopPropagation()
              handleListStyleChange('ul', e.target.value)
            }}
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              width: '100%', 
              height: '100%', 
              opacity: 0, 
              cursor: 'pointer',
              fontSize: '12px',
              zIndex: 10
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
        
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" onClick={() => handleListStyleChange('ol', 'decimal')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer', pointerEvents: 'none' }} title="Numbered List">
            1.
          </button>
          <select 
            onChange={(e) => {
              e.stopPropagation()
              handleListStyleChange('ol', e.target.value)
            }}
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              width: '100%', 
              height: '100%', 
              opacity: 0, 
              cursor: 'pointer',
              fontSize: '12px',
              zIndex: 10
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
        
        <button type="button" onClick={() => execCommand('outdent')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Decrease Indent">
          ⬅
        </button>
        <button type="button" onClick={() => execCommand('indent')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Increase Indent">
          ➡
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        <button type="button" onClick={handleInsertLink} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Insert Link">
          🔗
        </button>
        
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        
        <button type="button" onClick={() => execCommand('removeFormat')} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--input)', cursor: 'pointer' }} title="Clear Formatting">
          Clear
        </button>
      </div>
      
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => {
          setIsFocused(true)
          saveSelection()
        }}
        onBlur={() => {
          setIsFocused(false)
        }}
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

function QuotationDetail() {
  const [quotation, setQuotation] = useState(null)
  const [lead, setLead] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [showQuoteHistory, setShowQuoteHistory] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, action: null, note: '' })
  const [sendApprovalConfirmModal, setSendApprovalConfirmModal] = useState(false)
  const [approvalsViewOpen, setApprovalsViewOpen] = useState(false)
  const [revisionModal, setRevisionModal] = useState({ open: false, form: null })
  const [originalRevisionForm, setOriginalRevisionForm] = useState(null)
  const priceScheduleEditedRef = useRef(false)
  const [hasRevisions, setHasRevisions] = useState(false)
  const [revisions, setRevisions] = useState([])
  const [revisionHistoryOpen, setRevisionHistoryOpen] = useState({})
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [deleteModal, setDeleteModal] = useState({ open: false })
  const [printPreviewModal, setPrintPreviewModal] = useState({ open: false, pdfUrl: null, quotation: null })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

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
      const isPending = q.managementApproval?.status === 'pending'
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
      if (isPending) {
        content.push({ text: 'Management Approval: Pending', italics: true, color: '#b45309', margin: [0, 12, 0, 0] })
      } else if (q.managementApproval?.status === 'approved') {
        content.push({ text: `Approved by: ${q.managementApproval?.approvedBy?.name || 'Management'}`, italics: true, color: '#16a34a', margin: [0, 12, 0, 0] })
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
                  { text: isPending ? 'Approval Pending' : (q.managementApproval?.status === 'approved' ? 'Approved' : ''), color: isPending ? '#b45309' : '#16a34a' },
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
      setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF. Please try again.' })
    }
  }

  const generatePDFPreview = async (q) => {
    try {
      await ensurePdfMake()
      const logoDataUrl = await toDataURL(q.companyInfo?.logo || logo)
      const isPending = q.managementApproval?.status === 'pending'
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
      if (isPending) {
        content.push({ text: 'Management Approval: Pending', italics: true, color: '#b45309', margin: [0, 12, 0, 0] })
      } else if (q.managementApproval?.status === 'approved') {
        content.push({ text: `Approved by: ${q.managementApproval?.approvedBy?.name || 'Management'}`, italics: true, color: '#16a34a', margin: [0, 12, 0, 0] })
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
                  { text: isPending ? 'Approval Pending' : (q.managementApproval?.status === 'approved' ? 'Approved' : ''), color: isPending ? '#b45309' : '#16a34a' },
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

      const pdfDoc = window.pdfMake.createPdf(docDefinition)
      pdfDoc.getDataUrl((dataUrl) => {
        setPrintPreviewModal({ open: true, pdfUrl: dataUrl, quotation: q })
      })
    } catch (e) {
      setNotify({ open: true, title: 'Preview Failed', message: 'We could not generate the PDF preview. Please try again.' })
    }
  }

  const hasRevisionChanges = (original, form) => {
    if (!original || !form) return false
    const fields = [
      'companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText',
      'scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity'
    ]
    for (const f of fields) {
      if (JSON.stringify(original?.[f] ?? null) !== JSON.stringify(form?.[f] ?? null)) return true
    }
    return false
  }

  const approveQuotation = async (status, note) => {
    try {
      const token = localStorage.getItem('token')
      await apiFetch(`/api/quotations/${quotation._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note })
      })
      const res = await apiFetch(`/api/quotations/${quotation._id}`)
      const updated = await res.json()
      setQuotation(updated)
      setApprovalModal({ open: false, action: null, note: '' })
    } catch (e) {
      setNotify({ open: true, title: 'Approval Failed', message: 'We could not update approval. Please try again.' })
    }
  }

  const sendForApproval = async () => {
    try {
      const token = localStorage.getItem('token')
      await apiFetch(`/api/quotations/${quotation._id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' })
      })
      const res = await apiFetch(`/api/quotations/${quotation._id}`)
      const updated = await res.json()
      setQuotation(updated)
      setSendApprovalConfirmModal(false)
      setNotify({ open: true, title: 'Request Sent', message: 'Approval request has been sent successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Send Failed', message: 'We could not send for approval. Please try again.' })
    }
  }

  const handleDeleteQuotation = async () => {
    try {
      const token = localStorage.getItem('token')
      await apiFetch(`/api/quotations/${quotation._id}`, {
        method: 'DELETE'
      })
      setDeleteModal({ open: false })
      setNotify({ open: true, title: 'Deleted', message: 'Quotation deleted successfully.' })
      setTimeout(() => {
        window.location.href = '/quotations'
      }, 1500)
    } catch (e) {
      setDeleteModal({ open: false })
      setNotify({ open: true, title: 'Delete Failed', message: e.message || 'We could not delete the quotation. Please try again.' })
    }
  }

  const createRevision = async () => {
    try {
      const token = localStorage.getItem('token')
      const form = { ...revisionModal.form }
      
      // Compare BEFORE conversion - convert original quotation to same format as form
      const original = quotation
      const originalFormFormat = {
        companyInfo: original.companyInfo || {},
        submittedTo: original.submittedTo || '',
        attention: original.attention || '',
        offerReference: original.offerReference || '',
        enquiryNumber: original.enquiryNumber || '',
        offerDate: original.offerDate ? original.offerDate.substring(0,10) : '',
        enquiryDate: original.enquiryDate ? original.enquiryDate.substring(0,10) : '',
        projectTitle: original.projectTitle || original.lead?.projectTitle || '',
        introductionText: original.introductionText || '',
        scopeOfWork: original.scopeOfWork?.length ? original.scopeOfWork.map(item => item.description || '').join('<br>') : '',
        priceSchedule: original.priceSchedule?.items?.length ? original.priceSchedule.items.map(item => `${item.description || ''}${item.quantity ? ` - Qty: ${item.quantity}` : ''}${item.unit ? ` ${item.unit}` : ''}${item.unitRate ? ` @ ${item.unitRate}` : ''}${item.totalAmount ? ` = ${item.totalAmount}` : ''}`).join('<br>') : '',
        ourViewpoints: original.ourViewpoints || '',
        exclusions: original.exclusions?.length ? original.exclusions.join('<br>') : '',
        paymentTerms: original.paymentTerms?.length ? original.paymentTerms.map(term => `${term.milestoneDescription || ''}${term.amountPercent ? ` - ${term.amountPercent}%` : ''}`).join('<br>') : '',
        deliveryCompletionWarrantyValidity: original.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
      }
      
      // Helper function to normalize HTML content for comparison
      const normalizeHtml = (html) => {
        if (!html) return ''
        // Create a temporary div to parse HTML
        const temp = document.createElement('div')
        temp.innerHTML = html
        // Get text content and normalize whitespace
        let text = temp.textContent || temp.innerText || ''
        // Replace multiple whitespace with single space
        text = text.replace(/\s+/g, ' ').trim()
        return text
      }
      
      // Compare form data (both in HTML string format)
      const fields = ['companyInfo','submittedTo','attention','offerReference','enquiryNumber','offerDate','enquiryDate','projectTitle','introductionText','scopeOfWork','priceSchedule','ourViewpoints','exclusions','paymentTerms','deliveryCompletionWarrantyValidity']
      let changed = false
      for (const f of fields) {
        if (f === 'companyInfo' || f === 'deliveryCompletionWarrantyValidity') {
          if (JSON.stringify(originalFormFormat[f] ?? null) !== JSON.stringify(form[f] ?? null)) { 
            changed = true
            break 
          }
        } else {
          // For string fields, normalize HTML and compare text content
          const originalVal = normalizeHtml(String(originalFormFormat[f] ?? ''))
          const formVal = normalizeHtml(String(form[f] ?? ''))
          if (originalVal !== formVal) {
            changed = true
            break
          }
        }
      }
      if (!changed) { 
        setNotify({ open: true, title: 'No Changes', message: 'No changes detected. Please modify data before creating a revision.' })
        return 
      }
      
      // Now convert to backend format
      const payload = { ...form }
      
      // Convert scopeOfWork string to array format for backend compatibility
      if (typeof payload.scopeOfWork === 'string') {
        payload.scopeOfWork = payload.scopeOfWork ? [{ description: payload.scopeOfWork, quantity: '', unit: '', locationRemarks: '' }] : []
      }
      
      // Convert priceSchedule string to object format for backend compatibility
      if (typeof payload.priceSchedule === 'string') {
        payload.priceSchedule = payload.priceSchedule ? {
          items: [{ description: payload.priceSchedule, quantity: 0, unit: '', unitRate: 0, totalAmount: 0 }],
          subTotal: 0,
          grandTotal: 0,
          currency: original.priceSchedule?.currency || 'AED',
          taxDetails: original.priceSchedule?.taxDetails || { vatRate: 5, vatAmount: 0 }
        } : {
          items: [],
          subTotal: 0,
          grandTotal: 0,
          currency: original.priceSchedule?.currency || 'AED',
          taxDetails: original.priceSchedule?.taxDetails || { vatRate: 5, vatAmount: 0 }
        }
      }
      
      // Convert exclusions string to array format for backend compatibility
      if (typeof payload.exclusions === 'string') {
        payload.exclusions = payload.exclusions 
          ? payload.exclusions.split('<br>').filter(ex => ex.trim())
          : []
      }
      
      // Convert paymentTerms string to array format for backend compatibility
      if (typeof payload.paymentTerms === 'string') {
        payload.paymentTerms = payload.paymentTerms 
          ? payload.paymentTerms.split('<br>').map(term => {
              // Try to parse "Milestone - X%" format
              const match = term.match(/^(.+?)(?:\s*-\s*(\d+(?:\.\d+)?)%)?$/)
              return {
                milestoneDescription: match ? match[1].trim() : term.trim(),
                amountPercent: match && match[2] ? parseFloat(match[2]) : 0
              }
            }).filter(term => term.milestoneDescription)
          : []
      }
      await apiFetch('/api/revisions', {
        method: 'POST',
        body: JSON.stringify({ sourceQuotationId: quotation._id, data: payload })
      })
      setNotify({ open: true, title: 'Revision Created', message: 'The revision was created successfully.' })
      setRevisionModal({ open: false, form: null })
      setOriginalRevisionForm(null)
      priceScheduleEditedRef.current = false
      window.location.href = '/revisions'
    } catch (e) {
      setNotify({ open: true, title: 'Create Failed', message: 'We could not create the revision. Please try again.' })
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
          const res = await apiFetch(`/api/quotations/${qid}`)
          const q = await res.json()
          setQuotation(q)
          const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
          if (leadId) {
            const resLead = await apiFetch(`/api/leads/${leadId}`)
            const leadData = await resLead.json()
            const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
            const visits = await visitsRes.json()
            setLead({ ...leadData, siteVisits: visits })
          }
          try {
            const revRes = await apiFetch(`/api/revisions?parentQuotation=${qid}`)
            const revs = await revRes.json()
            const revisionsList = Array.isArray(revs) ? revs : []
            setRevisions(revisionsList)
            setHasRevisions(revisionsList.length > 0)
          } catch {}
        } else if (initial) {
          setQuotation(initial)
          const leadId = typeof initial.lead === 'object' ? initial.lead?._id : initial.lead
          if (leadId) {
            const resLead = await apiFetch(`/api/leads/${leadId}`)
            const leadData = await resLead.json()
            const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
            const visits = await visitsRes.json()
            setLead({ ...leadData, siteVisits: visits })
          }
          try {
            const revRes = await apiFetch(`/api/revisions?parentQuotation=${initial._id || localStorage.getItem('quotationId')}`)
            const revs = await revRes.json()
            const revisionsList = Array.isArray(revs) ? revs : []
            setRevisions(revisionsList)
            setHasRevisions(revisionsList.length > 0)
          } catch {}
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

  const approvalStatus = quotation.managementApproval?.status || null

  const handleSave = async (payload, editingQuote) => {
    // Reload the quotation after save
    try {
      const qid = localStorage.getItem('quotationId')
      if (qid) {
        const res = await apiFetch(`/api/quotations/${qid}`)
        const q = await res.json()
        setQuotation(q)
        const leadId = typeof q.lead === 'object' ? q.lead?._id : q.lead
        if (leadId) {
          const resLead = await apiFetch(`/api/leads/${leadId}`)
          const leadData = await resLead.json()
          const visitsRes = await apiFetch(`/api/leads/${leadId}/site-visits`)
          const visits = await visitsRes.json()
          setLead({ ...leadData, siteVisits: visits })
        }
        try {
          const revRes = await apiFetch(`/api/revisions?parentQuotation=${qid}`)
          const revs = await revRes.json()
          const revisionsList = Array.isArray(revs) ? revs : []
          setRevisions(revisionsList)
          setHasRevisions(revisionsList.length > 0)
        } catch {}
      }
      setNotify({ open: true, title: 'Success', message: editingQuote ? 'Quotation updated successfully.' : 'Quotation created successfully.' })
    } catch (e) {
      setNotify({ open: true, title: 'Save Failed', message: 'We could not save the quotation. Please try again.' })
    }
  }

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
          {approvalStatus ? (
            approvalStatus === 'pending' ? (
              <span className="status-pill pending">Approval Pending</span>
            ) : approvalStatus === 'approved' ? (
              <span className="status-pill approved">approved</span>
            ) : approvalStatus === 'rejected' ? (
              <span className="status-pill rejected">rejected</span>
            ) : null
          ) : null}
          <button className="assign-btn" onClick={() => {
            if (quotation?._id) {
              setEditing(quotation)
              setShowModal(true)
            }
          }}>Edit</button>
          <button className="save-btn" onClick={() => generatePDFPreview(quotation)}>Print Preview</button>
          <button className="link-btn" onClick={async () => {
            try {
              const token = localStorage.getItem('token')
              // find latest approved revision for this quotation
              const revRes = await apiFetch(`/api/revisions?parentQuotation=${quotation._id}`)
              const revs = await revRes.json()
              const approved = (Array.isArray(revs) ? revs : []).filter(r => r.managementApproval?.status === 'approved')
              const latest = approved.slice().sort((a,b) => {
                // Extract numeric part from revisionNumber (e.g., "PROJ-REV-001" -> 1)
                const getRevisionNum = (revNum) => {
                  if (!revNum) return 0;
                  if (typeof revNum === 'number') return revNum;
                  const match = revNum.match(/-REV-(\d+)$/);
                  return match ? parseInt(match[1], 10) : 0;
                };
                return getRevisionNum(b.revisionNumber) - getRevisionNum(a.revisionNumber);
              })[0]
              if (!latest) { setNotify({ open: true, title: 'No Project', message: 'No approved revision found for project linking.' }); return }
              const pjRes = await apiFetch(`/api/projects/by-revision/${latest._id}`)
              if (!pjRes.ok) { setNotify({ open: true, title: 'No Project', message: 'No project exists for the latest approved revision.' }); return }
              const pj = await pjRes.json()
              try { 
                localStorage.setItem('projectsFocusId', pj._id)
                localStorage.setItem('projectId', pj._id)
              } catch {}
              window.location.href = '/project-detail'
            } catch { setNotify({ open: true, title: 'Open Project Failed', message: 'We could not open the linked project.' }) }
          }}>View Project</button>
          {approvalStatus === 'approved' && !hasRevisions && (
            <button className="assign-btn" onClick={() => {
              const formData = {
                companyInfo: quotation.companyInfo || {},
                submittedTo: quotation.submittedTo || '',
                attention: quotation.attention || '',
                offerReference: quotation.offerReference || '',
                enquiryNumber: quotation.enquiryNumber || '',
                offerDate: quotation.offerDate ? quotation.offerDate.substring(0,10) : '',
                enquiryDate: quotation.enquiryDate ? quotation.enquiryDate.substring(0,10) : '',
                projectTitle: quotation.projectTitle || quotation.lead?.projectTitle || '',
                introductionText: quotation.introductionText || '',
                scopeOfWork: quotation.scopeOfWork?.length ? quotation.scopeOfWork.map(item => item.description || '').join('<br>') : '',
                priceSchedule: quotation.priceSchedule?.items?.length ? quotation.priceSchedule.items.map(item => `${item.description || ''}${item.quantity ? ` - Qty: ${item.quantity}` : ''}${item.unit ? ` ${item.unit}` : ''}${item.unitRate ? ` @ ${item.unitRate}` : ''}${item.totalAmount ? ` = ${item.totalAmount}` : ''}`).join('<br>') : '',
                ourViewpoints: quotation.ourViewpoints || '',
                exclusions: quotation.exclusions?.length ? quotation.exclusions.join('<br>') : '',
                paymentTerms: quotation.paymentTerms?.length ? quotation.paymentTerms.map(term => `${term.milestoneDescription || ''}${term.amountPercent ? ` - ${term.amountPercent}%` : ''}`).join('<br>') : '',
                deliveryCompletionWarrantyValidity: quotation.deliveryCompletionWarrantyValidity || { deliveryTimeline: '', warrantyPeriod: '', offerValidity: 30, authorizedSignatory: currentUser?.name || '' }
              }
              setOriginalRevisionForm({ ...formData })
              setRevisionModal({ open: true, form: formData })
            }}>Create Revision</button>
          )}
          {approvalStatus !== 'approved' && approvalStatus !== 'pending' && !(currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && (
            <button className="save-btn" onClick={() => setSendApprovalConfirmModal(true)}>Send for Approval</button>
          )}
          {quotation.lead?._id && (
            <button className="link-btn" onClick={async () => {
              try {
                const token = localStorage.getItem('token')
                const res = await apiFetch(`/api/leads/${quotation.lead._id}`)
                const leadData = await res.json()
                const visitsRes = await apiFetch(`/api/leads/${quotation.lead._id}/site-visits`)
                const visits = await visitsRes.json()
                localStorage.setItem('leadDetail', JSON.stringify({ ...leadData, siteVisits: visits }))
                localStorage.setItem('leadId', quotation.lead._id)
                window.location.href = '/lead-detail'
              } catch { setNotify({ open: true, title: 'Open Lead Failed', message: 'We could not open the linked lead. Please try again.' }) }
            }}>View Lead</button>
          )}
          <button className="link-btn" onClick={() => setApprovalsViewOpen(true)}>View Approvals/Rejections</button>
          {quotation.edits?.length > 0 && (
            <button className="link-btn" onClick={() => setShowQuoteHistory(!showQuoteHistory)}>
              {showQuoteHistory ? 'Hide Quotation Edit History' : 'View Quotation Edit History'}
            </button>
          )}
          {(quotation.managementApproval?.status !== 'approved' || currentUser?.roles?.includes('manager') || currentUser?.roles?.includes('admin')) && (
            <button className="reject-btn" onClick={() => setDeleteModal({ open: true })}>
              Delete
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
      {Array.isArray(revisions) && revisions.length > 0 && (
        <div className="ld-card ld-section">
          <h3>Revisions ({revisions.length})</h3>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Revision #</th>
                  <th>Offer Ref</th>
                  <th>Offer Date</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((r) => (
                  <>
                    <tr key={r._id}>
                      <td data-label="Revision #">
                        {r.parentQuotation?._id || r.parentQuotation ? (
                          <button
                            className="link-btn"
                            onClick={() => {
                              try {
                                const parentId = typeof r.parentQuotation === 'object' ? r.parentQuotation._id : r.parentQuotation;
                                localStorage.setItem('quotationId', parentId);
                                localStorage.setItem('quotationDetail', JSON.stringify(r.parentQuotation || {}));
                              } catch {}
                              window.location.href = '/quotation-detail';
                            }}
                            style={{
                              fontSize: 'inherit',
                              fontWeight: 600,
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            {r.revisionNumber || 'N/A'}
                          </button>
                        ) : (
                          r.revisionNumber || 'N/A'
                        )}
                      </td>
                      <td data-label="Offer Ref">{r.offerReference || 'N/A'}</td>
                      <td data-label="Offer Date">{r.offerDate ? new Date(r.offerDate).toLocaleDateString() : 'N/A'}</td>
                      <td data-label="Grand Total">{(r.priceSchedule?.currency || 'AED')} {Number(r.priceSchedule?.grandTotal || 0).toFixed(2)}</td>
                      <td data-label="Status">{r.managementApproval?.status || 'pending'}</td>
                      <td data-label="Created By">
                        {r.createdBy?._id === currentUser?.id ? 'You' : (r.createdBy?.name || 'N/A')}
                        {r.createdBy?._id !== currentUser?.id && r.createdBy && (
                          <button className="link-btn" onClick={() => setProfileUser(r.createdBy)} style={{ marginLeft: 6 }}>View Profile</button>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div className="ld-actions">
                          <button className="save-btn" onClick={() => {
                            try {
                              localStorage.setItem('revisionId', r._id)
                              localStorage.setItem('revisionDetail', JSON.stringify(r))
                              const leadId = typeof r.lead === 'object' ? r.lead?._id : r.lead
                              if (leadId) localStorage.setItem('leadId', leadId)
                            } catch {}
                            window.location.href = '/revision-detail'
                          }}>View Revision</button>
                          {r.edits?.length > 0 && (
                            <button className="link-btn" onClick={() => setRevisionHistoryOpen(prev => ({ ...prev, [r._id]: !prev[r._id] }))}>
                              {revisionHistoryOpen[r._id] ? 'Hide History' : 'View History'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {revisionHistoryOpen[r._id] && r.edits?.length > 0 && (
                      <tr className="history-row">
                        <td colSpan={7}>
                          <div className="history-panel">
                            {r.edits.slice().reverse().map((e, j) => (
                              <div key={j} className="edit-item" style={{ marginTop: 8 }}>
                                <div className="edit-header">
                                  <span>By {e.editedBy?._id === currentUser?.id ? 'You' : (e.editedBy?.name || 'N/A')}</span>
                                  <span>{new Date(e.editedAt).toLocaleString()}</span>
                                  {e.editedBy?._id !== currentUser?.id && e.editedBy && (
                                    <button className="link-btn" onClick={() => setProfileUser(e.editedBy)}>View Profile</button>
                                  )}
                                </div>
                                <ul className="changes-list">
                                  {e.changes.map((c, k) => (
                                    <li key={k}><strong>{c.field}:</strong> {String(c.from || '')} → {String(c.to || '')}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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

      {sendApprovalConfirmModal && (
        <div className="modal-overlay" onClick={() => setSendApprovalConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Send for Approval</h2>
              <button onClick={() => setSendApprovalConfirmModal(false)} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to send this quotation for approval?</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setSendApprovalConfirmModal(false)}>Cancel</button>
                <button type="button" className="save-btn" onClick={sendForApproval}>
                  Confirm & Send
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
                const rawLogs = Array.isArray(q.managementApproval?.logs) ? q.managementApproval.logs.slice().sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)) : []
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

                if (cycles.length === 0 && (q.managementApproval?.requestedBy || q.managementApproval?.approvedBy)) {
                  cycles.push({
                    requestedAt: q.updatedAt || q.createdAt,
                    requestedBy: q.managementApproval?.requestedBy,
                    requestNote: q.managementApproval?.comments,
                    decidedAt: q.managementApproval?.approvedAt,
                    decidedBy: q.managementApproval?.approvedBy,
                    decisionNote: q.managementApproval?.comments,
                    decisionStatus: q.managementApproval?.status
                  })
                }

                if (cycles.length === 0) return <p>No approval records.</p>

                return (
                  <div>
                    {cycles.map((c, idx) => (
                      <div key={idx} className="edit-item" style={{ marginTop: idx === 0 ? 0 : 12 }}>
                        <div className="edit-header">
                          <span>Approval Cycle {idx + 1} — {c.decisionStatus ? c.decisionStatus.toUpperCase() : 'PENDING'}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          <div><strong>Requested:</strong> {c.requestedAt ? new Date(c.requestedAt).toLocaleString() : '—'} {c.requestedBy?.name && (<>
                            by {c.requestedBy?._id === currentUser?.id ? 'YOU' : c.requestedBy.name}
                            {c.requestedBy?._id && c.requestedBy._id !== currentUser?.id && (
                              <button className="link-btn" onClick={() => setProfileUser(c.requestedBy)} style={{ marginLeft: 6 }}>View Profile</button>
                            )}
                          </>)}</div>
                          {c.requestNote && <div><strong>Request note:</strong> {c.requestNote}</div>}
                          <div style={{ marginTop: 6 }}><strong>Decision:</strong> {c.decidedAt ? new Date(c.decidedAt).toLocaleString() : '—'} {c.decidedBy?.name && (<>
                            by {c.decidedBy?._id === currentUser?.id ? 'YOU' : c.decidedBy.name}
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
          </div>
        </div>
      )}
      {revisionModal.open && (
        <div className="modal-overlay" onClick={() => setRevisionModal({ open: false, form: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Revision</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {revisionModal.form && quotation?._id && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem('revisionCreateMode', 'true')
                          localStorage.setItem('revisionSourceQuotationId', quotation._id)
                          localStorage.setItem('revisionFormData', JSON.stringify(revisionModal.form))
                          window.open('/revision-detail', '_blank')
                        } catch {}
                      }}
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
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem('revisionCreateMode', 'true')
                          localStorage.setItem('revisionSourceQuotationId', quotation._id)
                          localStorage.setItem('revisionFormData', JSON.stringify(revisionModal.form))
                          window.location.href = '/revision-detail'
                        } catch {}
                      }}
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
                      title="Open Full Form"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                      </svg>
                      Open Full Form
                    </button>
                  </>
                )}
                <button onClick={() => setRevisionModal({ open: false, form: null })} className="close-btn">×</button>
              </div>
            </div>
            {revisionModal.form && (
              <div className="lead-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                <div className="form-section">
                  <div className="section-header">
                    <h3>Cover & Basic Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Submitted To (Client Company)</label>
                    <input type="text" value={revisionModal.form.submittedTo || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, submittedTo: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Attention (Contact Person)</label>
                    <input type="text" value={revisionModal.form.attention || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, attention: e.target.value } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Reference</label>
                      <input type="text" value={revisionModal.form.offerReference || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, offerReference: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Number</label>
                      <input type="text" value={revisionModal.form.enquiryNumber || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, enquiryNumber: e.target.value } })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Date</label>
                      <input type="date" value={revisionModal.form.offerDate || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, offerDate: e.target.value } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Enquiry Date</label>
                      <input type="date" value={revisionModal.form.enquiryDate || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, enquiryDate: e.target.value } })} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Project Details</h3>
                  </div>
                  <div className="form-group">
                    <label>Project Title</label>
                    <input type="text" value={revisionModal.form.projectTitle || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, projectTitle: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Introduction</label>
                    <textarea value={revisionModal.form.introductionText || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, introductionText: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Scope of Work</h3>
                  </div>
                  <div className="form-group">
                    <ScopeOfWorkEditor
                      value={typeof revisionModal.form.scopeOfWork === 'string' ? revisionModal.form.scopeOfWork : (Array.isArray(revisionModal.form.scopeOfWork) ? revisionModal.form.scopeOfWork.map(item => item.description || '').join('<br>') : '')}
                      onChange={(value) => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, scopeOfWork: value } })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Price Schedule</h3>
                  </div>
                  <div className="form-group">
                    <ScopeOfWorkEditor
                      value={typeof revisionModal.form.priceSchedule === 'string' ? revisionModal.form.priceSchedule : (revisionModal.form.priceSchedule?.items?.length ? revisionModal.form.priceSchedule.items.map(item => `${item.description || ''}${item.quantity ? ` - Qty: ${item.quantity}` : ''}${item.unit ? ` ${item.unit}` : ''}${item.unitRate ? ` @ ${item.unitRate}` : ''}${item.totalAmount ? ` = ${item.totalAmount}` : ''}`).join('<br>') : '')}
                      onChange={(html) => {
                        // Normalize HTML to check if content actually changed
                        const normalizeHtml = (h) => {
                          if (!h) return ''
                          const temp = document.createElement('div')
                          temp.innerHTML = h
                          let text = temp.textContent || temp.innerText || ''
                          text = text.replace(/\s+/g, ' ').trim()
                          return text
                        }
                        const originalNormalized = normalizeHtml(originalRevisionForm?.priceSchedule || '')
                        const newNormalized = normalizeHtml(html)
                        // Only update if content actually changed (user edited the field)
                        if (originalNormalized !== newNormalized) {
                          priceScheduleEditedRef.current = true
                          setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: html } })
                        } else {
                          // Content is same but HTML structure might have changed - restore original to prevent normalization issues
                          const originalValue = originalRevisionForm?.priceSchedule || ''
                          if (html !== originalValue) {
                            // HTML structure changed but content is same - restore original
                            setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, priceSchedule: originalValue } })
                          }
                        }
                      }}
                      onFocus={() => {
                        // Mark as potentially edited when field receives focus
                        priceScheduleEditedRef.current = true
                      }}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Our Viewpoints / Special Terms</h3>
                  </div>
                  <div className="form-group">
                    <label>Our Viewpoints / Special Terms</label>
                    <textarea value={revisionModal.form.ourViewpoints || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, ourViewpoints: e.target.value } })} />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Exclusions</h3>
                  </div>
                  <div className="form-group">
                    <ScopeOfWorkEditor
                      value={typeof revisionModal.form.exclusions === 'string' ? revisionModal.form.exclusions : (Array.isArray(revisionModal.form.exclusions) ? revisionModal.form.exclusions.join('<br>') : '')}
                      onChange={(html) => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, exclusions: html } })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Payment Terms</h3>
                  </div>
                  <div className="form-group">
                    <ScopeOfWorkEditor
                      value={typeof revisionModal.form.paymentTerms === 'string' ? revisionModal.form.paymentTerms : (Array.isArray(revisionModal.form.paymentTerms) ? revisionModal.form.paymentTerms.map(term => `${term.milestoneDescription || ''}${term.amountPercent ? ` - ${term.amountPercent}%` : ''}`).join('<br>') : '')}
                      onChange={(html) => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, paymentTerms: html } })}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>Delivery, Completion, Warranty & Validity</h3>
                  </div>
                  <div className="form-group">
                    <label>Delivery / Completion Timeline</label>
                    <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity?.deliveryTimeline || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, deliveryTimeline: e.target.value } } })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Warranty Period</label>
                      <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity?.warrantyPeriod || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, warrantyPeriod: e.target.value } } })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Offer Validity (Days)</label>
                      <input type="number" value={revisionModal.form.deliveryCompletionWarrantyValidity?.offerValidity || 30} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, offerValidity: e.target.value } } })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Authorized Signatory</label>
                    <input type="text" value={revisionModal.form.deliveryCompletionWarrantyValidity?.authorizedSignatory || ''} onChange={e => setRevisionModal({ ...revisionModal, form: { ...revisionModal.form, deliveryCompletionWarrantyValidity: { ...revisionModal.form.deliveryCompletionWarrantyValidity, authorizedSignatory: e.target.value } } })} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setRevisionModal({ open: false, form: null })}>Cancel</button>
                  <button type="button" className="save-btn" disabled={!hasRevisionChanges(quotation, revisionModal.form)} onClick={createRevision}>Confirm Revision</button>
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

      {deleteModal.open && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Quotation</h2>
              <button onClick={() => setDeleteModal({ open: false })} className="close-btn">×</button>
            </div>
            <div className="lead-form">
              <p>Are you sure you want to delete this quotation? This action cannot be undone.</p>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setDeleteModal({ open: false })}>Cancel</button>
                <button type="button" className="reject-btn" onClick={handleDeleteQuotation}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printPreviewModal.open && printPreviewModal.pdfUrl && (
        <div className="modal-overlay" onClick={() => setPrintPreviewModal({ open: false, pdfUrl: null, quotation: null })} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ zIndex: 10001, maxWidth: '95%', width: '100%', height: '95vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
              <h2>PDF Preview - Commercial Quotation</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="save-btn" 
                  onClick={async () => {
                    if (printPreviewModal.quotation) {
                      try {
                        await exportPDF(printPreviewModal.quotation)
                      } catch (e) {
                        setNotify({ open: true, title: 'Export Failed', message: 'We could not generate the PDF. Please try again.' })
                      }
                    }
                  }}
                >
                  Download PDF
                </button>
                <button 
                  className="save-btn" 
                  onClick={() => {
                    if (printPreviewModal.pdfUrl) {
                      const printWindow = window.open('', '_blank')
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Commercial Quotation</title>
                            <style>
                              body { margin: 0; padding: 0; }
                              iframe { width: 100%; height: 100vh; border: none; }
                            </style>
                          </head>
                          <body>
                            <iframe src="${printPreviewModal.pdfUrl}"></iframe>
                          </body>
                        </html>
                      `)
                      printWindow.document.close()
                      setTimeout(() => {
                        printWindow.frames[0].print()
                      }, 500)
                    }
                  }}
                >
                  Print
                </button>
                <button onClick={() => setPrintPreviewModal({ open: false, pdfUrl: null, quotation: null })} className="close-btn">×</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#525252', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <iframe 
                src={printPreviewModal.pdfUrl}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none',
                  background: 'white'
                }}
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      <CreateQuotationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditing(null)
        }}
        source="quotations"
        onSave={handleSave}
        editing={editing}
        leads={[]}
      />
    </div>
  )
}

export default QuotationDetail


