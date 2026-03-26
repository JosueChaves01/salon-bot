// domain/entities/Client.js
// Pure data entity — no external imports, no side effects

export class Client {
  constructor({ id, phone, nombre, created_at }) {
    this.id = id ?? null
    this.phone = phone ?? null
    this.nombre = nombre ?? null
    this.created_at = created_at ?? new Date().toISOString()
  }

  toRecord() {
    return {
      id: this.id,
      phone: this.phone,
      nombre: this.nombre,
      created_at: this.created_at,
    }
  }
}
