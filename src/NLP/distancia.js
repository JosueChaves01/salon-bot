// NLP/distancia.js
// Búsqueda fuzzy basada en distancia de Levenshtein — sin dependencias externas

const levenshtein = (a, b) => {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Normalizar: minúsculas + quitar acentos + limpiar espacios
export const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()

// Retorna la clave del candidato más parecido o null si supera el umbral
export const mejorCoincidencia = (input, candidatos, umbral = 3) => {
  const inputNorm = normalizar(input)
  let mejorClave = null
  let mejorDist = Infinity

  for (const [clave, palabras] of Object.entries(candidatos)) {
    for (const palabra of palabras) {
      const dist = levenshtein(inputNorm, normalizar(palabra))
      if (dist < mejorDist) {
        mejorDist = dist
        mejorClave = clave
      }
    }
  }

  return mejorDist <= umbral ? mejorClave : null
}

// Verifica si el texto contiene alguna de las palabras de un grupo
// Palabras simples usan límite de palabra para evitar falsos positivos (ej: "mariana" ≠ "maria")
export const contieneAlguna = (texto, palabras) => {
  const norm = normalizar(texto)
  return palabras.some((p) => {
    const normP = normalizar(p)
    if (!normP.includes(' ')) {
      return new RegExp(`\\b${normP}\\b`).test(norm)
    }
    return norm.includes(normP)
  })
}

// Puntúa cuántas palabras del diccionario aparecen en el texto
export const puntuarCoincidencias = (texto, diccionario) => {
  const norm = normalizar(texto)
  const puntajes = {}
  for (const [clave, palabras] of Object.entries(diccionario)) {
    puntajes[clave] = palabras.filter((p) => norm.includes(normalizar(p))).length
  }
  return puntajes
}
