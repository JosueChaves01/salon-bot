// adapters/web/webController.js
import express from 'express'
import cors from 'cors'
import path from 'path'
import { db } from '../../infrastructure/database/db.js'
import { processMessage } from '../../application/workflowEngine.js'
import { logger } from '../../utils/logger.js'

const app = express()
app.use(cors())
app.use(express.json())

// Configure Content-Security-Policy for local DevTools
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws: http:;"
  )
  next()
})

// Serve static files from the 'src/web' directory
const staticPath = path.join(process.cwd(), 'src', 'web')
app.use(express.static(staticPath))

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard.html')
})

// API Endpoints
app.get('/api/agenda', (req, res) => {
  const allAppointments = db.read('appointments')
  const active = allAppointments.filter(a => a.estado !== 'cancelled' && a.estado !== 'completed')
  res.json(active)
})

app.get('/api/orders', (req, res) => {
  const allOrders = db.read('orders')
  const active = allOrders.filter(o => o.estado === 'pending')
  res.json(active)
})

app.patch('/api/appointments/:id', (req, res) => {
  const { id } = req.params
  const { estado } = req.body
  const updated = db.update('appointments', id, { estado })
  res.json(updated)
})

app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params
  const { estado } = req.body
  const updated = db.update('orders', id, { estado })
  res.json(updated)
})

// Web chat simulator endpoint
app.post('/api/chat', async (req, res) => {
  const { phone, text } = req.body
  if (!phone || !text) {
    return res.status(400).json({ error: 'Falta phone o text' })
  }

  try {
    const reply = await processMessage(phone, text)
    res.json({ reply })
  } catch (error) {
    logger.error('WebChat', 'Error procesando el mensaje', error.message)
    res.status(500).json({ error: 'Error procesando el mensaje' })
  }
})

export const startWebDashboard = () => {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    logger.info('Dashboard', `Servidor local corriendo en http://localhost:${PORT}`)
  })
}
