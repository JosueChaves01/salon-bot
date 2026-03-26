// constants/mensajes.js
// Todos los textos fijos del bot centralizados

export const MENSAJES = Object.freeze({
  BIENVENIDA: `¡Hola! 👋 Soy el asistente virtual de *{SALON_NOMBRE}*.
Puedo ayudarte a:
• 📅 Agendar una cita
• 📋 Ver nuestros servicios y precios
• 🕐 Consultar disponibilidad
• ❓ Responder tus preguntas

¿En qué te puedo ayudar hoy?`,

  QR_INSTRUCCION: 'Escanea este QR con WhatsApp para conectar el bot:',
  BOT_LISTO: '✅ Bot conectado y listo para recibir mensajes.',
  ERROR_GENERICO: 'Lo siento, tuve un problema procesando tu mensaje. Por favor intenta de nuevo. 🙏',

  RECORDATORIO: `📅 *Recordatorio de cita*

Hola {NOMBRE}, te recordamos que tienes una cita mañana:

• 💇 Servicio: {SERVICIO}
• 👩‍🦱 Estilista: {ESTILISTA}
• 🕐 Hora: {HORA}
• 📍 {SALON_NOMBRE}

Si necesitas cancelar o cambiar, responde este mensaje. ¡Te esperamos! ✨`,

  CITA_CONFIRMADA: `✅ *¡Cita agendada!*

• 💇 Servicio: {SERVICIO}
• 👩‍🦱 Estilista: {ESTILISTA}
• 📅 Fecha: {FECHA}
• 🕐 Hora: {HORA}
• 💰 Precio: ₡{PRECIO}

Te enviaremos un recordatorio 24h antes. ¡Nos vemos! 💅`,
})

// Variantes de preguntas conversacionales (rotación controlada)
export const VARIANTES_PREGUNTAS = Object.freeze({
  SERVICIO: [
    '¿Qué servicio te gustaría?',
    '¿En qué puedo ayudarte hoy?',
  ],

  FECHA_PRIMERA: [
    '¿Para cuándo lo necesitas?',
    '¿Qué día te viene bien?',
  ],

  FECHA_RECURRENTE: [
    'Dale, ¿para qué fecha?',
    '¿Y para cuándo?',
  ],

  HORA: [
    '¿A qué hora te acomoda?',
    '¿Qué hora te viene?',
  ],

  NOMBRE: [
    '¿A nombre de quién queda?',
    '¿Cómo es tu nombre?',
  ],

  SERVICIO_FECHA: [
    '¿Qué servicio y para cuándo?',
    'Contame: ¿qué servicio y qué día?',
  ],

  FECHA_HORA: [
    '¿Para qué día y a qué hora?',
    '¿Cuándo te viene? Fecha y hora',
  ],
})
