// adapters/whatsapp/whatsappAdapter.js
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg
import qrcode from 'qrcode-terminal'
import { processMessage } from '../../application/workflowEngine.js'
import { setWhatsappClient } from '../../application/workflows/BookingWorkflow.js'
import { logger } from '../../utils/logger.js'

const RECONNECT_DELAY_MS = 5000

export const initWhatsAppAdapter = () => {
  const sessionPath = process.env.SESSION_DATA_PATH || './.wwebjs_auth'

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    }
  })

  client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true })
  })

  client.on('ready', () => {
    logger.info('WhatsApp', 'Cliente listo y conectado.')
  })

  client.on('disconnected', (reason) => {
    logger.warn('WhatsApp', `Desconectado por: ${reason}`)
    setTimeout(() => client.initialize(), RECONNECT_DELAY_MS)
  })

  client.on('message', async (msg) => {
    if (msg.fromMe || msg.isStatus) return

    const phone = msg.from.replace('@c.us', '')

    // Ignore group messages
    if (msg.from.includes('@g.us')) return

    // Only allow authorized number if AUTHORIZED_PHONE is set (testing mode)
    const numeroAutorizado = process.env.AUTHORIZED_PHONE
    if (numeroAutorizado && phone !== numeroAutorizado) return

    const text = msg.body.trim()
    if (!text) return

    try {
      // Activate "typing" state
      const chat = await msg.getChat()
      await chat.sendStateTyping()

      const response = await processMessage(phone, text)

      if (response) {
        // Simulate typing delay (between 1.5 and 3 seconds)
        const delay = Math.floor(Math.random() * 1500) + 1500
        setTimeout(async () => {
          await msg.reply(response)
          await chat.clearState()
        }, delay)
      }
    } catch (error) {
      logger.error('WhatsApp', 'Flow Error', error.message)
      await msg.reply('Ocurrió un error. Por favor intenta escribiendo "menu".')
    }
  })

  // Pass client instance to BookingWorkflow for stylist notifications
  setWhatsappClient(client)

  return client
}
