// application/services/llmService.js
import { queryLLM } from '../../infrastructure/llm/openRouterClient.js'
import { logger } from '../../utils/logger.js'

// Inline UNKNOWN to avoid circular dependency with intentRouter
const UNKNOWN = 'UNKNOWN'

// Valid intents — must mirror INTENTS in intentRouter.js
const VALID_INTENTS = [
  'BOOK_APPOINTMENT', 'CHECK_AVAILABILITY', 'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT', 'ASK_SERVICE_INFO', 'BUY_PRODUCT',
  'GREETING', 'UNKNOWN'
]

const SYSTEM_PROMPT_INTENT = `Eres el recepcionista de "Salon Bella". Analiza el mensaje y extrae la intención y datos.

Intenciones:
- BOOK_APPOINTMENT: Agendar citas.
- CHECK_AVAILABILITY: Consultar horarios libres.
- CANCEL_APPOINTMENT: Cancelar citas.
- BUY_PRODUCT: Comprar productos O pedir recomendaciones/consejos sobre qué producto usar.
- ASK_SERVICE_INFO: Información de servicios y precios del salón.
- GREETING: Saludos.
- UNKNOWN: Otros.

Entidades: service, product, date, time.

Responde solo JSON:
{
  "intent": "INTENCION",
  "entities": { "service": "valor o null", "product": "valor o null", "date": "valor o null", "time": "valor o null" }
}`

const SYSTEM_PROMPT_CHAT = `Eres la recepcionista amable y profesional de "Salon Bella".
Tu objetivo es responder de forma natural, cercana y servicial a los clientes.
Responde de forma breve y clara.
Si el usuario pregunta algo que no sabes, invítalo a escribir "agendar" para ver servicios o "menu" para ver opciones.
Mantén un tono cálido y usa emojis ocasionalmente.`

export const classifyIntent = async (text) => {
  try {
    const response = await queryLLM([
      { role: 'system', content: SYSTEM_PROMPT_INTENT },
      { role: 'user', content: text }
    ])

    // Attempt to parse JSON from response
    const jsonStr = response.match(/\{[\s\S]*\}/)?.[0] || response
    const result = JSON.parse(jsonStr)

    if (result.intent && VALID_INTENTS.includes(result.intent.toUpperCase())) {
      result.intent = result.intent.toUpperCase()
      return result
    }
    return { intent: UNKNOWN, entities: {} }
  } catch (error) {
    logger.error('LLMService', 'Error classifying intent', error.message)
    return { intent: UNKNOWN, entities: {} }
  }
}

export const generateNaturalResponse = async (text, history = []) => {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      ...history,
      { role: 'user', content: text }
    ]

    return await queryLLM(messages)
  } catch (error) {
    logger.error('LLMService', 'Error generating response', error.message)
    return "Lo siento, tuve un pequeño problema técnico. ¿En qué puedo ayudarte? Puedes escribir 'menu' para ver opciones."
  }
}

/**
 * Rephrases a dry workflow response into something natural based on user input
 */
export const rephraseIntentResponse = async (userText, workflowResponse, intent) => {
  try {
    const systemPrompt = `Eres la recepcionista amable de "Salon Bella".
El usuario dijo: "${userText}"
El sistema detectó la intención o contexto: ${intent}
La respuesta técnica que sigue es: "${workflowResponse}"

Tu tarea es REESCRIBIR la respuesta técnica para que suene natural, amable y reconozca lo que el usuario dijo, pero manteniendo exactamente la misma pregunta o instrucción final.
No inventes información ni cambies datos (fechas, horas, servicios) que ya están en la respuesta técnica.
IMPORTANTE: Si la respuesta técnica pregunta por la hora, tú debes preguntar por la hora. Si la respuesta técnica confirma una fecha, tú debes confirmar esa misma fecha.
Respuesta breve y con un emoji ocasional.`

    return await queryLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: workflowResponse }
    ])
  } catch (error) {
    logger.error('LLMService', 'Error rephrasing response', error.message)
    return workflowResponse // Fallback to dry response
  }
}
