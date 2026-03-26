// agente/slotExtractor.js
// Extrae parámetros (slots) del texto libre: servicio, fecha, hora, nombre
// Permite saltar pasos del formulario cuando el cliente da datos de golpe

import { PALABRAS_SERVICIOS } from '../NLP/palabrasClaves.js'
import { normalizar, mejorCoincidencia, contieneAlguna } from '../NLP/distancia.js'
import { parsearFecha, parsearHora } from '../NLP/extensorFechas.js'
import { SERVICIOS } from '../constants/servicios.js'

const UMBRAL_FUZZY_SERVICIO = 2   // distancia máxima para aceptar similitud
const ESTILISTA_UNICA = 'HAYSSELL'

// ── Servicio ─────────────────────────────────────────────────────────────────

const extraerServicio = (norm) => {
  // Primero búsqueda exacta por palabras clave
  for (const [clave, palabras] of Object.entries(PALABRAS_SERVICIOS)) {
    if (contieneAlguna(norm, palabras)) return clave
  }

  // Si no, fuzzy contra los nombres de servicios individuales
  const candidatos = {}
  for (const [clave, s] of Object.entries(SERVICIOS)) {
    candidatos[clave] = [s.nombre.toLowerCase()]
  }
  return mejorCoincidencia(norm, candidatos, UMBRAL_FUZZY_SERVICIO)
}


// ── Nombre de persona ─────────────────────────────────────────────────────────

// Detecta "a nombre de X", "me llamo X", "soy X"
const extraerNombre = (texto) => {
  const patrones = [
    /a nombre de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /me llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
    /mi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i,
  ]
  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) return match[1].trim()
  }
  return null
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

// Retorna los slots que se pudieron extraer — los no encontrados quedan como null
export const extraerSlots = (texto) => {
  const norm = normalizar(texto)

  return {
    servicio: extraerServicio(norm),
    estilista: ESTILISTA_UNICA,
    fecha: parsearFecha(texto),     // usa texto original para preservar acentos
    hora: parsearHora(texto),
    nombre: extraerNombre(texto),
  }
}

// Cuenta cuántos slots esenciales faltan para agendar
export const slotsFaltantes = (datos) => {
  const requeridos = ['servicio', 'fecha', 'hora', 'nombre']
  return requeridos.filter((k) => !datos[k])
}

// Fusiona slots nuevos con los ya almacenados en sesión (no sobrescribe con null)
export const fusionarSlots = (datosExistentes, nuevosSots) => {
  const resultado = { ...datosExistentes }
  for (const [k, v] of Object.entries(nuevosSots)) {
    if (v !== null && v !== undefined) resultado[k] = v
  }
  return resultado
}
