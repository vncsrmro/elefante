// Example script for seeding local MCP connectors, agent folders, and skills in Elefante.
// Copy this to scripts/seed-elefante-ecosystem.mjs and adapt for your local environment.
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

const dbPath = process.env.ELEFANTE_DB || '.elefante/elefante.db'
if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)
const now = Date.now()

const agents = db.prepare(`SELECT id, name, handle FROM agents WHERE kind IS NULL OR kind != 'tuca'`).all()
console.log('Agents found:', agents.map((a) => a.name).join(', '))

// Example MCP Connectors:
// const connectors = [ ... ]

db.close()
console.log('Done.')
