import { initWhatsAppAdapter } from './adapters/whatsapp/whatsappAdapter.js'
import { startReminderScheduler } from './infrastructure/scheduler/reminderService.js'
import { startWebDashboard } from './adapters/web/webController.js'
import { logger } from './utils/logger.js'

const startApp = async () => {
  logger.info('System', 'Iniciando Salon Bot Architecture V2...')

  // Arrange WhatsApp Adapter
  const client = initWhatsAppAdapter()

  // Start checking for schedule reminders
  client.on('ready', () => {
    startReminderScheduler(client)
  })

  client.initialize()

  // Start the local Dashboard
  startWebDashboard()
}

startApp()
