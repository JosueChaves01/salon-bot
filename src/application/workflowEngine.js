// application/workflowEngine.js
import { getConversationState, saveConversationState, clearConversationState } from './conversation/conversationEngine.js'
import { detectIntentWithLLM, INTENTS, detectIntent } from './intent/intentRouter.js'
import { generateNaturalResponse, rephraseIntentResponse } from './services/llmService.js'
import { intentToWorkflow, runWorkflow } from './factories/WorkflowFactory.js'
import { parsearFecha, parsearHora } from '../NLP/extensorFechas.js'
import { extraerSlots } from '../agente/slotExtractor.js'
import { db } from '../infrastructure/database/db.js'
import { logger } from '../utils/logger.js'

export const processMessage = async (phone, text) => {
  const normalizedText = text.trim()
  logger.chat(phone, 'in', normalizedText)

  const state = getConversationState(phone)
  console.log(`[DEBUG] WorkflowEngine: Starting processMessage for ${phone}. Current State:`, JSON.stringify(state))

  const sendReply = (msg) => {
    logger.chat(phone, 'out', msg)
    return msg
  }

  // Reset command
  if (normalizedText.toLowerCase() === 'salir' || normalizedText.toLowerCase() === 'menu') {
    clearConversationState(phone)
    return sendReply('✅ Entendido. ¿En qué más te puedo ayudar?')
  }

  // Routing: If we are at START, detect intent
  if (state.state === 'START' || state.workflow === null) {
    const result = await detectIntentWithLLM(normalizedText)
    const intent = typeof result === 'string' ? result : result.intent
    const entities = typeof result === 'object' ? result.entities : {}

    logger.info('WorkflowEngine', `Intent detected for ${phone}: ${intent}`)

    const context = { ...state.context }

    if (entities.service) {
      const normSrv = extraerSlots(entities.service).servicio
      context.service = normSrv || entities.service
    }
    if (entities.date) {
      const normDate = parsearFecha(entities.date)
      context.date = normDate || entities.date
    }
    if (entities.time) {
      const normTime = parsearHora(entities.time)
      context.time = normTime || entities.time
    }

    const workflowName = intentToWorkflow(intent)

    if (workflowName) {
      const newState = { workflow: workflowName, state: 'START', context }
      saveConversationState(phone, newState)
      const replyObj = await runWorkflow(phone, normalizedText, newState)
      const naturalReply = await rephraseIntentResponse(normalizedText, replyObj, intent)
      return sendReply(naturalReply)
    }

    if (intent === INTENTS.ASK_SERVICE_INFO) {
      const services = db.read('services')
      const lines = services.map(s => `• ${s.nombre} - ₡${s.precio}`)
      const infoMsg = `💅 *Nuestros Servicios*\n\n${lines.join('\n')}\n\nSi quieres sacar cita, escribe "agendar".`
      saveConversationState(phone, { context })
      const naturalInfo = await rephraseIntentResponse(normalizedText, infoMsg, intent)
      return sendReply(naturalInfo)
    }

    // Greeting or UNKNOWN — use LLM for natural response
    const aiResponse = await generateNaturalResponse(normalizedText)
    return sendReply(aiResponse)
  }

  // Already in an active workflow — allow strong intent switch
  const quickIntent = detectIntent(normalizedText)
  if (quickIntent !== INTENTS.UNKNOWN && quickIntent !== INTENTS.GREETING) {
    const targetWorkflow = intentToWorkflow(quickIntent)
    if (targetWorkflow && targetWorkflow !== state.workflow) {
      logger.info('WorkflowEngine', `Switching workflow from ${state.workflow} to ${targetWorkflow} due to strong intent: ${quickIntent}`)
      clearConversationState(phone)
      return await processMessage(phone, text)
    }
  }

  // Continue active workflow
  const replyObj = await runWorkflow(phone, normalizedText, state)

  if (!replyObj) {
    clearConversationState(phone)
    return sendReply("Ocurrió un error con la sesión. Por favor, escribe 'hola' para empezar de nuevo.")
  }

  const finalNaturalReply = await rephraseIntentResponse(normalizedText, replyObj, state.workflow)
  return sendReply(finalNaturalReply)
}
