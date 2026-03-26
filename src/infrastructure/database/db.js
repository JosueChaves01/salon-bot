import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), 'data')

const defaultData = {
  clients: [],
  appointments: [],
  services: [
    { id: '1', nombre: 'Corte dama', duracion: 60, precio: 15000 },
    { id: '2', nombre: 'Tinte completo', duracion: 120, precio: 35000 },
    { id: '3', nombre: 'Manicure', duracion: 45, precio: 10000 }
  ],
  products: [
    { id: '1', nombre: 'Shampoo Olaplex', precio: 25000, stock: 10 },
    { id: '2', nombre: 'Tratamiento Moroccanoil', precio: 30000, stock: 5 }
  ],
  orders: [],
  conversation_state: {}
}

const getFilePath = (table) => path.join(DB_DIR, `${table}.json`)

const ensureDbExists = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  Object.keys(defaultData).forEach(table => {
    const file = getFilePath(table)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData[table], null, 2))
    }
  })
}

ensureDbExists()

export const db = {
  read: (table) => {
    try {
      const data = fs.readFileSync(getFilePath(table), 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      return defaultData[table]
    }
  },
  write: (table, data) => {
    fs.writeFileSync(getFilePath(table), JSON.stringify(data, null, 2))
  },

  // Helpers
  findById: (table, id) => {
    const items = db.read(table)
    return Array.isArray(items) ? items.find(i => i.id === id) : items[id]
  },

  update: (table, id, newData) => {
    const items = db.read(table)
    if (Array.isArray(items)) {
      const index = items.findIndex(i => i.id === id)
      if (index !== -1) {
        items[index] = { ...items[index], ...newData }
        db.write(table, items)
        return items[index]
      }
    } else {
      items[id] = { ...items[id], ...newData }
      db.write(table, items)
      return items[id]
    }
    return null
  },

  insert: (table, data) => {
    const items = db.read(table)
    const newItem = { id: Date.now().toString(), ...data }
    if (Array.isArray(items)) {
      items.push(newItem)
    } else {
      items[newItem.id] = newItem
    }
    db.write(table, items)
    return newItem
  }
}
