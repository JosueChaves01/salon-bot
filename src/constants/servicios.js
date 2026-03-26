// constants/servicios.js
// Catalogo oficial del salon — editar aqui para agregar o cambiar precios

export const SERVICIOS = Object.freeze({
  CORTE_DAMA: { nombre: 'Corte dama', duracion: 60, precio: 15000 },
  CORTE_CABALLERO: { nombre: 'Corte caballero', duracion: 30, precio: 8000 },
  TINTE: { nombre: 'Tinte completo', duracion: 120, precio: 35000 },
  MECHAS: { nombre: 'Mechas / highlights', duracion: 150, precio: 45000 },
  TRATAMIENTO: { nombre: 'Tratamiento capilar', duracion: 60, precio: 20000 },
  PEINADO: { nombre: 'Peinado especial', duracion: 90, precio: 25000 },
  MANICURE: { nombre: 'Manicure', duracion: 45, precio: 10000 },
  PEDICURE: { nombre: 'Pedicure', duracion: 60, precio: 12000 },
  MAQUILLAJE: { nombre: 'Maquillaje', duracion: 60, precio: 20000 },
})

export const ESTILISTAS = Object.freeze({
  HAYSSELL: { nombre: 'Hayssell', especialidades: Object.keys(SERVICIOS) },
})
