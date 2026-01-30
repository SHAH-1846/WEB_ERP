import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Spinner } from './LoadingComponents'

function PurchaseOrderDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('id')
  
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notify, setNotify] = useState({ open: false, title: '', message: '' })
  
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const roles = user.roles || []
  const isIM = roles.includes('inventory_manager')
  const isPE = roles.includes('procurement_engineer')
  const isAdmin = roles.includes('admin')
  const isManager = roles.includes('manager')
  
  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId])
  
  const fetchOrder = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/purchase-orders/${orderId}`)
      setOrder(res.data)
    } catch (error) {
      console.error('Error fetching order:', error)
      setNotify({ open: true, title: 'Error', message: 'Failed to load purchase order.' })
    } finally {
      setLoading(false)
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
      <span style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
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
      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
        {priority}
      </span>
    )
  }
  
  const getConditionBadge = (condition) => {
    const styles = {
      good: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
      damaged: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
      partial: { bg: 'rgba(251,191,36,0.1)', color: '#f59e0b' }
    }
    const s = styles[condition] || styles.good
    return (
      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
        {condition}
      </span>
    )
  }
  
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spinner />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading purchase order...</p>
      </div>
    )
  }
  
  if (!order) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text)' }}>Purchase Order Not Found</h2>
        <button className="save-btn" onClick={() => navigate('/purchase-orders')} style={{ marginTop: '16px' }}>
          Back to Purchase Orders
        </button>
      </div>
    )
  }
  
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <button 
            onClick={() => navigate('/purchase-orders')} 
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ← Back to Purchase Orders
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, color: 'var(--text)', fontSize: '28px' }}>{order.orderNumber}</h1>
            {getStatusBadge(order.status)}
            {getPriorityBadge(order.priority)}
          </div>
          {order.grnNumber && (
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              GRN: <strong style={{ color: 'var(--text)' }}>{order.grnNumber}</strong>
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Created</p>
          <p style={{ margin: '4px 0', color: 'var(--text)', fontWeight: '600' }}>
            {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      
      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Supplier Info */}
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>🏢 Supplier Information</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Company</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)', fontWeight: '600' }}>{order.supplier?.name || '-'}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Contact Person</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.supplier?.contactPerson || '-'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Phone</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.supplier?.phone || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Email</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.supplier?.email || '-'}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Order Details */}
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📋 Order Details</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {order.projectId && (
              <div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Project</p>
                <p style={{ margin: '4px 0 0', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
                   onClick={() => navigate(`/project-detail?id=${order.projectId._id}`)}>
                  {order.projectId.name}
                </p>
              </div>
            )}
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Expected Delivery</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>
                {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Created By</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.createdBy?.name || '-'}</p>
            </div>
            {order.notes && (
              <div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Notes</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Items Table */}
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📦 Order Items</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Material</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>SKU</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Ordered</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Delivered</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Received</th>
                <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Condition</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const fulfillment = order.fulfillmentDetails?.find(f => String(f.materialId) === String(item.materialId?._id || item.materialId))
                const received = order.receivedItems?.find(r => String(r.materialId) === String(item.materialId?._id || item.materialId))
                return (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', color: 'var(--text)', fontWeight: '500' }}>
                      {item.materialName || item.materialId?.name || 'Unknown'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--primary)' }}>{item.sku || item.materialId?.sku || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--text)' }}>
                      {item.quantity} {item.uom}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: fulfillment ? '#6366f1' : 'var(--text-muted)' }}>
                      {fulfillment ? `${fulfillment.deliveredQty} ${item.uom}` : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: received ? '#22c55e' : 'var(--text-muted)', fontWeight: received ? '600' : '400' }}>
                      {received ? `${received.receivedQty} ${item.uom}` : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {received?.condition ? getConditionBadge(received.condition) : '-'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {received?.remarks || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Timeline */}
      <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📅 Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Created */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '14px' }}>📝</div>
            <div>
              <p style={{ margin: 0, color: 'var(--text)', fontWeight: '600' }}>Created</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                {new Date(order.createdAt).toLocaleString()} by {order.createdBy?.name || 'Unknown'}
              </p>
            </div>
          </div>
          
          {/* Reviewed */}
          {order.reviewedAt && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: order.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: order.status === 'rejected' ? '#ef4444' : '#10b981', fontSize: '14px' }}>
                {order.status === 'rejected' ? '❌' : '✅'}
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text)', fontWeight: '600' }}>{order.status === 'rejected' ? 'Rejected' : 'Approved'}</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {new Date(order.reviewedAt).toLocaleString()} by {order.reviewedBy?.name || 'Unknown'}
                </p>
                {order.reviewNotes && <p style={{ margin: '4px 0 0', color: 'var(--text)', fontSize: '13px' }}>{order.reviewNotes}</p>}
              </div>
            </div>
          )}
          
          {/* Fulfilled */}
          {order.fulfilledAt && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: '14px' }}>🚚</div>
              <div>
                <p style={{ margin: 0, color: 'var(--text)', fontWeight: '600' }}>Fulfilled</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {new Date(order.fulfilledAt).toLocaleString()} by {order.fulfilledBy?.name || 'Unknown'}
                </p>
              </div>
            </div>
          )}
          
          {/* Received */}
          {order.receivedAt && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontSize: '14px' }}>📥</div>
              <div>
                <p style={{ margin: 0, color: 'var(--text)', fontWeight: '600' }}>Received (GRN: {order.grnNumber})</p>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {new Date(order.receivedAt).toLocaleString()} by {order.receivedBy?.name || 'Unknown'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* GRN Details (if received) */}
      {order.status === 'received' && (
        <div style={{ background: 'var(--card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '16px' }}>📋 Goods Receipt Note Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>GRN Number</p>
              <p style={{ margin: '4px 0 0', color: 'var(--primary)', fontWeight: '700', fontSize: '18px' }}>{order.grnNumber}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Delivery Date</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>
                {order.grnDeliveryDate ? new Date(order.grnDeliveryDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Delivery Person</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnDeliveryPersonName || '-'}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Contact</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnDeliveryPersonContact || '-'}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Vehicle Number</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnVehicleNumber || '-'}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Overall Condition</p>
              <p style={{ margin: '4px 0 0' }}>{order.grnOverallCondition ? getConditionBadge(order.grnOverallCondition) : '-'}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Receiver Name</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnReceiverName || '-'}</p>
            </div>
          </div>
          {order.grnConditionNotes && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Condition Notes</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnConditionNotes}</p>
            </div>
          )}
          {order.grnAcknowledgmentNotes && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Acknowledgment Notes</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnAcknowledgmentNotes}</p>
            </div>
          )}
          {order.grnNotes && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>GRN Notes</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{order.grnNotes}</p>
            </div>
          )}
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

export default PurchaseOrderDetail
