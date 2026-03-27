// application/workflowEngine.js
import { processWithGraph, resetGraph } from './graph/salonGraph.js'
import { logger } from '../utils/logger.js'

export const processMessage = async (phone, text) => {
  const normalizedText = text.trim()
  logger.chat(phone, 'in', normalizedText)

  const sendReply = (msg) => {
    logger.chat(phone, 'out', msg)
    return msg
  }

  // Reset commands — limpian el estado del grafo
  const lower = normalizedText.toLowerCase()
  if (lower === 'salir' || lower === 'menu') {
    await resetGraph(phone)
    return sendReply('✅ Entendido. ¿En qué más te puedo ayudar? Escribe *agendar*, *cancelar* o pregunta lo que necesites.')
  }

  try {
    const reply = await processWithGraph(phone, normalizedText)
    return sendReply(reply)
  } catch (error) {
    logger.error('WorkflowEngine', 'Graph error', error.message)
    return sendReply("Ocurrió un error inesperado. Escribe 'hola' para empezar de nuevo.")
  }
}
