// application/factories/WorkflowFactory.js
// Routes an intent to the correct workflow handler

import { bookingWorkflow } from '../workflows/BookingWorkflow.js'
import { cancelWorkflow } from '../workflows/CancelWorkflow.js'
import { productWorkflow } from '../workflows/ProductWorkflow.js'
import { INTENTS } from '../intent/intentRouter.js'

/**
 * Maps an intent string to a workflow name.
 */
export const intentToWorkflow = (intent) => {
  const map = {
    [INTENTS.BOOK_APPOINTMENT]: 'BOOKING',
    [INTENTS.CHECK_AVAILABILITY]: 'BOOKING',
    [INTENTS.CANCEL_APPOINTMENT]: 'CANCEL',
    [INTENTS.BUY_PRODUCT]: 'PRODUCT',
  }
  return map[intent] ?? null
}

/**
 * Execute the workflow matching the state.workflow field.
 * Returns a response string.
 */
export const runWorkflow = async (phone, text, state) => {
  switch (state.workflow) {
    case 'BOOKING':
      return bookingWorkflow(phone, text, state)
    case 'CANCEL':
      return cancelWorkflow(phone, text, state)
    case 'PRODUCT':
      return await productWorkflow(phone, text, state)
    default:
      return null
  }
}
