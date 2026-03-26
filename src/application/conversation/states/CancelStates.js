// application/conversation/states/CancelStates.js
// State machine definitions for the cancel workflow

export const CANCEL_STATES = Object.freeze({
  START: 'START',
  IDENTIFY_APPOINTMENT: 'IDENTIFY_APPOINTMENT',
  CONFIRM_CANCEL: 'CONFIRM_CANCEL',
  CANCEL: 'CANCEL',
})

/**
 * Returns the next state after a given state resolves successfully.
 */
export const nextCancelState = (currentState) => {
  const transitions = {
    [CANCEL_STATES.START]: CANCEL_STATES.IDENTIFY_APPOINTMENT,
    [CANCEL_STATES.IDENTIFY_APPOINTMENT]: CANCEL_STATES.CONFIRM_CANCEL,
    [CANCEL_STATES.CONFIRM_CANCEL]: CANCEL_STATES.CANCEL,
  }
  return transitions[currentState] ?? CANCEL_STATES.START
}
