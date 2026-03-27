// application/graph/salonGraph.js
// LangGraph-based conversation engine — reemplaza workflowEngine switch/case
import { Annotation, StateGraph, START, END, MemorySaver, messagesStateReducer } from '@langchain/langgraph'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { db } from '../../infrastructure/database/db.js'
import {
  esDiaLaboral, formatearMenuDisponibilidad, calcularSlotsOcupados,
  generarSlots, filtrarSlotsLibres, validarFecha, validarHora,
  buildAppointmentRecord, getServicio,
} from '../../domain/services/AppointmentService.js'
import { parsearFecha, parsearHora } from '../../NLP/extensorFechas.js'
import { extraerSlots } from '../../agente/slotExtractor.js'
import { SERVICIOS } from '../../constants/servicios.js'
import { logger } from '../../utils/logger.js'

// ── Model (OpenRouter, compatible con API de OpenAI) ─────────────────────────
const model = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free',
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  temperature: 0.3,
  maxRetries: 2,
})

// ── State ────────────────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  messages: Annotation({ reducer: messagesStateReducer, default: () => [] }),
  phone:    Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  intent:   Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  step:     Annotation({ reducer: (a, b) => b ?? a, default: () => 'START' }),
  slots:    Annotation({ reducer: (a, b) => b === null ? {} : ({ ...a, ...b }), default: () => ({}) }),
})

const SYSTEM_PROMPT = `Eres la recepcionista amable y profesional de "Salon Bella".
Responde siempre en español, de forma breve y cálida, con emojis ocasionales.
Solo puedes ayudar con: agendar citas, cancelar citas, precios/servicios, y conversar brevemente.
Nunca inventes fechas, horarios ni precios.`

const serviciosCatalogo = Object.values(SERVICIOS)
  .map(s => `• ${s.nombre} (${s.duracion} min) — ₡${s.precio.toLocaleString()}`)
  .join('\n')

// ── NODO: classify ────────────────────────────────────────────────────────────
const classifyNode = async (state) => {
  // Si ya estamos en un flujo activo, no reclasificar
  if (state.step?.startsWith('BOOKING_') || state.step?.startsWith('CANCEL_')) {
    return {}
  }

  const lastMsg = state.messages.at(-1)
  const text = lastMsg?.content ?? ''

  try {
    const response = await model.invoke([
      new SystemMessage(
        `Clasifica este mensaje en una sola palabra: BOOK, CANCEL, INFO, o GENERAL.\n` +
        `BOOK = quiere agendar/reservar cita.\n` +
        `CANCEL = quiere cancelar cita existente.\n` +
        `INFO = pregunta por precios o servicios.\n` +
        `GENERAL = saludo u otro.\n` +
        `Mensaje: "${text}"\nResponde SOLO la palabra.`
      )
    ])
    const intent = response.content.trim().toUpperCase().replace(/[^A-Z]/g, '')
    const valid = ['BOOK', 'CANCEL', 'INFO', 'GENERAL']
    return { intent: valid.includes(intent) ? intent : 'GENERAL', step: 'CLASSIFIED' }
  } catch {
    return { intent: 'GENERAL', step: 'CLASSIFIED' }
  }
}

// ── NODO: booking ─────────────────────────────────────────────────────────────
const bookingNode = async (state) => {
  const lastMsg = state.messages.at(-1)
  const text = lastMsg?.content ?? ''
  const slots = { ...state.slots }
  const step = state.step

  // Paso de confirmación: esperar sí/no
  if (step === 'BOOKING_CONFIRM') {
    const norm = text.toLowerCase().trim()
    if (norm === 'si' || norm === 'sí') {
      const record = buildAppointmentRecord(state.phone, {
        service: slots.service, date: slots.date,
        time: slots.time, name: slots.name,
      })
      db.insert('appointments', record)
      const srvObj = getServicio(slots.service)
      return {
        messages: [new AIMessage(`✅ *¡Cita confirmada!*\n\nTe esperamos para hacerte *${srvObj?.nombre}*.\nUn día antes te enviaré un recordatorio. ¡Nos vemos pronto! 💅`)],
        step: 'START', intent: null, slots: null,
      }
    }
    if (norm === 'no') {
      return {
        messages: [new AIMessage('❌ Entendido. Cancelamos la solicitud. ¿En qué más te puedo ayudar?')],
        step: 'START', intent: null, slots: null,
      }
    }
    return {
      messages: [new AIMessage('Por favor responde *sí* o *no* para confirmar la cita.')],
      step: 'BOOKING_CONFIRM',
    }
  }

  // Intentar extraer slots del mensaje actual
  const extracted = extraerSlots(text)
  if (extracted.servicio && !slots.service) slots.service = extracted.servicio
  if (extracted.fecha && !slots.date)       slots.date    = extracted.fecha
  if (extracted.hora && !slots.time)        slots.time    = extracted.hora
  if (extracted.nombre && !slots.name)      slots.name    = extracted.nombre

  // Captura de nombre cuando se está pidiendo explícitamente
  if (step === 'BOOKING_ASK_NAME' && !slots.name) {
    const t = text.trim()
    const lower = t.toLowerCase()
    if (t.length > 1 && lower !== 'sí' && lower !== 'si' && lower !== 'no') {
      slots.name = t
    }
  }

  // ── Recolección de slots ───────────────────────────────────────────────────
  if (!slots.service) {
    return {
      slots,
      step: 'BOOKING_ASK_SERVICE',
      messages: [new AIMessage(`💅 ¿Qué servicio te gustaría hacerte?\n\n${serviciosCatalogo}`)],
    }
  }

  if (!slots.date) {
    return {
      slots,
      step: 'BOOKING_ASK_DATE',
      messages: [new AIMessage('📅 ¿Para qué fecha lo agendamos? (ej: mañana, el viernes, 15 de marzo)')],
    }
  }

  const vDate = validarFecha(slots.date)
  if (!vDate.valido) {
    const { date: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_DATE', messages: [new AIMessage(`❌ ${vDate.error}. ¿Qué fecha te sirve mejor?`)] }
  }
  if (!esDiaLaboral(slots.date)) {
    const { date: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_DATE', messages: [new AIMessage('❌ Solo atendemos de lunes a sábado. ¿Deseas otra fecha?')] }
  }

  if (!slots.time) {
    const appointments = db.read('appointments').filter(a => a.fecha === slots.date && a.estado !== 'cancelled')
    const servicio = getServicio(slots.service)
    if (servicio) {
      const bloqueados = calcularSlotsOcupados(appointments, servicio.duracion)
      const libres = filtrarSlotsLibres(generarSlots(slots.date), bloqueados, servicio.duracion)
      if (libres.length === 0) {
        const { date: _, ...rest } = slots
        return { slots: rest, step: 'BOOKING_ASK_DATE', messages: [new AIMessage('❌ No hay espacios disponibles para ese día. ¿Deseas otra fecha?')] }
      }
      return {
        slots,
        step: 'BOOKING_ASK_TIME',
        messages: [new AIMessage(`🕐 Para el ${slots.date} tenemos disponibles:\n\n${formatearMenuDisponibilidad(libres)}\n\n¿A qué hora te queda mejor?`)],
      }
    }
    return { slots, step: 'BOOKING_ASK_TIME', messages: [new AIMessage('🕐 ¿A qué hora te queda mejor? (ej: 2pm, 10:00)')] }
  }

  const vTime = validarHora(slots.time)
  if (!vTime.valido) {
    const { time: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_TIME', messages: [new AIMessage(`❌ ${vTime.error}. ¿A qué hora sería?`)] }
  }

  // Verificar que el slot esté libre
  const servicio = getServicio(slots.service)
  if (servicio) {
    const appointments = db.read('appointments').filter(a => a.fecha === slots.date && a.estado !== 'cancelled')
    const bloqueados = calcularSlotsOcupados(appointments, servicio.duracion)
    const libres = filtrarSlotsLibres(generarSlots(slots.date), bloqueados, servicio.duracion)
    if (!libres.includes(slots.time)) {
      const { time: _, ...rest } = slots
      return {
        slots: rest,
        step: 'BOOKING_ASK_TIME',
        messages: [new AIMessage(`⏰ Ese horario ya está ocupado.\n\nLibres: ${formatearMenuDisponibilidad(libres)}\n\n¿Cuál prefieres?`)],
      }
    }
  }

  if (!slots.name) {
    return { slots, step: 'BOOKING_ASK_NAME', messages: [new AIMessage('👤 ¿A nombre de quién lo anoto?')] }
  }

  // Todos los slots listos → mostrar resumen para confirmar
  const srvObj = getServicio(slots.service)
  const d = new Date(slots.date + 'T12:00:00')
  const diaStr = d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })
  return {
    slots,
    step: 'BOOKING_CONFIRM',
    messages: [new AIMessage(
      `¡Casi listo, ${slots.name}! Así quedaría tu cita:\n\n` +
      `📅 *${diaStr}* a las *${slots.time}*\n` +
      `💇 *${srvObj?.nombre}* · ₡${srvObj?.precio?.toLocaleString()}\n\n` +
      `¿Confirmas? (*sí* / *no*)`
    )],
  }
}

// ── NODO: cancel ──────────────────────────────────────────────────────────────
const cancelNode = async (state) => {
  const lastMsg = state.messages.at(-1)
  const text = lastMsg?.content ?? ''
  const slots = { ...state.slots }
  const step = state.step

  if (step === 'CANCEL_CONFIRM') {
    const norm = text.toLowerCase().trim()
    if (norm === 'si' || norm === 'sí') {
      db.update('appointments', slots.appointmentToCancel.id, { estado: 'cancelled' })
      return {
        messages: [new AIMessage('✅ Tu cita ha sido cancelada exitosamente. ¡Hasta la próxima! 👋')],
        step: 'START', intent: null, slots: null,
      }
    }
    if (norm === 'no') {
      return {
        messages: [new AIMessage('❌ Entendido, tu cita NO fue cancelada. ¡Nos vemos pronto! 😊')],
        step: 'START', intent: null, slots: null,
      }
    }
    return { messages: [new AIMessage('Por favor responde *sí* o *no*.')], step: 'CANCEL_CONFIRM' }
  }

  const citas = db.read('appointments').filter(a => a.cliente === state.phone && a.estado === 'pending')
  if (citas.length === 0) {
    return {
      messages: [new AIMessage('📭 No tienes citas agendadas actualmente para cancelar.')],
      step: 'START', intent: null,
    }
  }

  const cita = citas[0]
  return {
    slots: { ...slots, appointmentToCancel: cita },
    step: 'CANCEL_CONFIRM',
    messages: [new AIMessage(
      `Veo que tienes una cita para *${cita.servicio}* el *${cita.fecha}* a las *${cita.hora}*.\n\n` +
      `¿Estás segur@ de que deseas cancelarla? (*sí* / *no*)`
    )],
  }
}

// ── NODO: info ────────────────────────────────────────────────────────────────
const infoNode = async (state) => {
  const services = db.read('services')
  let lines
  if (services?.length > 0) {
    lines = services.map(s => `• *${s.nombre}* — ₡${s.precio?.toLocaleString()} (${s.duracion} min)`).join('\n')
  } else {
    lines = serviciosCatalogo
  }
  return {
    messages: [new AIMessage(`💅 *Servicios de Salon Bella*\n\n${lines}\n\nPara agendar escribe *"agendar"*. ¿Algo más? 😊`)],
    step: 'START', intent: null,
  }
}

// ── NODO: general ─────────────────────────────────────────────────────────────
const generalNode = async (state) => {
  try {
    // Mantener solo las últimas 6 interacciones para no inflar el contexto
    const history = state.messages.slice(-6)
    const response = await model.invoke([new SystemMessage(SYSTEM_PROMPT), ...history])
    return { messages: [new AIMessage(response.content)], step: 'START' }
  } catch {
    return {
      messages: [new AIMessage("Hola 😊 ¿En qué puedo ayudarte? Escribe *agendar*, *cancelar*, o pregunta por nuestros servicios.")],
      step: 'START',
    }
  }
}

// ── Routing ───────────────────────────────────────────────────────────────────
const routeAfterClassify = (state) => {
  if (state.step?.startsWith('BOOKING_')) return 'booking'
  if (state.step?.startsWith('CANCEL_'))  return 'cancel'
  switch (state.intent) {
    case 'BOOK':   return 'booking'
    case 'CANCEL': return 'cancel'
    case 'INFO':   return 'info'
    default:       return 'general'
  }
}

// ── Compilar grafo ────────────────────────────────────────────────────────────
const checkpointer = new MemorySaver()

const graph = new StateGraph(GraphState)
  .addNode('classify', classifyNode)
  .addNode('booking',  bookingNode)
  .addNode('cancel',   cancelNode)
  .addNode('info',     infoNode)
  .addNode('general',  generalNode)
  .addEdge(START, 'classify')
  .addConditionalEdges('classify', routeAfterClassify, ['booking', 'cancel', 'info', 'general'])
  .addEdge('booking', END)
  .addEdge('cancel',  END)
  .addEdge('info',    END)
  .addEdge('general', END)
  .compile({ checkpointer })

// ── API pública ───────────────────────────────────────────────────────────────
export const processWithGraph = async (phone, text) => {
  const config = { configurable: { thread_id: phone } }

  const result = await graph.invoke(
    { messages: [new HumanMessage(text)], phone },
    config
  )

  const lastAI = [...result.messages]
    .reverse()
    .find(m => m instanceof AIMessage || m.getType?.() === 'ai')

  return lastAI?.content ?? "Lo siento, ocurrió un error. Escribe 'hola' para empezar."
}

export const resetGraph = async (phone) => {
  const config = { configurable: { thread_id: phone } }
  try {
    await graph.updateState(config, { step: 'START', intent: null, slots: null }, 'classify')
  } catch {
    // Si no hay estado previo, ignorar
  }
}
