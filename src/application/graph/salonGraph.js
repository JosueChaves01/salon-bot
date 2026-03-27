// application/graph/salonGraph.js
import { Annotation, StateGraph, START, END, MemorySaver, messagesStateReducer } from '@langchain/langgraph'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { db } from '../../infrastructure/database/db.js'
import {
  esDiaLaboral, formatearMenuDisponibilidad, calcularSlotsOcupados,
  generarSlots, filtrarSlotsLibres, validarFecha, validarHora,
  buildAppointmentRecord, getServicio,
} from '../../domain/services/AppointmentService.js'
import { parsearFecha, parsearHora, parsearRangoFechas } from '../../NLP/extensorFechas.js'
import { extraerSlots } from '../../agente/slotExtractor.js'
import { SERVICIOS } from '../../constants/servicios.js'
import { logger } from '../../utils/logger.js'

// ── Model ─────────────────────────────────────────────────────────────────────
const model = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free',
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  temperature: 0.3,
  maxRetries: 2,
})

// ── State ─────────────────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  messages: Annotation({ reducer: messagesStateReducer, default: () => [] }),
  phone:    Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  intent:   Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  step:     Annotation({ reducer: (a, b) => b ?? a, default: () => 'START' }),
  slots:    Annotation({ reducer: (a, b) => b === null ? {} : ({ ...a, ...b }), default: () => ({}) }),
})

// ── Catálogos por categoría ────────────────────────────────────────────────────
const CATEGORIAS = {
  CORTE: {
    keys: ['CORTE_DAMA', 'CORTE_CABALLERO'],
    kw:   ['corte', 'pelo corto', 'cortar'],
  },
  CABELLO: {
    keys: ['TINTE', 'MECHAS', 'TRATAMIENTO', 'PEINADO'],
    kw:   ['tinte', 'mechas', 'highlights', 'tratamiento', 'peinado', 'cabello', 'color', 'tintura'],
  },
  BELLEZA: {
    keys: ['MANICURE', 'PEDICURE', 'MAQUILLAJE'],
    kw:   ['manicure', 'pedicure', 'maquillaje', 'uñas', 'unias', 'maquilla'],
  },
}

const catalogoPorKeys = (keys) =>
  keys.map(k => {
    const s = SERVICIOS[k]
    return `• *${s.nombre}* (${s.duracion} min) — ₡${s.precio.toLocaleString()}`
  }).join('\n')

const detectarCategoria = (text) => {
  const t = text.toLowerCase()
  for (const [cat, { kw }] of Object.entries(CATEGORIAS)) {
    if (kw.some(k => t.includes(k))) return cat
  }
  return null
}

const SYSTEM_PROMPT = `Eres la recepcionista amable de "Salon Bella". Responde en español, breve y cálida, con emojis ocasionales.`

const MSG_BIENVENIDA =
  `¡Hola! 👋 Bienvenido/a a *Salon Bella*.\n\n` +
  `¿En qué puedo ayudarte hoy?\n` +
  `- Si deseas *agendar un servicio*, escribe *"agendar"*.\n` +
  `- Si prefieres ver nuestras *opciones de menú o servicios*, escribe *"menu"*.\n\n` +
  `¡Estoy aquí para lo que necesites! 😊`

// ── Keywords para clasificación local (sin LLM) ───────────────────────────────
const BOOK_KW       = ['agendar', 'reservar', 'cita', 'turno', 'apartar', 'quiero hacerme', 'necesito servicio', 'quiero servicio', 'agendar cita', 'hacer cita', 'sacar cita']
const CANCEL_KW     = ['cancelar', 'anular', 'cancela', 'quiero cancelar']
const INFO_KW       = ['precio', 'cuesta', 'costo', 'cuánto', 'cuanto', 'que servicios', 'qué servicios', 'servicios tienen', 'qué hacen', 'que hacen', 'qué ofrecen']
const AVAIL_KW      = ['disponibilidad', 'disponible', 'hay espacio', 'hay lugar', 'tienen espacio', 'horarios disponibles', 'qué días', 'que dias']

const classifyLocal = (text) => {
  const t = text.toLowerCase()
  if (BOOK_KW.some(k => t.includes(k)))   return 'BOOK'
  if (CANCEL_KW.some(k => t.includes(k))) return 'CANCEL'
  if (INFO_KW.some(k => t.includes(k)))   return 'INFO'
  if (AVAIL_KW.some(k => t.includes(k)))  return 'BOOK' // disponibilidad también inicia flujo booking
  return null
}

// ── Helper: disponibilidad de un rango de fechas ──────────────────────────────
const mostrarDisponibilidadRango = (inicio, fin, serviceKey) => {
  const lines = []
  const current = new Date(inicio + 'T12:00:00')
  const end     = new Date(fin + 'T12:00:00')
  const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

  while (current <= end) {
    const iso  = current.toISOString().slice(0, 10)
    const dia  = DIAS_ES[current.getDay()]
    const label = `${dia} ${current.getDate()} ${MESES_ES[current.getMonth()]}`

    if (!esDiaLaboral(iso)) {
      current.setDate(current.getDate() + 1)
      continue // omitir domingos silenciosamente
    }

    const appointments = db.read('appointments').filter(a => a.fecha === iso && a.estado !== 'cancelled')
    const servicio     = serviceKey ? getServicio(serviceKey) : null
    const duracion     = servicio?.duracion ?? 60
    const bloqueados   = calcularSlotsOcupados(appointments, duracion)
    const libres       = filtrarSlotsLibres(generarSlots(iso), bloqueados, duracion)

    if (libres.length === 0) {
      lines.push(`❌ *${label}*: sin disponibilidad`)
    } else {
      lines.push(`✅ *${label}*: ${libres.join(' | ')}`)
    }

    current.setDate(current.getDate() + 1)
  }

  return lines.length > 0 ? lines.join('\n') : 'No hay días laborales en ese rango.'
}

// ── NODO: classify ────────────────────────────────────────────────────────────
const classifyNode = async (state) => {
  const currentStep = state.step ?? 'null'
  const msgCount = state.messages?.length ?? 0

  // No reclasificar si ya estamos en un flujo activo
  if (state.step?.startsWith('BOOKING_') || state.step?.startsWith('CANCEL_')) {
    logger.info('Graph:classify', `skip — step=${currentStep}`)
    return {}
  }

  const lastMsg = state.messages?.at(-1)
  const text = lastMsg?.content ?? ''
  logger.info('Graph:classify', `step=${currentStep} msgs=${msgCount} text="${text}"`)

  // 1. Clasificación local por palabras clave (rápida y confiable)
  const local = classifyLocal(text)
  if (local) {
    logger.info('Graph:classify', `local → ${local}`)
    return { intent: local, step: 'CLASSIFIED' }
  }

  // 2. LLM como fallback para frases ambiguas
  try {
    const res = await model.invoke([
      new SystemMessage(
        `Clasifica este mensaje en UNA sola palabra: BOOK, CANCEL, INFO, o GENERAL.\n` +
        `BOOK=agendar cita. CANCEL=cancelar cita. INFO=precios/servicios. GENERAL=otro.\n` +
        `Mensaje: "${text}"\nResponde SOLO la palabra, sin puntuación.`
      )
    ])
    const intent = res.content.trim().toUpperCase().replace(/[^A-Z]/g, '')
    const resolved = ['BOOK', 'CANCEL', 'INFO', 'GENERAL'].includes(intent) ? intent : 'GENERAL'
    logger.info('Graph:classify', `llm → ${resolved}`)
    return { intent: resolved, step: 'CLASSIFIED' }
  } catch (e) {
    logger.warn('Graph:classify', `llm error → GENERAL: ${e.message}`)
    return { intent: 'GENERAL', step: 'CLASSIFIED' }
  }
}

// ── NODO: booking ─────────────────────────────────────────────────────────────
const bookingNode = async (state) => {
  const text  = state.messages.at(-1)?.content ?? ''
  const slots = { ...state.slots }
  const step  = state.step

  // ── Confirmación de cita ──────────────────────────────────────────────────
  if (step === 'BOOKING_CONFIRM') {
    const norm = text.toLowerCase().trim()
    if (norm === 'si' || norm === 'sí') {
      const record = buildAppointmentRecord(state.phone, {
        service: slots.service, date: slots.date, time: slots.time, name: slots.name,
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
    return { messages: [new AIMessage('Por favor responde *sí* o *no* para confirmar la cita.')], step: 'BOOKING_CONFIRM' }
  }

  // ── Extraer slots del texto actual ────────────────────────────────────────
  const extracted = extraerSlots(text)
  if (extracted.servicio && !slots.service) slots.service = extracted.servicio
  if (extracted.fecha   && !slots.date)    slots.date    = extracted.fecha
  if (extracted.hora    && !slots.time)    slots.time    = extracted.hora
  if (extracted.nombre  && !slots.name)    slots.name    = extracted.nombre

  // Captura de nombre cuando se espera respuesta libre
  if (step === 'BOOKING_ASK_NAME' && !slots.name) {
    const t = text.trim()
    if (t.length > 1 && !['sí','si','no'].includes(t.toLowerCase())) slots.name = t
  }

  // ── Verificar si el usuario pregunta por disponibilidad en un rango ────────
  const rango = parsearRangoFechas(text)
  if (rango && (step === 'BOOKING_ASK_DATE' || step === 'BOOKING_ASK_SERVICE' || step === 'CLASSIFIED' || step === 'START')) {
    const resumen = mostrarDisponibilidadRango(rango.inicio, rango.fin, slots.service ?? null)
    const extra   = slots.service
      ? `\nPara agendar, dime qué día te queda mejor. 😊`
      : `\nCuando elijas un día, también dime el servicio que deseas. 😊`
    return {
      slots,
      step: slots.service ? 'BOOKING_ASK_DATE' : 'BOOKING_ASK_SERVICE',
      messages: [new AIMessage(`📅 *Disponibilidad ${rango.inicio} → ${rango.fin}:*\n\n${resumen}${extra}`)],
    }
  }

  // ── Recolección de slots ──────────────────────────────────────────────────
  if (!slots.service) {
    const cat = detectarCategoria(text)
    if (cat) {
      const label = cat === 'CORTE' ? 'corte' : cat === 'CABELLO' ? 'cabello' : 'uñas y belleza'
      return {
        slots, step: 'BOOKING_ASK_SERVICE',
        messages: [new AIMessage(`💅 ¡Perfecto! Estos son nuestros servicios de ${label}:\n\n${catalogoPorKeys(CATEGORIAS[cat].keys)}\n\n¿Cuál prefieres?`)],
      }
    }
    return {
      slots, step: 'BOOKING_ASK_SERVICE',
      messages: [new AIMessage(`💅 ¡Perfecto! ¿Qué servicio te gustaría hacerte hoy?\n_(Tinte, corte, mechas, manicure...)_`)],
    }
  }

  if (!slots.date) {
    return {
      slots, step: 'BOOKING_ASK_DATE',
      messages: [new AIMessage('📅 ¿Para qué fecha lo agendamos? (ej: mañana, el viernes, 15 de abril)')],
    }
  }

  // Validar fecha
  const vDate = validarFecha(slots.date)
  if (!vDate.valido) {
    const { date: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_DATE', messages: [new AIMessage(`❌ ${vDate.error}. ¿Qué fecha te sirve mejor?`)] }
  }
  if (!esDiaLaboral(slots.date)) {
    const { date: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_DATE', messages: [new AIMessage('❌ Solo atendemos de lunes a sábado. ¿Deseas otra fecha?')] }
  }

  // ── Mostrar horarios disponibles para el día elegido ──────────────────────
  if (!slots.time) {
    const appointments = db.read('appointments').filter(a => a.fecha === slots.date && a.estado !== 'cancelled')
    const servicio     = getServicio(slots.service)
    const duracion     = servicio?.duracion ?? 60
    const bloqueados   = calcularSlotsOcupados(appointments, duracion)
    const libres       = filtrarSlotsLibres(generarSlots(slots.date), bloqueados, duracion)

    if (libres.length === 0) {
      // Buscar próximas fechas disponibles (hasta 14 días adelante)
      const proximasLibres = []
      const base = new Date(slots.date + 'T12:00:00')
      for (let i = 1; i <= 30 && proximasLibres.length < 3; i++) {
        const next = new Date(base)
        next.setDate(base.getDate() + i)
        const iso = next.toISOString().slice(0, 10)
        if (!esDiaLaboral(iso)) continue
        const appts = db.read('appointments').filter(a => a.fecha === iso && a.estado !== 'cancelled')
        const bloq  = calcularSlotsOcupados(appts, duracion)
        const sl    = filtrarSlotsLibres(generarSlots(iso), bloq, duracion)
        if (sl.length > 0) {
          const d = new Date(iso + 'T12:00:00')
          const DIAS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
          const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
          proximasLibres.push(`• *${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_ES[d.getMonth()]}* — ${sl.slice(0,4).join(' | ')}`)
        }
      }
      const { date: _, ...rest } = slots
      const sugerencias = proximasLibres.length > 0
        ? `\n\nLas próximas fechas con disponibilidad son:\n${proximasLibres.join('\n')}\n\n¿Te queda bien alguna de esas?`
        : '\n\n¿Tienes otra fecha en mente?'
      return {
        slots: rest, step: 'BOOKING_ASK_DATE',
        messages: [new AIMessage(`❌ No hay espacios disponibles para el *${slots.date}*.${sugerencias}`)],
      }
    }

    return {
      slots, step: 'BOOKING_ASK_TIME',
      messages: [new AIMessage(`🕐 Para el *${slots.date}* tenemos disponibles:\n\n${formatearMenuDisponibilidad(libres)}\n\n¿A qué hora te queda mejor?`)],
    }
  }

  // Validar hora
  const vTime = validarHora(slots.time)
  if (!vTime.valido) {
    const { time: _, ...rest } = slots
    return { slots: rest, step: 'BOOKING_ASK_TIME', messages: [new AIMessage(`❌ ${vTime.error}. ¿A qué hora sería?`)] }
  }

  // Verificar que el slot esté libre
  const servicio = getServicio(slots.service)
  if (servicio) {
    const appointments = db.read('appointments').filter(a => a.fecha === slots.date && a.estado !== 'cancelled')
    const bloqueados   = calcularSlotsOcupados(appointments, servicio.duracion)
    const libres       = filtrarSlotsLibres(generarSlots(slots.date), bloqueados, servicio.duracion)
    if (!libres.includes(slots.time)) {
      const { time: _, ...rest } = slots
      return {
        slots: rest, step: 'BOOKING_ASK_TIME',
        messages: [new AIMessage(`⏰ Ese horario ya está ocupado.\n\nLibres: ${formatearMenuDisponibilidad(libres)}\n\n¿Cuál prefieres?`)],
      }
    }
  }

  if (!slots.name) {
    return { slots, step: 'BOOKING_ASK_NAME', messages: [new AIMessage('👤 ¿A nombre de quién lo anoto?')] }
  }

  // ── Mostrar resumen para confirmar ────────────────────────────────────────
  const srvObj = getServicio(slots.service)
  const d      = new Date(slots.date + 'T12:00:00')
  const diaStr = d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })
  return {
    slots, step: 'BOOKING_CONFIRM',
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
  const text  = state.messages.at(-1)?.content ?? ''
  const slots = { ...state.slots }
  const step  = state.step

  if (step === 'CANCEL_CONFIRM') {
    const norm = text.toLowerCase().trim()
    if (norm === 'si' || norm === 'sí') {
      db.update('appointments', slots.appointmentToCancel.id, { estado: 'cancelled' })
      return { messages: [new AIMessage('✅ Tu cita ha sido cancelada exitosamente. ¡Hasta la próxima! 👋')], step: 'START', intent: null, slots: null }
    }
    if (norm === 'no') {
      return { messages: [new AIMessage('❌ Entendido, tu cita NO fue cancelada. ¡Nos vemos pronto! 😊')], step: 'START', intent: null, slots: null }
    }
    return { messages: [new AIMessage('Por favor responde *sí* o *no*.')], step: 'CANCEL_CONFIRM' }
  }

  const citas = db.read('appointments').filter(a => a.cliente === state.phone && a.estado === 'pending')
  if (citas.length === 0) {
    return { messages: [new AIMessage('📭 No tienes citas agendadas actualmente para cancelar.')], step: 'START', intent: null }
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
const infoNode = async (_state) => {
  const catalogo =
    `✂️ *Corte*\n${catalogoPorKeys(CATEGORIAS.CORTE.keys)}\n\n` +
    `💇 *Cabello*\n${catalogoPorKeys(CATEGORIAS.CABELLO.keys)}\n\n` +
    `💅 *Uñas y Belleza*\n${catalogoPorKeys(CATEGORIAS.BELLEZA.keys)}`
  return {
    messages: [new AIMessage(`*Servicios de Salon Bella* 💇‍♀️\n\n${catalogo}\n\nPara agendar escribe *"agendar"*. ¿Algo más? 😊`)],
    step: 'START', intent: null,
  }
}

// ── NODO: general ─────────────────────────────────────────────────────────────
const GREETING_KW = ['hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas', 'hey', 'hi', 'buen dia', 'buen día']

const generalNode = async (state) => {
  const text = state.messages.at(-1)?.content ?? ''
  const t    = text.toLowerCase().trim()

  if (GREETING_KW.some(k => t.includes(k)) || t === 'menu' || t === 'menú') {
    return { messages: [new AIMessage(MSG_BIENVENIDA)], step: 'START' }
  }

  try {
    const history  = state.messages.slice(-6)
    const response = await model.invoke([new SystemMessage(SYSTEM_PROMPT), ...history])
    return { messages: [new AIMessage(response.content)], step: 'START' }
  } catch {
    return { messages: [new AIMessage(MSG_BIENVENIDA)], step: 'START' }
  }
}

// ── Routing ───────────────────────────────────────────────────────────────────
const routeAfterClassify = (state) => {
  let dest
  if (state.step?.startsWith('BOOKING_')) dest = 'booking'
  else if (state.step?.startsWith('CANCEL_'))  dest = 'cancel'
  else {
    switch (state.intent) {
      case 'BOOK':   dest = 'booking'; break
      case 'CANCEL': dest = 'cancel';  break
      case 'INFO':   dest = 'info';    break
      default:       dest = 'general'
    }
  }
  logger.info('Graph:route', `step=${state.step} intent=${state.intent} → ${dest}`)
  return dest
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
  logger.info('Graph:invoke', `phone=${phone} text="${text}"`)
  const config = { configurable: { thread_id: phone } }
  try {
    const result = await graph.invoke({ messages: [new HumanMessage(text)], phone }, config)
    const msgs = result.messages ?? []
    logger.info('Graph:invoke', `result messages=${msgs.length}`)
    const lastAI = [...msgs].reverse().find(m => m instanceof AIMessage || m.getType?.() === 'ai')
    const reply = lastAI?.content ?? "Lo siento, ocurrió un error. Escribe 'hola' para empezar."
    logger.info('Graph:invoke', `reply="${reply.slice(0, 60)}"`)
    return reply
  } catch (error) {
    logger.error('Graph:invoke', `FATAL: ${error.message}`, error.stack?.slice(0, 300))
    return "Ocurrió un error en el sistema. Escribe 'menu' para reiniciar."
  }
}

export const resetGraph = async (phone) => {
  try {
    await graph.updateState({ configurable: { thread_id: phone } }, { step: 'START', intent: null, slots: null }, 'classify')
  } catch { /* sin estado previo, ignorar */ }
}
