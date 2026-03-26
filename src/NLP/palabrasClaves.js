// NLP/palabrasClaves.js
// Diccionarios de palabras clave — única fuente de verdad para el NLP

export const PALABRAS_INTENCION = Object.freeze({
  AGENDAR: [
    'agendar', 'reservar', 'apartar', 'quiero', 'necesito', 'quisiera',
    'turno', 'me puede', 'puede darme', 'hacer una cita', 'pedir cita',
    'hacer reserva', 'tienen espacio', 'hay espacio', 'tienen disponibilidad',
    'quiero una cita', 'necesito una cita', 'quiero agendar', 'quiero reservar',
  ],
  CANCELAR: [
    'cancelar', 'anular', 'borrar', 'eliminar', 'quitar', 'no puedo ir',
    'no voy', 'no asistiré', 'cancela', 'cancel',
  ],
  VER_CITAS: [
    'mis citas', 'citas activas', 'citas pendientes', 'tengo cita', 'ver cita',
    'cuándo es', 'cuándo tengo', 'cuándo quedé', 'mis reservas', 'ver reserva',
  ],
  DISPONIBILIDAD: [
    'disponibilidad', 'disponible', 'hay espacio', 'cuándo pueden', 'cuándo atienden',
    'horarios libres', 'qué días', 'qué horas', 'hay cita', 'tienen hueco',
  ],
  PRECIOS: [
    'precio', 'costo', 'cuánto cuesta', 'cuánto cobra', 'cuánto vale', 'precio de',
    'tarifa', 'cuánto sale', 'cuánto es', 'servicios y precios', 'lista de precios',
  ],
  FAQ_HORARIO: [
    'horario', 'hora de apertura', 'hora de cierre', 'qué hora abren', 'a qué hora',
    'cuándo abren', 'cuándo cierran', 'días que atienden', 'días laborales',
  ],
  FAQ_UBICACION: [
    'dónde están', 'dirección', 'ubicación', 'cómo llegar', 'dónde quedan',
    'dónde se ubican', 'mapa', 'localización',
  ],
  SALUDO: [
    'hola', 'buenas', 'buenos días', 'buenas tardes', 'buenas noches', 'hi',
    'hey', 'saludos', 'qué tal', 'cómo están',
  ],
  DESPEDIDA: [
    'gracias', 'hasta luego', 'adiós', 'bye', 'chao', 'nos vemos', 'hasta pronto',
    'muchas gracias', 'perfecto gracias', 'listo gracias', 'ok gracias',
  ],
  MENU: [
    'menu', 'menú', 'inicio', 'start', 'principal', 'regresar', 'volver', 'atrás',
    'atras', 'opciones', 'ayuda', 'help',
  ],
})

export const PALABRAS_SERVICIOS = Object.freeze({
  CORTE_DAMA: [
    'corte dama', 'corte de dama', 'corte femenino', 'corte pelo mujer',
    'cortarme el pelo', 'cortar pelo', 'corte cabello', 'corte',
  ],
  CORTE_CABALLERO: [
    'corte caballero', 'corte masculino', 'corte hombre', 'corte de pelo hombre',
    'me corte', 'cortarme',
  ],
  TINTE: [
    'tinte', 'tintura', 'color', 'teñir', 'teñirme', 'pintar el pelo',
    'cambio de color', 'coloración',
  ],
  MECHAS: [
    'mechas', 'highlights', 'mechones', 'rayitos', 'aclarar', 'reflejos',
    'balayage', 'luces',
  ],
  TRATAMIENTO: [
    'tratamiento', 'tratamiento capilar', 'hidratación', 'keratina', 'botox capilar',
    'nutrición', 'reparación', 'hidratación capilar',
  ],
  PEINADO: [
    'peinado', 'peinar', 'peinarse', 'peinado especial', 'recogido', 'ondas',
    'peinado de gala', 'peinado para evento',
  ],
  MANICURE: [
    'manicure', 'manicura', 'uñas manos', 'arreglar uñas', 'uñas de las manos',
    'pintar uñas manos',
  ],
  PEDICURE: [
    'pedicure', 'pedicura', 'uñas pies', 'uñas de los pies', 'pies',
    'pintar uñas pies',
  ],
  MAQUILLAJE: [
    'maquillaje', 'maquillarse', 'make up', 'makeup', 'maquillar',
    'maquillaje de gala', 'maquillaje para evento',
  ],
})

export const PALABRAS_ESTILISTAS = Object.freeze({
  HAYSSELL: ['hayssell', 'con hayssell'],
})

export const PALABRAS_HORA = Object.freeze({
  MANANA_TEMP: ['mañana', 'manana', 'de mañana', 'por la mañana'],
  TARDE: ['tarde', 'de tarde', 'por la tarde'],
  NOCHE: ['noche', 'de noche', 'por la noche'],
})

export const PALABRAS_CONFIRMACION = Object.freeze([
  'sí', 'si', 'ok', 'okey', 'claro', 'perfecto', 'dale', 'bueno',
  'está bien', 'de acuerdo', 'correcto', 'exacto', 'por favor', 'adelante',
  'listo', 'va', 'eso', 'así es', 'confirmo', 'confirmar',
])

export const PALABRAS_NEGACION = Object.freeze([
  'no', 'nope', 'para nada', 'nel', 'jamás', 'nunca', 'tampoco',
  'negativo', 'de ninguna manera',
])
