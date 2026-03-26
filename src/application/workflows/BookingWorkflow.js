// application/workflows/BookingWorkflow.js
import { saveConversationState, clearConversationState } from '../conversation/conversationEngine.js'
import { BOOKING_STATES } from '../conversation/states/BookingStates.js'
import { extraerSlots } from '../../agente/slotExtractor.js'
import { db } from '../../infrastructure/database/db.js'
import {
  esDiaLaboral,
  formatearMenuDisponibilidad,
  calcularSlotsOcupados,
  generarSlots,
  filtrarSlotsLibres,
  validarFecha,
  validarHora,
  buildAppointmentRecord,
  getServicio,
} from '../../domain/services/AppointmentService.js'
import { env } from 'process'

let whatsappClientInstance = null

export const setWhatsappClient = (client) => {
  whatsappClientInstance = client
}

const enviarNotificacionEstilista = async (cita) => {
  if (!whatsappClientInstance) return

  const stylistPhone = env.STYLIST_PHONE
  if (!stylistPhone) return

  const servicio = getServicio(cita.servicio)?.nombre ?? cita.servicio
  const mensajeNotificacion = `🔔 *NUEVA CITA AGENDADA* 🔔\n\nHola Hayssell, te acaban de agendar un campito:\n\n👤 Cliente: ${cita.nombre}\n📱 Teléfono: ${cita.telefono}\n💇 Servicio: ${servicio}\n📅 Fecha: ${cita.fecha}\n🕐 Hora: ${cita.hora}`

  try {
    const chatId = `${stylistPhone}@c.us`
    await whatsappClientInstance.sendMessage(chatId, mensajeNotificacion)
  } catch (error) {
    console.error('[Notificaciones] Error enviando aviso:', error.message)
  }
}

export const bookingWorkflow = (phone, text, state) => {
  const { context } = state
  const actState = state.state

  let extracted = {}
  if (text) {
    extracted = extraerSlots(text)
  }

  if (extracted.servicio) context.service = extracted.servicio
  if (extracted.fecha) context.date = extracted.fecha
  if (extracted.hora) context.time = extracted.hora
  if (extracted.nombre) context.name = extracted.nombre

  switch (actState) {
    case BOOKING_STATES.START:
    case BOOKING_STATES.ASK_SERVICE:
      if (context.date) {
        const slots = generarSlots(context.date)
        if (slots.length === 0) {
          const dateOld = context.date
          delete context.date
          saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
          return `❌ Lo siento, ya no tenemos espacios disponibles para el ${dateOld}. ¿Deseas probar con otra fecha?`
        }
      }

      if (!context.service) {
        saveConversationState(phone, { state: BOOKING_STATES.ASK_SERVICE, context })
        return '💅 ¡Súper! ¿Qué servicio te gustaría hacerte hoy? (Tinte, corte, mechas...)'
      }
      saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
      // fallthrough

    case BOOKING_STATES.ASK_DATE:
      if (!context.date) {
        saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
        return '📅 Perfecto, ¿para qué fecha querías venir? (ej: mañana, el viernes, 15 de marzo)'
      }

      {
        const vDate = validarFecha(context.date)
        if (!vDate.valido) {
          delete context.date
          saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
          return `❌ ${vDate.error}. ¿Qué fecha te sirve mejor?`
        }
        if (!esDiaLaboral(context.date)) {
          delete context.date
          saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
          return '❌ Solo atendemos de lunes a sábado. ¿Deseas buscar otra fecha?'
        }
      }
      saveConversationState(phone, { state: BOOKING_STATES.ASK_TIME, context })
      // fallthrough

    case BOOKING_STATES.ASK_TIME:
      if (!context.time) {
        if (context.service && context.date) {
          const appointments = db.read('appointments').filter(a => a.fecha === context.date && a.estado !== 'cancelled')
          const servicio = getServicio(context.service)
          if (servicio) {
            const bloqueados = calcularSlotsOcupados(appointments, servicio.duracion)
            const todos = generarSlots(context.date)
            const libres = filtrarSlotsLibres(todos, bloqueados, servicio.duracion)

            if (libres.length === 0) {
              const dateOld = context.date
              delete context.date
              saveConversationState(phone, { state: BOOKING_STATES.ASK_DATE, context })
              return `❌ Lo siento, ya no tenemos espacios disponibles para el ${dateOld}. ¿Deseas probar con otra fecha?`
            }

            saveConversationState(phone, { state: BOOKING_STATES.ASK_TIME, context })
            return `🕐 ¡Excelente! Para el ${context.date} tenemos estos espacios disponibles:\n\n${formatearMenuDisponibilidad(libres)}\n\n¿A qué hora te queda mejor?`
          }
        }
        saveConversationState(phone, { state: BOOKING_STATES.ASK_TIME, context })
        return '🕐 Anotado, ¿a qué hora te queda mejor? (ej: 2pm, 10:00)'
      }

      {
        const vTime = validarHora(context.time)
        if (!vTime.valido) {
          delete context.time
          saveConversationState(phone, { state: BOOKING_STATES.ASK_TIME, context })
          return `❌ ${vTime.error}. ¿A qué hora sería?`
        }

        const appointments = db.read('appointments').filter(a => a.fecha === context.date && a.estado !== 'cancelled')
        const servicio = getServicio(context.service)
        if (!servicio) {
          delete context.service
          saveConversationState(phone, { state: BOOKING_STATES.ASK_SERVICE, context })
          return '❌ Ese servicio no existe en nuestro catálogo, prueba con otro como "corte" o "tinte".'
        }

        const bloqueados = calcularSlotsOcupados(appointments, servicio.duracion)
        const todos = generarSlots(context.date)
        const libres = filtrarSlotsLibres(todos, bloqueados, servicio.duracion)

        if (!libres.includes(context.time)) {
          delete context.time
          saveConversationState(phone, { state: BOOKING_STATES.ASK_TIME, context })
          return `⏰ Ese horario ya está ocupado.\n\nLibres: ${formatearMenuDisponibilidad(libres)}\n\n¿Cuál prefieres?`
        }
      }

      saveConversationState(phone, { state: BOOKING_STATES.ASK_NAME, context })
      // fallthrough

    case BOOKING_STATES.ASK_NAME:
      if (!context.name && text && text.trim().length > 1 && text.trim().toLowerCase() !== 'sí' && text.trim().toLowerCase() !== 'no') {
        context.name = text.trim()
      }

      if (!context.name) {
        saveConversationState(phone, { state: BOOKING_STATES.ASK_NAME, context })
        return '👤 Para guardar tu campito, ¿A nombre de quién lo anoto?'
      }

      saveConversationState(phone, { state: BOOKING_STATES.CONFIRM_APPOINTMENT, context })
      // fallthrough

    case BOOKING_STATES.CONFIRM_APPOINTMENT:
      if (actState === BOOKING_STATES.CONFIRM_APPOINTMENT) {
        if (text.toLowerCase() === 'si' || text.toLowerCase() === 'sí') {
          saveConversationState(phone, { state: BOOKING_STATES.SAVE_APPOINTMENT, context })
          return bookingWorkflow(phone, text, { state: BOOKING_STATES.SAVE_APPOINTMENT, context })
        } else if (text.toLowerCase() === 'no') {
          clearConversationState(phone)
          return '❌ Entendido. Cancelamos esta solicitud. Puedes escribir "hola" para volver a empezar.'
        } else {
          return 'Por favor responde *sí* o *no* para confirmar la cita.'
        }
      }

      {
        const d = new Date(context.date + 'T12:00:00')
        const diaStr = `${d.toLocaleDateString('es-CR', { weekday: 'long' })} ${d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })}`
        const srvObj = getServicio(context.service)

        return `¡Casi listo, ${context.name}! Así quedaría tu cita:\n\n📅 *${diaStr}* a las *${context.time}*\n💇 *${srvObj.nombre}* · ₡${srvObj.precio.toLocaleString()}\n\n¿Me confirmas si te lo dejo así? (*sí* / *no*)`
      }

    case BOOKING_STATES.SAVE_APPOINTMENT: {
      const record = buildAppointmentRecord(phone, context)
      const newAppt = db.insert('appointments', record)

      enviarNotificacionEstilista(newAppt)

      clearConversationState(phone)
      const srvObj = getServicio(context.service)
      return `✅ *¡Cita confirmada!*\n\nTe esperamos para hacerte *${srvObj?.nombre}*.\nUn día antes te enviaré un recordatorio. ¡Nos vemos pronto! 💅`
    }

    default:
      clearConversationState(phone)
      return 'Ocurrió un error. El proceso ha sido cancelado.'
  }
}
