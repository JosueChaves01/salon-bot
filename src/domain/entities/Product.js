// domain/entities/Product.js
// Pure data entity — no external imports, no side effects

export class Product {
  constructor({ id, nombre, descripcion, uso, precio, stock }) {
    this.id = id ?? null
    this.nombre = nombre ?? null
    this.descripcion = descripcion ?? null
    this.uso = uso ?? null
    this.precio = precio ?? 0
    this.stock = stock ?? 0
  }

  isAvailable() {
    return this.stock > 0
  }

  hasEnoughStock(quantity) {
    return this.stock >= quantity
  }

  toRecord() {
    return {
      id: this.id,
      nombre: this.nombre,
      descripcion: this.descripcion,
      uso: this.uso,
      precio: this.precio,
      stock: this.stock,
    }
  }
}
