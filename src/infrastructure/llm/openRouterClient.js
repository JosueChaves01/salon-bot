// infrastructure/llm/openRouterClient.js
import axios from 'axios'
import dotenv from 'dotenv'
import { logger } from '../../utils/logger.js'

dotenv.config()

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free'

console.log(`Using LLM Model: ${OPENROUTER_MODEL}`)

/**
 * Send a prompt to OpenRouter API
 * @param {Array} messages - Array of message objects {role, content}
 * @returns {Promise<string>} - The LLM response
 */
export const queryLLM = async (messages) => {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENROUTER_MODEL,
        messages: messages,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content
    } else {
      throw new Error('Invalid response from OpenRouter')
    }
  } catch (error) {
    if (error.response) {
      logger.error('OpenRouter', 'API Response Error', JSON.stringify(error.response.data, null, 2))
    } else {
      logger.error('OpenRouter', 'Network Error', error.message)
    }
    throw error
  }
}
