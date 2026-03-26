// application/workflows/CancelWorkflow.js
import { saveConversationState, clearConversationState } from '../conversation/conversationEngine.js'
import { CANCEL_STATES } from '../conversation/states/CancelStates.js'
import { db } from '../../infrastructure/database/db.js'

export const cancelWorkflow = (phone, text, state) => {
  const { state: actState, context } = state

  switch (actState) {
    case CANCEL_STATES.START:
    case CANCEL_STATES.IDENTIFY_APPOINTMENT: {
      const citas = db.read('appointments').filter(a => a.cliente === phone && a.estado === 'pending')

      if (citas.length === 0) {
        clearConversationState(phone)
        return '📭 No tienes citas agendadas actualmente para cancelar.'
      }

      if (citas.length === 1) {
        context.appointmentToCancel = citas[0]
        saveConversationState(phone, { state: CANCEL_STATES.CONFIRM_CANCEL, context })
        return `Veo que tienes una cita para *${citas[0].servicio}* el *${citas[0].fecha}* a las *${citas[0].hora}*.\n\n¿Estás segur@ de que deseas cancelarla? (*sí* / *no*)`
      } else {
        context.appointmentToCancel = citas[0]
        saveConversationState(phone, { state: CANCEL_STATES.CONFIRM_CANCEL, context })
        return `Veo que tienes varias citas. Te cancelaré la primera: *${citas[0].servicio}* el *${citas[0].fecha}* a las *${citas[0].hora}*.\n\n¿Confirmas la cancelación? (*sí* / *no*)`
      }
    }

    case CANCEL_STATES.CONFIRM_CANCEL:
      if (text.toLowerCase() === 'si' || text.toLowerCase() === 'sí') {
        saveConversationState(phone, { state: CANCEL_STATES.CANCEL, context })
        return cancelWorkflow(phone, text, { state: CANCEL_STATES.CANCEL, context })
      } else if (text.toLowerCase() === 'no') {
        clearConversationState(phone)
        return '❌ Entendido, tu cita NO ha sido cancelada. ¡Nos vemos pronto!'
      } else {
        return 'Por favor responde *sí* o *no*.'
      }

    case CANCEL_STATES.CANCEL: {
      const appt = context.appointmentToCancel
      db.update('appointments', appt.id, { estado: 'cancelled' })
      clearConversationState(phone)
      return '✅ Tu cita ha sido cancelada exitosamente.'
    }

    default:
      clearConversationState(phone)
      return 'Se canceló la operación.'
  }
}
