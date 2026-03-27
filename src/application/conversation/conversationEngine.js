// application/conversation/conversationEngine.js
import { db } from '../../infrastructure/database/db.js'

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutos

const freshState = (phone) => ({
  phone,
  workflow: null,
  state: 'START',
  context: {},
  last_interaction: Date.now()
})

export const getConversationState = (phone) => {
  const states = db.read('conversation_state')
  const existing = states[phone]

  // Expirar sesión si lleva más de 30 min inactiva
  if (existing && Date.now() - existing.last_interaction > SESSION_TTL_MS) {
    states[phone] = freshState(phone)
    db.write('conversation_state', states)
  }

  if (!states[phone]) {
    states[phone] = freshState(phone)
    db.write('conversation_state', states)
  }

  return states[phone]
}

export const saveConversationState = (phone, newState) => {
  const states = db.read('conversation_state')
  states[phone] = {
    ...states[phone],
    ...newState,
    last_interaction: Date.now()
  }
  db.write('conversation_state', states)
}

export const clearConversationState = (phone) => {
  const states = db.read('conversation_state')
  states[phone] = freshState(phone)
  db.write('conversation_state', states)
}
