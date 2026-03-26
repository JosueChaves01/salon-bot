// domain/entities/Appointment.js
// Pure data entity — no external imports, no side effects

export class Appointment {
  constructor({ id, cliente, telefono, servicio, estilista, fecha, hora, nombre, duracion, estado, reminder_sent, created_at }) {
    this.id = id ?? null
    this.cliente = cliente ?? null
    this.telefono = telefono ?? null
    this.servicio = servicio ?? null
    this.estilista = estilista ?? 'HAYSSELL'
    this.fecha = fecha ?? null
    this.hora = hora ?? null
    this.nombre = nombre ?? null
    this.duracion = duracion ?? 60
    this.estado = estado ?? 'pending'
    this.reminder_sent = reminder_sent ?? false
    this.created_at = created_at ?? new Date().toISOString()
  }

  isPending() {
    return this.estado === 'pending'
  }

  isCancelled() {
    return this.estado === 'cancelled'
  }

  isCompleted() {
    return this.estado === 'completed'
  }

  toRecord() {
    return {
      id: this.id,
      cliente: this.cliente,
      telefono: this.telefono,
      servicio: this.servicio,
      estilista: this.estilista,
      fecha: this.fecha,
      hora: this.hora,
      nombre: this.nombre,
      duracion: this.duracion,
      estado: this.estado,
      reminder_sent: this.reminder_sent,
      created_at: this.created_at,
    }
  }
}
