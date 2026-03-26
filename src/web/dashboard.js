const API_BASE = 'http://localhost:3000/api'

// Fetch and render appointments
async function loadAgenda() {
  try {
    const res = await fetch(`${API_BASE}/agenda`)
    const data = await res.json()
    
    const tbody = document.getElementById('agenda-body')
    tbody.innerHTML = ''
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay citas pendientes.</td></tr>'
      return
    }

    data.forEach(cita => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td><strong>${cita.nombre || 'Desconocido'}</strong></td>
        <td>${cita.telefono}</td>
        <td>${cita.servicio}</td>
        <td>${cita.fecha}</td>
        <td>${cita.hora}</td>
        <td><span class="badge badge-${cita.estado}">${cita.estado}</span></td>
        <td>
          <button class="btn btn-success" onclick="updateAppointment('${cita.id}', 'completed')">✔️ Completar</button>
          <button class="btn btn-danger" onclick="updateAppointment('${cita.id}', 'cancelled')">❌ Cancelar</button>
        </td>
      `
      tbody.appendChild(tr)
    })
  } catch (error) {
    console.error('Error cargando agenda', error)
  }
}

// Fetch and render orders
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`)
    const data = await res.json()
    
    const tbody = document.getElementById('orders-body')
    tbody.innerHTML = ''
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay pedidos pendientes.</td></tr>'
      return
    }

    data.forEach(order => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${order.cliente}</td>
        <td><strong>${order.productoNombre}</strong></td>
        <td>${order.cantidad}</td>
        <td>${order.total.toLocaleString()}</td>
        <td>${new Date(order.fecha).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-success" onclick="updateOrder('${order.id}', 'delivered')">📦 Entregado</button>
          <button class="btn btn-danger" onclick="updateOrder('${order.id}', 'cancelled')">❌ Cancelar</button>
        </td>
      `
      tbody.appendChild(tr)
    })
  } catch (error) {
    console.error('Error cargando pedidos', error)
  }
}

// Update Appointment Status
async function updateAppointment(id, estado) {
  if(!confirm(`¿Marcar cita como ${estado}?`)) return
  try {
    await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    })
    loadAgenda()
  } catch(e) {
    alert('Error al actualizar')
  }
}

// Update Order Status
async function updateOrder(id, estado) {
  if(!confirm(`¿Marcar pedido como ${estado}?`)) return
  try {
    await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    })
    loadOrders()
  } catch(e) {
    alert('Error al actualizar pedido')
  }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  loadAgenda()
  loadOrders()
  // Refresh every 30 seconds
  setInterval(() => {
    loadAgenda()
    loadOrders()
  }, 30000)
})
