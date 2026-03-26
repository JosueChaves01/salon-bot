// constants/horarios.js
// Toda la logica de tiempo del negocio en un solo lugar

export const DIAS_LABORALES = Object.freeze([1, 2, 3, 4, 5, 6]) // lunes=1 ... sabado=6

export const HORA_APERTURA = 8   // 8:00 AM
export const HORA_CIERRE = 18    // 6:00 PM
export const DURACION_SLOT_MIN = 30

export const HORA_RECORDATORIO = Object.freeze({ hora: '08', minuto: '00' })

export const MS_POR_HORA = 3_600_000
export const MS_POR_DIA = 86_400_000
export const HORAS_ANTICIPACION_RECORDATORIO = 24

export const NOMBRE_DIAS = Object.freeze({
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
})
