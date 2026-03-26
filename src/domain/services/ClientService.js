// domain/services/ClientService.js
// Pure business logic for client management — no DB or infrastructure imports.

/**
 * Build a client record ready for DB insertion.
 */
export const buildClientRecord = (phone, nombre) => {
  return {
    phone,
    nombre: nombre ?? null,
    created_at: new Date().toISOString(),
  }
}

/**
 * Find a client by phone in an array of client records.
 */
export const findClientByPhone = (clients, phone) => {
  return clients.find(c => c.phone === phone) ?? null
}
