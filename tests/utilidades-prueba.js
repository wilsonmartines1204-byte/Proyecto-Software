const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

const { crearBase } = require('../src/db/connection');
const { crearContenedor } = require('../src/app');

function crearBasePrueba(nombre) {
  const ruta = path.join(os.tmpdir(), `sgsu-prueba-${process.pid}-${nombre}-${Date.now()}.db`);
  fs.rmSync(ruta, { force: true });
  const db = crearBase(ruta, { sembrar: false });
  return {
    db,
    ruta,
    limpiar() {
      try {
        db.close();
      } catch (error) {
        /* ya cerrada */
      }
      fs.rmSync(ruta, { force: true });
    },
  };
}

function prepararEscenario(nombre = 'escenario') {
  const base = crearBasePrueba(nombre);
  const db = base.db;

  db.exec(`
    INSERT INTO usuarios (codigo, nombre, email, password_hash, rol, activo) VALUES
      ('U-0001', 'Carla Admin', 'admin@uni.edu',      '${bcrypt.hashSync('Admin123!', 4)}', 'administrador', 1),
      ('U-0002', 'Ana Estudiante', 'ana@uni.edu',     '${bcrypt.hashSync('Estu123!', 4)}',  'estudiante', 1),
      ('U-0003', 'Luis Funcionario', 'luis@uni.edu',  '${bcrypt.hashSync('Func123!', 4)}',  'funcionario', 1),
      ('U-0004', 'Maria Supervisora', 'maria@uni.edu','${bcrypt.hashSync('Super123!', 4)}','supervisor', 1),
      ('U-0005', 'Pedro Estudiante', 'pedro@uni.edu', '${bcrypt.hashSync('Estu123!', 4)}',  'estudiante', 1),
      ('U-0006', 'Sofia Funcionaria', 'sofia@uni.edu','${bcrypt.hashSync('Func123!', 4)}',  'funcionario', 1),
      ('U-0007', 'Diego Estudiante', 'diego@uni.edu', '${bcrypt.hashSync('Estu123!', 4)}',  'estudiante', 0);
    INSERT INTO categorias (nombre, descripcion, activa) VALUES
      ('Matricula', 'Procesos de matricula.', 1),
      ('Becas', 'Becas y subsidios.', 1),
      ('Inactiva Demo', 'Categoria deshabilitada.', 0);
  `);

  const contenedor = crearContenedor({ db, secreto: 'prueba' });
  const usuarios = {
    admin: { id: 1, nombre: 'Carla Admin', email: 'admin@uni.edu', rol: 'administrador' },
    estudiante: { id: 2, nombre: 'Ana Estudiante', email: 'ana@uni.edu', rol: 'estudiante' },
    funcionario: { id: 3, nombre: 'Luis Funcionario', email: 'luis@uni.edu', rol: 'funcionario' },
    supervisor: { id: 4, nombre: 'Maria Supervisora', email: 'maria@uni.edu', rol: 'supervisor' },
    estudianteAjeno: { id: 5, nombre: 'Pedro Estudiante', email: 'pedro@uni.edu', rol: 'estudiante' },
    funcionario2: { id: 6, nombre: 'Sofia Funcionaria', email: 'sofia@uni.edu', rol: 'funcionario' },
    inactivo: { id: 7, nombre: 'Diego Estudiante', email: 'diego@uni.edu', rol: 'estudiante' },
  };

  return {
    ...base,
    ...contenedor,
    usuarios,
    async cerrar() {
      base.limpiar();
    },
  };
}

async function crearSolicitudPrueba(escenario, extras = {}) {
  return escenario.servicios.solicitudesService.crear({
    titulo: extras.titulo || 'Solicitud de prueba',
    descripcion: extras.descripcion || 'Descripcion de prueba para el caso.',
    categoriaId: extras.categoriaId || 1,
    prioridad: extras.prioridad || 'media',
    solicitante: extras.solicitante || escenario.usuarios.estudiante,
  });
}

module.exports = { crearBasePrueba, prepararEscenario, crearSolicitudPrueba };
