// application/conversation/states/ProductStates.js
// State machine definitions for the product workflow

export const PRODUCT_STATES = Object.freeze({
  START: 'START',
  ASK_PRODUCT: 'ASK_PRODUCT',
  ASK_QUANTITY: 'ASK_QUANTITY',
  CONFIRM_ORDER: 'CONFIRM_ORDER',
  SAVE_ORDER: 'SAVE_ORDER',
})

/**
 * Returns the next state after a given state resolves successfully.
 */
export const nextProductState = (currentState) => {
  const transitions = {
    [PRODUCT_STATES.START]: PRODUCT_STATES.ASK_PRODUCT,
    [PRODUCT_STATES.ASK_PRODUCT]: PRODUCT_STATES.ASK_QUANTITY,
    [PRODUCT_STATES.ASK_QUANTITY]: PRODUCT_STATES.CONFIRM_ORDER,
    [PRODUCT_STATES.CONFIRM_ORDER]: PRODUCT_STATES.SAVE_ORDER,
  }
  return transitions[currentState] ?? PRODUCT_STATES.START
}
