import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { CreateQuotationModal } from './CreateQuotationModal'
import '../design-system'

function QuotationModal() {
  const navigate = useNavigate()
  const location = useLocation()
  const { leadId } = useParams()
  const backgroundLocation = location.state?.backgroundLocation
  const [leads, setLeads] = useState([])

  useEffect(() => {
    void fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/leads')
      setLeads(res.data)
    } catch {}
  }

  const handleSave = async (payload, editing) => {
    if (editing) {
      await api.put(`/api/quotations/${editing._id}`, payload)
    } else {
      await api.post('/api/quotations', payload)
    }
  }

  const handleClose = () => {
    // Use navigate(-1) to go back to the background location, preserving the Leads list
    if (backgroundLocation) {
      navigate(-1)
    } else {
      navigate('/leads', { replace: true })
    }
  }

  return (
    <CreateQuotationModal
      isOpen={true}
      onClose={handleClose}
      onSave={handleSave}
      preSelectedLeadId={leadId}
      leads={leads}
    />
  )
}

export default QuotationModal
