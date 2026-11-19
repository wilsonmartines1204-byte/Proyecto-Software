const fs = require('fs');
const path = require('path');
const { crearBase } = require('../src/db/connection');
const configuracion = require('../src/config');

const args = process.argv.slice(2);
const forzar = args.includes('--forzar');
const ruta = args.find((a) => !a.startsWith('--')) || configuracion.rutaBaseDatos;

if (forzar && fs.existsSync(ruta)) {
  fs.unlinkSync(ruta);
  console.log(`Base anterior eliminada: ${ruta}`);
}

const db = crearBase(ruta, { sembrar: true });
const usuarios = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
const categorias = db.prepare('SELECT COUNT(*) AS total FROM categorias').get().total;
const solicitudes = db.prepare('SELECT COUNT(*) AS total FROM solicitudes').get().total;
db.close();

console.log(`Base inicializada en ${ruta}`);
console.log(`  usuarios: ${usuarios}, categorias: ${categorias}, solicitudes: ${solicitudes}`);
console.log('Cuentas de prueba:');
console.log('  admin@universidad.edu / Admin123!        (administrador)');
console.log('  ana@universidad.edu / Estu123!           (estudiante)');
console.log('  valeria@universidad.edu / Estu123!       (estudiante, sin solicitudes)');
console.log('  luis@universidad.edu / Func123!          (funcionario)');
console.log('  maria@universidad.edu / Super123!        (supervisor)');
