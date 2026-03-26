// application/conversation/states/BookingStates.js
// State machine definitions for the booking workflow

export const BOOKING_STATES = Object.freeze({
  START: 'START',
  ASK_SERVICE: 'ASK_SERVICE',
  ASK_DATE: 'ASK_DATE',
  ASK_TIME: 'ASK_TIME',
  ASK_NAME: 'ASK_NAME',
  CONFIRM_APPOINTMENT: 'CONFIRM_APPOINTMENT',
  SAVE_APPOINTMENT: 'SAVE_APPOINTMENT',
})

/**
 * Returns the next state after a given state resolves successfully.
 */
export const nextBookingState = (currentState) => {
  const transitions = {
    [BOOKING_STATES.START]: BOOKING_STATES.ASK_SERVICE,
    [BOOKING_STATES.ASK_SERVICE]: BOOKING_STATES.ASK_DATE,
    [BOOKING_STATES.ASK_DATE]: BOOKING_STATES.ASK_TIME,
    [BOOKING_STATES.ASK_TIME]: BOOKING_STATES.ASK_NAME,
    [BOOKING_STATES.ASK_NAME]: BOOKING_STATES.CONFIRM_APPOINTMENT,
    [BOOKING_STATES.CONFIRM_APPOINTMENT]: BOOKING_STATES.SAVE_APPOINTMENT,
  }
  return transitions[currentState] ?? BOOKING_STATES.START
}
