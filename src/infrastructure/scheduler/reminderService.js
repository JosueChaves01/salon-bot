// infrastructure/scheduler/reminderService.js
import cron from 'node-cron'
import { db } from '../database/db.js'
import { logger } from '../../utils/logger.js'

export const startReminderScheduler = (whatsappClient) => {
  // Execute every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      const future15Mins = new Date(now.getTime() + 15 * 60000)

      const appointments = db.read('appointments')
      const targetDate = future15Mins.toISOString().slice(0, 10)
      const targetTimeH = String(future15Mins.getHours()).padStart(2, '0')
      const targetTimeM = String(future15Mins.getMinutes()).padStart(2, '0')
      const targetTime = `${targetTimeH}:${targetTimeM}`

      // Find appointments in next 15 min without reminder_sent flag
      const targetAppts = appointments.filter(a =>
        a.estado === 'pending' &&
        a.fecha === targetDate &&
        a.hora === targetTime &&
        !a.reminder_sent
      )

      for (const appt of targetAppts) {
        const msg = `🔔 *Recordatorio de Cita* 🔔\n\nHola ${appt.nombre}, te recordamos que tienes una cita en 15 minutos:\n\n💇 Servicio: ${appt.servicio}\n🕐 Hora: ${appt.hora}\n📍 Salón Bella\n\n¡Te esperamos!`

        const chatId = `${appt.telefono}@c.us`
        await whatsappClient.sendMessage(chatId, msg)
        logger.chat(appt.telefono, 'out', msg)

        // Mark reminder sent
        db.update('appointments', appt.id, { reminder_sent: true })
        logger.info('Recordatorios', `15min reminder sent for ${appt.nombre} (${appt.telefono})`)
      }
    } catch (error) {
      logger.error('Recordatorios', 'Fallo procesando scheduler', error.message)
    }
  })

  logger.info('Recordatorios', 'Scheduler activo, revisando cada minuto.')
}
