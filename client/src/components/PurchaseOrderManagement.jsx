import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Spinner } from './LoadingComponents'

function PurchaseOrderManagement() {
  const [orders, setOrders] = useState([])
  const [materials, setMaterials] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  const [fulfillModal, setFulfillModal] = useState({ open: false, order: null })
  const [fulfillItems, setFulfillItems] = useState([])
  const [fulfilling, setFulfilling] = useState(false)
  const [receiveModal, setReceiveModal] = useState({ open: false, order: null })
  const [receiveItems, setReceiveItems] = useState([])
  const [receiving, setReceiving] = useState(false)
  const [grnNotes, setGrnNotes] = useState('')
  // Enhanced GRN fields
  const [grnDeliveryDate, setGrnDeliveryDate] = useState('')
  const [grnDeliveryPersonName, setGrnDeliveryPersonName] = useState('')
  const [grnDeliveryPersonContact, setGrnDeliveryPersonContact] = useState('')
  const [grnVehicleNumber, setGrnVehicleNumber] = useState('')
  const [grnOverallCondition, setGrnOverallCondition] = useState('good')
  const [grnConditionNotes, setGrnConditionNotes] = useState('')
  const [grnReceiverName, setGrnReceiverName] = useState('')
  const [grnAcknowledgmentNotes, setGrnAcknowledgmentNotes] = useState('')
  
  const navigate = useNavigate()
  
  const [form, setForm] = useState({
    projectId: '',
    supplier: { name: '', contactPerson: '', phone: '', email: '', address: '' },
    items: [],
    deliveryDate: '',
    notes: '',
    priority: 'normal'
  })
  
  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)
  
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const roles = user.roles || []
  const isIM = roles.includes('inventory_manager')
  const isPE = roles.includes('procurement_engineer')
  const isAdmin = roles.includes('admin')
  const isManager = roles.includes('manager')
  const canCreate = isIM || isAdmin || isManager
  const canReview = isPE || isAdmin || isManager
  const canReceive = isIM || isAdmin || isManager

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const [ordersRes, materialsRes, projectsRes] = await Promise.all([
        api.get(`/api/purchase-orders${params}`),
        api.get('/api/materials'),
        api.get('/api/projects')
      ])
      setOrders(ordersRes.data.orders || [])
      setMaterials(Array.isArray(materialsRes.data) ? materialsRes.data : [])
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setNotify({ open: true, title: 'Error', message: 'Failed to load data.' })
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    if (!selectedMaterial) return
    const mat = materials.find(m => m._id === selectedMaterial)
    if (!mat) return
    
    // Check if already added
    if (form.items.some(i => i.materialId === selectedMaterial)) {
      setNotify({ open: true, title: 'Warning', message: 'Material already added.' })
      return
    }
    
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        materialId: mat._id,
        materialName: mat.name,
        sku: mat.sku,
        quantity: selectedQty,
        uom: mat.uom
      }]
    }))
    setSelectedMaterial('')
    setSelectedQty(1)
  }

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItemQty = (index, qty) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, quantity: Number(qty) } : item)
    }))
  }

  const handleSubmit = async () => {
    if (form.items.length === 0) {
      setNotify({ open: true, title: 'Error', message: 'Please add at least one item.' })
      return
    }
    
    try {
      setSaving(true)
      await api.post('/api/purchase-orders', form)
      setNotify({ open: true, title: 'Success', message: 'Purchase order created successfully.' })
      setShowModal(false)
      setForm({
        projectId: '',
        supplier: { name: '', contactPerson: '', phone: '', email: '', address: '' },
        items: [],
        deliveryDate: '',
        notes: '',
        priority: 'normal'
      })
      fetchData()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to create order.' })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await api.patch(`/api/purchase-orders/${id}/approve`)
      setNotify({ open: true, title: 'Success', message: 'Order approved.' })
      fetchData()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to approve.' })
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    try {
      await api.patch(`/api/purchase-orders/${id}/reject`, { reason })
      setNotify({ open: true, title: 'Success', message: 'Order rejected.' })
      fetchData()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to reject.' })
    }
  }

  const openFulfillModal = (order) => {
    // Initialize with requested quantities
    const items = (order.items || []).map(item => ({
      materialId: item.materialId?._id || item.materialId,
      materialName: item.materialName || item.materialId?.name || 'Unknown',
      sku: item.sku || item.materialId?.sku || '',
      requestedQty: item.quantity,
      deliveredQty: item.quantity, // Default to full delivery
      uom: item.uom
    }))
    setFulfillItems(items)
    setFulfillModal({ open: true, order })
  }

  const closeFulfillModal = () => {
    setFulfillModal({ open: false, order: null })
    setFulfillItems([])
  }

  const updateDeliveredQty = (index, qty) => {
    setFulfillItems(prev => prev.map((item, i) => 
      i === index ? { ...item, deliveredQty: Number(qty) } : item
    ))
  }

  const handleFulfillSubmit = async () => {
    if (!fulfillModal.order) return
    try {
      setFulfilling(true)
      await api.patch(`/api/purchase-orders/${fulfillModal.order._id}/fulfill`, {
        deliveredItems: fulfillItems.map(item => ({
          materialId: item.materialId,
          deliveredQty: item.deliveredQty
        }))
      })
      setNotify({ open: true, title: 'Success', message: 'Order fulfilled. Awaiting GRN from Inventory Manager.' })
      closeFulfillModal()
      fetchData()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to fulfill.' })
    } finally {
      setFulfilling(false)
    }
  }

  // GRN Receive Modal handlers
  const openReceiveModal = (order) => {
    const items = (order.fulfillmentDetails || []).map(item => ({
      materialId: item.materialId,
      materialName: materials.find(m => m._id === String(item.materialId))?.name || 'Unknown',
      sku: materials.find(m => m._id === String(item.materialId))?.sku || '',
      deliveredQty: item.deliveredQty,
      receivedQty: item.deliveredQty, // Default to full receipt
      uom: materials.find(m => m._id === String(item.materialId))?.uom || '',
      condition: 'good',
      remarks: ''
    }))
    setReceiveItems(items)
    setGrnNotes('')
    setGrnDeliveryDate(new Date().toISOString().split('T')[0])
    setGrnDeliveryPersonName('')
    setGrnDeliveryPersonContact('')
    setGrnVehicleNumber('')
    setGrnOverallCondition('good')
    setGrnConditionNotes('')
    setGrnReceiverName('')
    setGrnAcknowledgmentNotes('')
    setReceiveModal({ open: true, order })
  }

  const closeReceiveModal = () => {
    setReceiveModal({ open: false, order: null })
    setReceiveItems([])
    setGrnNotes('')
  }

  const updateReceivedQty = (index, qty) => {
    setReceiveItems(prev => prev.map((item, i) => 
      i === index ? { ...item, receivedQty: Number(qty) } : item
    ))
  }

  const updateItemCondition = (index, condition) => {
    setReceiveItems(prev => prev.map((item, i) => 
      i === index ? { ...item, condition } : item
    ))
  }

  const updateItemRemarks = (index, remarks) => {
    setReceiveItems(prev => prev.map((item, i) => 
      i === index ? { ...item, remarks } : item
    ))
  }

  const handleReceiveSubmit = async () => {
    if (!receiveModal.order) return
    try {
      setReceiving(true)
      await api.patch(`/api/purchase-orders/${receiveModal.order._id}/receive`, {
        receivedItems: receiveItems.map(item => ({
          materialId: item.materialId,
          receivedQty: item.receivedQty,
          condition: item.condition,
          remarks: item.remarks
        })),
        notes: grnNotes,
        deliveryDate: grnDeliveryDate,
        deliveryPersonName: grnDeliveryPersonName,
        deliveryPersonContact: grnDeliveryPersonContact,
        vehicleNumber: grnVehicleNumber,
        overallCondition: grnOverallCondition,
        conditionNotes: grnConditionNotes,
        receiverName: grnReceiverName,
        acknowledgmentNotes: grnAcknowledgmentNotes
      })
      setNotify({ open: true, title: 'Success', message: 'GRN submitted. Inventory has been updated.' })
      closeReceiveModal()
      fetchData()
    } catch (error) {
      setNotify({ open: true, title: 'Error', message: error.response?.data?.message || 'Failed to receive.' })
    } finally {
      setReceiving(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
      pending: { bg: 'rgba(251,191,36,0.1)', color: '#f59e0b' },
      approved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
      rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
      fulfilled: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
      received: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
      cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' }
    }
    const s = styles[status] || styles.pending
    return (
      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
        {status}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const styles = {
      low: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
      normal: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      high: { bg: 'rgba(251,191,36,0.1)', color: '#f59e0b' },
      urgent: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' }
    }
    const s = styles[priority] || styles.normal
    return (
      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
        {priority}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading purchase orders...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text)' }}>Purchase Orders</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            {canCreate ? 'Create and manage purchase orders for materials.' : 'Review and process purchase orders.'}
          </p>
        </div>
        {canCreate && (
          <button className="save-btn" onClick={() => setShowModal(true)}>
            + Create Purchase Order
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'fulfilled', 'received', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: filter === f ? 'var(--primary)' : 'var(--card)',
              color: filter === f ? 'white' : 'var(--text)',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '13px',
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--card)', borderRadius: '12px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ color: 'var(--text)', marginBottom: '8px' }}>No Purchase Orders</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {filter !== 'all' ? `No ${filter} orders found.` : 'No purchase orders yet.'}
          </p>
        </div>
      ) : (
        <div className="table" style={{ background: 'var(--card)', borderRadius: '12px', overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Project</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order._id}>
                  <td>
                    <span 
                      style={{ color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
                      onClick={() => navigate(`/purchase-order-detail?id=${order._id}`)}
                      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {order.orderNumber}
                    </span>
                  </td>
                  <td>{order.projectId?.name || '-'}</td>
                  <td>{order.supplier?.name || '-'}</td>
                  <td>{order.items?.length || 0} items</td>
                  <td>{getPriorityBadge(order.priority)}</td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {canReview && order.status === 'pending' && (
                        <>
                          <button className="link-btn" style={{ color: '#10b981' }} onClick={() => handleApprove(order._id)}>Approve</button>
                          <button className="link-btn" style={{ color: '#ef4444' }} onClick={() => handleReject(order._id)}>Reject</button>
                        </>
                      )}
                      {canReview && order.status === 'approved' && (
                        <button className="link-btn" style={{ color: '#6366f1' }} onClick={() => openFulfillModal(order)}>Fulfill</button>
                      )}
                      {canReceive && order.status === 'fulfilled' && (
                        <button className="link-btn" style={{ color: '#10b981' }} onClick={() => openReceiveModal(order)}>Receive (GRN)</button>
                      )}
                      {order.status === 'received' && order.grnNumber && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{order.grnNumber}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Create Purchase Order</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ padding: '20px' }}>
              {/* Project Reference */}
              <div className="form-group">
                <label>Project Reference (Optional)</label>
                <select 
                  value={form.projectId} 
                  onChange={e => setForm({ ...form, projectId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <option value="">-- No Project --</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Supplier Info */}
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Supplier Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Supplier Name</label>
                    <input 
                      type="text" 
                      value={form.supplier.name} 
                      onChange={e => setForm({ ...form, supplier: { ...form.supplier, name: e.target.value } })}
                      placeholder="Supplier company name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Person</label>
                    <input 
                      type="text" 
                      value={form.supplier.contactPerson} 
                      onChange={e => setForm({ ...form, supplier: { ...form.supplier, contactPerson: e.target.value } })}
                      placeholder="Contact name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input 
                      type="text" 
                      value={form.supplier.phone} 
                      onChange={e => setForm({ ...form, supplier: { ...form.supplier, phone: e.target.value } })}
                      placeholder="+971-..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input 
                      type="email" 
                      value={form.supplier.email} 
                      onChange={e => setForm({ ...form, supplier: { ...form.supplier, email: e.target.value } })}
                      placeholder="supplier@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Materials</h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <select 
                    value={selectedMaterial} 
                    onChange={e => setSelectedMaterial(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Select Material --</option>
                    {materials.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({m.sku}) - {m.quantity} {m.uom} in stock</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    min="1"
                    value={selectedQty} 
                    onChange={e => setSelectedQty(Number(e.target.value))}
                    style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                  <button type="button" className="save-btn" onClick={addItem} style={{ padding: '10px 16px' }}>Add</button>
                </div>
                
                {form.items.length > 0 && (
                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Material</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>SKU</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Qty</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>UOM</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, index) => (
                        <tr key={index}>
                          <td style={{ padding: '8px' }}>{item.materialName}</td>
                          <td style={{ padding: '8px', color: 'var(--primary)' }}>{item.sku}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity} 
                              onChange={e => updateItemQty(index, e.target.value)}
                              style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border)' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>{item.uom}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button type="button" className="link-btn" style={{ color: '#ef4444' }} onClick={() => removeItem(index)}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Delivery & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Delivery Date</label>
                  <input 
                    type="date" 
                    value={form.deliveryDate} 
                    onChange={e => setForm({ ...form, deliveryDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select 
                    value={form.priority} 
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="button" className="save-btn" onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Purchase Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fulfill Modal */}
      {fulfillModal.open && fulfillModal.order && (
        <div className="modal-overlay" onClick={closeFulfillModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Fulfill Purchase Order</h2>
              <button onClick={closeFulfillModal} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ padding: '20px' }}>
              {/* Order Info */}
              <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '16px' }}>{fulfillModal.order.orderNumber}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '13px' }}>
                      {fulfillModal.order.supplier?.name || 'No Supplier'}
                    </span>
                  </div>
                  {fulfillModal.order.projectId?.name && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--card)', padding: '4px 8px', borderRadius: '4px' }}>
                      Project: {fulfillModal.order.projectId.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Materials Table */}
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>Materials to Deliver</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  Adjust delivered quantities if different from requested. These will be added to inventory.
                </p>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Material</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>SKU</th>
                      <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Requested</th>
                      <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Delivered</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fulfillItems.map((item, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px' }}>{item.materialName}</td>
                        <td style={{ padding: '8px', color: 'var(--primary)' }}>{item.sku}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.requestedQty}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            min="0"
                            max={item.requestedQty * 2}
                            value={item.deliveredQty} 
                            onChange={e => updateDeliveredQty(index, e.target.value)}
                            style={{ 
                              width: '70px', 
                              padding: '6px', 
                              textAlign: 'center', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border)',
                              background: item.deliveredQty < item.requestedQty ? 'rgba(251,191,36,0.1)' : 'var(--card)'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>{item.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeFulfillModal}>Cancel</button>
                <button type="button" className="save-btn" onClick={handleFulfillSubmit} disabled={fulfilling}>
                  {fulfilling ? 'Fulfilling...' : 'Confirm Fulfillment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRN Receive Modal */}
      {receiveModal.open && receiveModal.order && (
        <div className="modal-overlay" onClick={closeReceiveModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Goods Receipt Note (GRN)</h2>
              <button onClick={closeReceiveModal} className="close-btn">×</button>
            </div>
            <div className="lead-form" style={{ padding: '20px' }}>
              {/* Order Info */}
              <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '16px' }}>{receiveModal.order.orderNumber}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '13px' }}>
                      {receiveModal.order.supplier?.name || 'No Supplier'}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '4px 8px', borderRadius: '4px' }}>
                    Fulfilled by PE
                  </span>
                </div>
              </div>

              {/* Delivery Info Section */}
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>🚚 Delivery Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Delivery Date</label>
                    <input 
                      type="date" 
                      value={grnDeliveryDate} 
                      onChange={e => setGrnDeliveryDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Delivery Person Name</label>
                    <input 
                      type="text" 
                      value={grnDeliveryPersonName} 
                      onChange={e => setGrnDeliveryPersonName(e.target.value)}
                      placeholder="Driver/Courier name"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Contact Number</label>
                    <input 
                      type="text" 
                      value={grnDeliveryPersonContact} 
                      onChange={e => setGrnDeliveryPersonContact(e.target.value)}
                      placeholder="Phone number"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Vehicle Number</label>
                    <input 
                      type="text" 
                      value={grnVehicleNumber} 
                      onChange={e => setGrnVehicleNumber(e.target.value)}
                      placeholder="Vehicle plate"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Materials Table */}
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)' }}>📦 Materials Received</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  Verify received quantities, condition, and add any remarks.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Material</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Delivered</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Received</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>Condition</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveItems.map((item, index) => (
                        <tr key={index}>
                          <td style={{ padding: '8px' }}>
                            <div>{item.materialName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--primary)' }}>{item.sku}</div>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.deliveredQty} {item.uom}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="number" 
                              min="0"
                              max={item.deliveredQty * 2}
                              value={item.receivedQty} 
                              onChange={e => updateReceivedQty(index, e.target.value)}
                              style={{ 
                                width: '70px', 
                                padding: '6px', 
                                textAlign: 'center', 
                                borderRadius: '4px', 
                                border: '1px solid var(--border)',
                                background: item.receivedQty < item.deliveredQty ? 'rgba(251,191,36,0.1)' : 'var(--card)'
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <select 
                              value={item.condition} 
                              onChange={e => updateItemCondition(index, e.target.value)}
                              style={{ 
                                padding: '6px', 
                                borderRadius: '4px', 
                                border: '1px solid var(--border)',
                                background: item.condition === 'good' ? 'rgba(34,197,94,0.1)' : 
                                           item.condition === 'damaged' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                                color: item.condition === 'good' ? '#22c55e' : 
                                       item.condition === 'damaged' ? '#ef4444' : '#f59e0b',
                                fontWeight: '600',
                                fontSize: '12px'
                              }}
                            >
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                              <option value="partial">Partial</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="text" 
                              value={item.remarks}
                              onChange={e => updateItemRemarks(index, e.target.value)}
                              placeholder="Any remarks..."
                              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overall Condition & Receiver */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px' }}>Overall Condition</label>
                  <select 
                    value={grnOverallCondition} 
                    onChange={e => setGrnOverallCondition(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    <option value="good">Good - All items in good condition</option>
                    <option value="partial">Partial - Some items damaged/missing</option>
                    <option value="damaged">Damaged - Significant damage</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px' }}>Receiver Name (Signed By)</label>
                  <input 
                    type="text" 
                    value={grnReceiverName} 
                    onChange={e => setGrnReceiverName(e.target.value)}
                    placeholder="Name of person receiving goods"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              {/* Condition Notes */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px' }}>Condition Notes (Optional)</label>
                <textarea 
                  value={grnConditionNotes} 
                  onChange={e => setGrnConditionNotes(e.target.value)}
                  placeholder="Describe any damage, discrepancies, or issues..."
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              {/* Acknowledgment Notes */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px' }}>Acknowledgment Notes (Optional)</label>
                <textarea 
                  value={grnAcknowledgmentNotes} 
                  onChange={e => setGrnAcknowledgmentNotes(e.target.value)}
                  placeholder="Any final notes or acknowledgment comments..."
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeReceiveModal}>Cancel</button>
                <button type="button" className="save-btn" onClick={handleReceiveSubmit} disabled={receiving}>
                  {receiving ? 'Submitting...' : 'Submit GRN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notify.open && (
        <div className="modal-overlay" onClick={() => setNotify({ open: false, title: '', message: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{notify.title}</h2>
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

export default PurchaseOrderManagement
