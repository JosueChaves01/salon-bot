// application/workflows/ProductWorkflow.js
import { saveConversationState, clearConversationState } from '../conversation/conversationEngine.js'
import { PRODUCT_STATES } from '../conversation/states/ProductStates.js'
import { db } from '../../infrastructure/database/db.js'
import { queryLLM } from '../../infrastructure/llm/openRouterClient.js'
import { findProductByText, validateStock, buildOrderRecord, calculateNewStock } from '../../domain/services/ProductService.js'

/**
 * Generates a recommendation based on user query and catalog using LLM
 */
const getRecommendation = async (userText, catalog) => {
  const prompt = `Eres el recepcionista experto de "Salon Bella".
El usuario pregunta o comenta: "${userText}" sobre productos capilares.
Nuestro catálogo es: ${JSON.stringify(catalog)}

Tu tarea es:
1. Analizar la necesidad del usuario (ej: cabello seco, frizz, rubio, etc.).
2. Recomendar el producto más adecuado usando explícitamente la información de los campos "descripcion" y "uso" del catálogo.
3. Sé persuasivo pero honesto. Explica por qué ese producto le ayudará.
4. Si hay varios que aplican, menciónalos brevemente.
5. NO incluyas los IDs internos de los productos (ej: no pongas "(ID 5)") en tu respuesta.
6. Termina SIEMPRE con: "¿Cuál de estos productos deseas comprar? (Escribe el nombre o 'salir' para cancelar)"

Responde de forma natural, cálida y profesional. Usa emojis.`

  try {
    return await queryLLM([{ role: 'system', content: prompt }])
  } catch (err) {
    return null
  }
}

export const productWorkflow = async (phone, text, state) => {
  const { state: actState, context } = state

  switch (actState) {
    case PRODUCT_STATES.START:
    case PRODUCT_STATES.ASK_PRODUCT: {
      if (text && text.trim().length > 2) {
        const products = db.read('products')
        const found = findProductByText(text, products)

        if (found) {
          context.product = found
          saveConversationState(phone, { state: PRODUCT_STATES.ASK_QUANTITY, context })
          return await productWorkflow(phone, text, { state: PRODUCT_STATES.ASK_QUANTITY, context })
        } else {
          const recommendation = await getRecommendation(text, products)
          if (recommendation) {
            saveConversationState(phone, { state: PRODUCT_STATES.ASK_PRODUCT, context })
            return recommendation
          }
        }
      }

      const catalog = db.read('products').map(p => `• *${p.nombre}* - ₡${p.precio} (Stock: ${p.stock})`).join('\n')
      saveConversationState(phone, { state: PRODUCT_STATES.ASK_PRODUCT, context })
      return `🛒 *Catálogo de Productos*\n\n${catalog}\n\n¿Cuál de estos productos deseas comprar? (Escribe el nombre)`
    }

    case PRODUCT_STATES.ASK_QUANTITY: {
      if (!context.quantityRequested) {
        context.quantityRequested = true
        saveConversationState(phone, { state: PRODUCT_STATES.ASK_QUANTITY, context })
        return `¿Qué cantidad de *${context.product.nombre}* quieres? (Escribe un número)`
      }

      const qty = parseInt(text.trim(), 10)
      const stockCheck = validateStock(context.product, qty)
      if (!stockCheck.valid) {
        return `❌ ${stockCheck.error} ¿Deseas llevar otra cantidad?`
      }

      context.quantity = qty
      saveConversationState(phone, { state: PRODUCT_STATES.CONFIRM_ORDER, context })
      return productWorkflow(phone, text, { state: PRODUCT_STATES.CONFIRM_ORDER, context })
    }

    case PRODUCT_STATES.CONFIRM_ORDER: {
      if (!context.orderConfirmRequested) {
        context.orderConfirmRequested = true
        saveConversationState(phone, { state: PRODUCT_STATES.CONFIRM_ORDER, context })
        const total = (context.quantity * context.product.precio).toLocaleString()
        return `📝 *Resumen del pedido:*\n\n🛍️ Producto: ${context.product.nombre}\n🔢 Cantidad: ${context.quantity}\n💰 Total: ₡${total}\n\n¿Deseas confirmar este pedido? (*sí* / *no*)`
      }

      const isYes = text.toLowerCase() === 'si' || text.toLowerCase() === 'sí'
      const isNo = text.toLowerCase() === 'no'

      if (isYes) {
        saveConversationState(phone, { state: PRODUCT_STATES.SAVE_ORDER, context })
        return productWorkflow(phone, text, { state: PRODUCT_STATES.SAVE_ORDER, context })
      } else if (isNo) {
        clearConversationState(phone)
        return '❌ Entendido. El pedido ha sido descartado.'
      } else {
        return 'Por favor responde *sí* para confirmar o *no* para descartar el pedido.'
      }
    }

    case PRODUCT_STATES.SAVE_ORDER: {
      const orderRecord = buildOrderRecord(phone, context.product, context.quantity)
      db.insert('orders', orderRecord)

      const newStock = calculateNewStock(context.product, context.quantity)
      db.update('products', context.product.id, { stock: newStock })

      clearConversationState(phone)
      return `✅ *¡Pedido guardado!*\n\nTu pedido de *${context.quantity}x ${context.product.nombre}* está listo y en estado pendiente. Puedes retirarlo en el salón. ¡Gracias por tu compra! 🛍️`
    }

    default:
      clearConversationState(phone)
      return 'Hubo un error con el pedido. Intenta nuevamente.'
  }
}
