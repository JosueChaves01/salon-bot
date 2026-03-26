// domain/entities/Order.js
// Pure data entity — no external imports, no side effects

export class Order {
  constructor({ id, cliente, productoId, productoNombre, cantidad, total, estado, fecha }) {
    this.id = id ?? null
    this.cliente = cliente ?? null
    this.productoId = productoId ?? null
    this.productoNombre = productoNombre ?? null
    this.cantidad = cantidad ?? 0
    this.total = total ?? 0
    this.estado = estado ?? 'pending'
    this.fecha = fecha ?? new Date().toISOString()
  }

  isPending() {
    return this.estado === 'pending'
  }

  toRecord() {
    return {
      id: this.id,
      cliente: this.cliente,
      productoId: this.productoId,
      productoNombre: this.productoNombre,
      cantidad: this.cantidad,
      total: this.total,
      estado: this.estado,
      fecha: this.fecha,
    }
  }
}
