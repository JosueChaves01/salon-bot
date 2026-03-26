// domain/services/ProductService.js
// Pure business logic for products/orders — no DB or infrastructure imports.

import { normalizar } from '../../NLP/distancia.js'

/**
 * Find a product by matching name against user text.
 * @param {string} text - user input text
 * @param {Array} products - array of product records from DB
 * @returns product record or null
 */
export const findProductByText = (text, products) => {
  if (!text || !products?.length) return null
  const norm = normalizar(text)
  return products.find(p => normalizar(p.nombre).includes(norm)) ?? null
}

/**
 * Validate stock availability for a given quantity.
 * @param {object} product - product record
 * @param {number} quantity - requested quantity
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateStock = (product, quantity) => {
  if (!product) return { valid: false, error: 'Producto no encontrado.' }
  if (isNaN(quantity) || quantity <= 0) return { valid: false, error: 'Cantidad inválida.' }
  if (quantity > product.stock) {
    return { valid: false, error: `Solo tenemos ${product.stock} unidades en stock de ${product.nombre}.` }
  }
  return { valid: true }
}

/**
 * Build an order record ready for DB insertion.
 */
export const buildOrderRecord = (phone, product, quantity) => {
  return {
    cliente: phone,
    productoId: product.id,
    productoNombre: product.nombre,
    cantidad: quantity,
    total: product.precio * quantity,
    estado: 'pending',
    fecha: new Date().toISOString(),
  }
}

/**
 * Calculate the new stock after an order.
 */
export const calculateNewStock = (product, quantity) => {
  return product.stock - quantity
}
