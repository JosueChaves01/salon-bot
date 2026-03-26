// NLP/extensorFechas.js
// Convierte expresiones de fecha en español a YYYY-MM-DD sin librerías externas

import { DIAS_LABORALES } from '../constants/horarios.js'

const DIAS_SEMANA = Object.freeze({
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
})

const MESES = Object.freeze({
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8,
  sep: 9, oct: 10, nov: 11, dic: 12,
})

const toISO = (d) => d.toISOString().slice(0, 10)

const hoy = () => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

const sumarDias = (base, n) => {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

// Próxima fecha que sea el día de semana buscado (≥ mañana)
const proximoDia = (nombreDia, buscarSiguienteSemana = false) => {
  const objetivo = DIAS_SEMANA[nombreDia]
  if (objetivo === undefined) return null

  const base = sumarDias(hoy(), buscarSiguienteSemana ? 7 : 1)
  const diasHastaObjetivo = (objetivo - base.getDay() + 7) % 7
  return sumarDias(base, diasHastaObjetivo)
}

// Extrae una fecha ISO del texto libre — retorna null si no encuentra nada claro
export const parsearFecha = (texto) => {
  const t = texto.toLowerCase().trim()

  // ── Absolutos relativos ──────────────────────────────────────────
  if (/\bhoy\b/.test(t)) return toISO(hoy())
  if (/\bma[ñn]ana\b/.test(t)) return toISO(sumarDias(hoy(), 1))
  if (/\bpasado\s+ma[ñn]ana\b/.test(t)) return toISO(sumarDias(hoy(), 2))

  // "en N días/semanas"
  const enDias = t.match(/\ben\s+(\d+)\s+d[ií]as?\b/)
  if (enDias) return toISO(sumarDias(hoy(), parseInt(enDias[1])))

  const enSemanas = t.match(/\ben\s+(\d+)\s+semanas?\b/)
  if (enSemanas) return toISO(sumarDias(hoy(), parseInt(enSemanas[1]) * 7))

  // ── Días de semana ───────────────────────────────────────────────
  // Solo matchea cuando hay contexto temporal explícito (el, para el, este, próximo…)
  // Así "los sábados" / "los domingos" (habitual) no se convierte en fecha específica
  const esSiguiente = /\b(próximo|proximo|siguiente)\b/.test(t)
  const tieneContextoTemporal = /\b(el|para el|este|ese|próximo|proximo|siguiente|para)\b/.test(t)

  if (tieneContextoTemporal) {
    for (const [nombre] of Object.entries(DIAS_SEMANA)) {
      if (new RegExp(`\\b${nombre}\\b`).test(t)) {
        const fecha = proximoDia(nombre, esSiguiente)
        if (fecha) return toISO(fecha)
      }
    }
  }

  // ── Fechas específicas: "15 de marzo", "15/03", "15/03/2026" ────
  const conMes = t.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?\b/)
  if (conMes) {
    const dia = parseInt(conMes[1])
    const mes = MESES[conMes[2]]
    const anio = conMes[3] ? parseInt(conMes[3]) : new Date().getFullYear()
    if (mes) {
      const d = new Date(anio, mes - 1, dia, 12)
      if (!isNaN(d.getTime())) return toISO(d)
    }
  }

  const conSlash = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/)
  if (conSlash) {
    const dia = parseInt(conSlash[1])
    const mes = parseInt(conSlash[2])
    const anio = conSlash[3] ? parseInt(conSlash[3]) : new Date().getFullYear()
    const d = new Date(anio, mes - 1, dia, 12)
    if (!isNaN(d.getTime())) return toISO(d)
  }

  // ── Formato ISO directo ──────────────────────────────────────────
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]

  return null
}

// Extrae hora en formato HH:MM del texto — retorna null si no encuentra
export const parsearHora = (texto) => {
  const t = texto.toLowerCase()

  // 1. Formato exacto "14:30", "10:00", "1:30"
  const exacta = t.match(/\b(\d{1,2}):(\d{2})\b/)
  if (exacta) {
    let h = parseInt(exacta[1])
    const m = exacta[2]
    
    // HEURÍSTICA: Si es 1-6 y no hay indicación de AM/PM en el texto, asumir PM
    // El salón abre a las 8 AM, así que es mucho más probable que 1-6 sea PM.
    // Solo evitamos el ajuste si dice explícitamente "am" o "de la mañana".
    const tieneIndicacionManana = /\bam\b|\bde\s+la\s+mañana\b|\bpor\s+la\s+mañana\b/i.test(t)
    if (h > 0 && h < 8 && !tieneIndicacionManana) {
      h += 12
    }
    
    return `${String(h).padStart(2, '0')}:${m}`
  }

  // 2. Formato con AM/PM explícito: "10am", "3pm", "10 am", "3 de la tarde"
  const ampm = t.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/)
  if (ampm) {
    let h = parseInt(ampm[1])
    const sufijo = ampm[2].replace(/\./g, '')
    if (sufijo === 'pm' && h !== 12) h += 12
    if (sufijo === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:00`
  }

  // 3. Formato natural: "a las 3", "a la 1", "a las 10 de la mañana"
  const aLasMatch = t.match(/\ba\s+la[s]?\s+(\d{1,2})(?:\s+de\s+la\s+(ma[ñn]ana|tarde|noche))?\b/)
  if (aLasMatch) {
    let h = parseInt(aLasMatch[1])
    const periodo = aLasMatch[2] ?? ''

    if (periodo.includes('tarde') || periodo.includes('noche')) {
      if (h < 12) h += 12
    } else if (periodo.includes('mañana') || periodo.includes('manana')) {
      if (h === 12) h = 0
    } else {
      // HEURÍSTICA: Si no hay periodo y la hora es < 8, asumir PM
      const tieneIndicacionManana = /\bam\b|\bde\s+la\s+mañana\b|\bpor\s+la\s+mañana\b/i.test(t)
      if (h > 0 && h < 8 && !tieneIndicacionManana) {
        h += 12
      }
    }
    return `${String(h).padStart(2, '0')}:00`
  }

  return null
}
