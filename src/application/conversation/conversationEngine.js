// application/conversation/conversationEngine.js
import { db } from '../../infrastructure/database/db.js'

export const getConversationState = (phone) => {
  const states = db.read('conversation_state')
  if (!states[phone]) {
    states[phone] = {
      phone,
      workflow: null,
      state: 'START',
      context: {},
      last_interaction: Date.now()
    }
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
  if (states[phone]) {
    states[phone] = {
      phone,
      workflow: null,
      state: 'START',
      context: {},
      last_interaction: Date.now()
    }
    db.write('conversation_state', states)
  }
}
