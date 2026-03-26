// application/intent/intentRouter.js
// Routes raw messages to strong intents based on simple matching rules

import { normalizar } from '../../NLP/distancia.js'
import { classifyIntent } from '../services/llmService.js'

export const INTENTS = Object.freeze({
  BOOK_APPOINTMENT: 'BOOK_APPOINTMENT',
  CHECK_AVAILABILITY: 'CHECK_AVAILABILITY',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
  RESCHEDULE_APPOINTMENT: 'RESCHEDULE_APPOINTMENT',
  ASK_SERVICE_INFO: 'ASK_SERVICE_INFO',
  BUY_PRODUCT: 'BUY_PRODUCT',
  GREETING: 'GREETING',
  UNKNOWN: 'UNKNOWN'
})

const PATTERNS = {
  BOOK_APPOINTMENT: ['agendar', 'cita', 'reservar', 'turno', 'apartar', 'campo'],
  CHECK_AVAILABILITY: ['disponible', 'disponibilidad', 'libre', 'ocupado', 'horarios', 'espacio'],
  CANCEL_APPOINTMENT: ['cancelar', 'anular'],
  RESCHEDULE_APPOINTMENT: ['reprogramar', 'cambiar cita', 'mover cita'],
  BUY_PRODUCT: ['comprar', 'producto', 'shampoo', 'crema', 'llevo', 'quiero el producto'],
  ASK_SERVICE_INFO: ['precio', 'cuesta', 'costo', 'servicios', 'que hacen', 'cuanto vale'],
  GREETING: ['hola', 'buenos dias', 'buenas', 'saludos', 'hi']
}

export const detectIntent = (text) => {
  const normalized = normalizar(text)

  if (!normalized) return INTENTS.UNKNOWN

  if (normalized === 'cancelar' || PATTERNS.CANCEL_APPOINTMENT.some(p => normalized.includes(p))) {
    return INTENTS.CANCEL_APPOINTMENT
  }

  if (PATTERNS.BUY_PRODUCT.some(p => normalized.includes(p))) {
    return INTENTS.BUY_PRODUCT
  }

  if (PATTERNS.BOOK_APPOINTMENT.some(p => normalized.includes(p))) {
    return INTENTS.BOOK_APPOINTMENT
  }

  if (PATTERNS.CHECK_AVAILABILITY.some(p => normalized.includes(p))) {
    return INTENTS.CHECK_AVAILABILITY
  }

  if (PATTERNS.ASK_SERVICE_INFO.some(p => normalized.includes(p))) {
    return INTENTS.ASK_SERVICE_INFO
  }

  if (PATTERNS.GREETING.some(p => normalized.includes(p)) && normalized.length < 20) {
    return INTENTS.GREETING
  }

  return INTENTS.UNKNOWN
}

/**
 * Detect intent using LLM with local fallback
 */
export const detectIntentWithLLM = async (text) => {
  const result = await classifyIntent(text)
  return result
}
