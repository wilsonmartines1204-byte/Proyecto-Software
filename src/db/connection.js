const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const RUTA_SCHEMA = path.join(__dirname, 'schema.sql');

function abrirBase(ruta) {
  const dir = path.dirname(ruta);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

function inicializarEsquema(db) {
  const sql = fs.readFileSync(RUTA_SCHEMA, 'utf8');
  db.exec(sql);
}

function crearBase(ruta, { sembrar = false } = {}) {
  const db = abrirBase(ruta);
  inicializarEsquema(db);
  if (sembrar) {
    const { sembrarDatos } = require('./seed');
    sembrarDatos(db);
  }
  return db;
}

module.exports = { abrirBase, inicializarEsquema, crearBase };
