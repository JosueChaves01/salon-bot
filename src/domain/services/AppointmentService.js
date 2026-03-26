// domain/services/AppointmentService.js
// Pure business logic — receives data, returns results. No DB or infrastructure imports.

import { SERVICIOS, ESTILISTAS } from '../../constants/servicios.js'
import { DIAS_LABORALES, HORA_APERTURA, HORA_CIERRE, DURACION_SLOT_MIN } from '../../constants/horarios.js'

// ── Validation ────────────────────────────────────────────────────────────────

export const validarFecha = (fechaStr) => {
  const fecha = new Date(fechaStr + 'T12:00:00')
  if (isNaN(fecha.getTime())) return { valido: false, error: 'Fecha inválida' }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (fecha < hoy) return { valido: false, error: 'La fecha ya pasó' }

  return { valido: true }
}

export const validarHora = (horaStr) => {
  const regex = /^\d{2}:\d{2}$/
  if (!regex.test(horaStr)) return { valido: false, error: 'Formato de hora inválido (usa HH:MM)' }

  const [h] = horaStr.split(':').map(Number)
  if (h < HORA_APERTURA || h >= HORA_CIERRE) {
    return { valido: false, error: `Horario fuera de rango (${HORA_APERTURA}:00 - ${HORA_CIERRE}:00)` }
  }

  return { valido: true }
}

export const validarServicio = (clave) => {
  if (!SERVICIOS[clave]) return { valido: false, error: `Servicio "${clave}" no existe` }
  return { valido: true }
}

export const validarEstilista = (clave) => {
  if (!ESTILISTAS[clave]) return { valido: false, error: `Estilista "${clave}" no existe` }
  return { valido: true }
}

// ── Availability ──────────────────────────────────────────────────────────────

export const esDiaLaboral = (fechaStr) => {
  const f = new Date(fechaStr + 'T12:00:00')
  const dia = f.getDay()
  return DIAS_LABORALES.includes(dia)
}

export const generarSlots = (fechaStr) => {
  const slots = []
  let h = HORA_APERTURA
  let m = 0

  while (h < HORA_CIERRE) {
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    slots.push(`${hh}:${mm}`)

    m += DURACION_SLOT_MIN
    if (m >= 60) {
      h += 1
      m = 0
    }
  }
  return slots
}

export const calcularSlotsOcupados = (appointments, duracionNueva) => {
  const ocupados = new Set()

  for (const app of appointments) {
    const [h, m] = app.hora.split(':').map(Number)
    let currentMin = h * 60 + m
    const endMin = currentMin + app.duracion

    while (currentMin < endMin) {
      const hh = String(Math.floor(currentMin / 60)).padStart(2, '0')
      const mm = String(currentMin % 60).padStart(2, '0')
      ocupados.add(`${hh}:${mm}`)
      currentMin += DURACION_SLOT_MIN
    }
  }
  return Array.from(ocupados)
}

export const filtrarSlotsLibres = (todos, bloqueados, duracionNueva) => {
  return todos.filter(slot => {
    if (bloqueados.includes(slot)) return false

    const [h, m] = slot.split(':').map(Number)
    const slotMin = h * 60 + m
    const endMin = slotMin + duracionNueva

    if (endMin > HORA_CIERRE * 60) return false

    let checkMin = slotMin
    while (checkMin < endMin) {
      const hh = String(Math.floor(checkMin / 60)).padStart(2, '0')
      const mm = String(checkMin % 60).padStart(2, '0')
      if (bloqueados.includes(`${hh}:${mm}`)) return false
      checkMin += DURACION_SLOT_MIN
    }

    return true
  })
}

export const formatearMenuDisponibilidad = (libres) => {
  if (libres.length === 0) return 'No hay espacios disponibles.'
  return libres.join(' | ')
}

// ── Appointment building ──────────────────────────────────────────────────────

export const buildAppointmentRecord = (phone, context) => {
  return {
    cliente: phone,
    telefono: phone,
    servicio: context.service,
    estilista: 'HAYSSELL',
    fecha: context.date,
    hora: context.time,
    nombre: context.name,
    duracion: SERVICIOS[context.service]?.duracion ?? 60,
    estado: 'pending',
  }
}

export const getServicio = (clave) => SERVICIOS[clave] ?? null

export const getServiciosList = () => SERVICIOS
