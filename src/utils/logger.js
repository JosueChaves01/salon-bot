import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'salon-bot.log')

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

const formatMessage = (level, context, message, meta = '') => {
  const timestamp = new Date().toISOString()
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : ''
  return `[${timestamp}] [${level}] [${context}] ${message}${metaStr}\n`
}

const writeLog = (formattedMessage) => {
  // Escribe al archivo (append)
  fs.appendFileSync(LOG_FILE, formattedMessage, 'utf8')
  // También imprime en consola original
  process.stdout.write(formattedMessage)
}

export const logger = {
  info: (context, message, meta) => {
    writeLog(formatMessage('INFO', context, message, meta))
  },
  error: (context, message, meta) => {
    writeLog(formatMessage('ERROR', context, message, meta))
  },
  warn: (context, message, meta) => {
    writeLog(formatMessage('WARN', context, message, meta))
  },
  // Método específico para registrar conversaciones del usuario
  chat: (phone, direction, message) => {
    // direction: 'in' para entrante, 'out' para saliente de nuestro bot
    writeLog(formatMessage('CHAT', `User:${phone}`, direction === 'in' ? `< ${message}` : `> ${message}`))
  }
}
