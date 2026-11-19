const express = require('express');
const {
  requerirAutenticacion,
  requerirCapacidad,
} = require('../middleware/auth');

function crearRutas({ auth, inicio, solicitudes, usuarios, categorias, reportes, notificaciones }) {
  const router = express.Router();

  router.get('/login', auth.mostrarLogin.bind(auth));
  router.post('/login', auth.iniciarSesion.bind(auth));
  router.get('/logout', auth.cerrarSesion.bind(auth));

  router.use(requerirAutenticacion);

  router.get('/', inicio.dashboard.bind(inicio));

  router.get('/solicitudes', solicitudes.lista.bind(solicitudes));
  router.get('/solicitudes/nueva', requerirCapacidad('solicitudes.crear'), solicitudes.nueva.bind(solicitudes));
  router.post('/solicitudes', requerirCapacidad('solicitudes.crear'), solicitudes.crear.bind(solicitudes));
  router.get('/solicitudes/:codigo', solicitudes.detalle.bind(solicitudes));
  router.post('/solicitudes/:codigo/asignar', requerirCapacidad('solicitudes.asignar'), solicitudes.asignar.bind(solicitudes));
  router.post('/solicitudes/:codigo/estado', solicitudes.cambiarEstado.bind(solicitudes));
  router.post('/solicitudes/:codigo/observaciones', solicitudes.observacion.bind(solicitudes));

  router.get('/usuarios', requerirCapacidad('*'), usuarios.lista.bind(usuarios));
  router.post('/usuarios', requerirCapacidad('*'), usuarios.crear.bind(usuarios));
  router.post('/usuarios/:id', requerirCapacidad('*'), usuarios.editar.bind(usuarios));

  router.get('/categorias', requerirCapacidad('*'), categorias.lista.bind(categorias));
  router.post('/categorias', requerirCapacidad('*'), categorias.crear.bind(categorias));
  router.post('/categorias/:id', requerirCapacidad('*'), categorias.editar.bind(categorias));

  router.get('/reportes', requerirCapacidad('reportes.ver'), reportes.indice.bind(reportes));

  router.get('/notificaciones', notificaciones.lista.bind(notificaciones));
  router.post('/notificaciones/leer', notificaciones.marcarLeida.bind(notificaciones));
  router.post('/notificaciones/leer-todas', notificaciones.marcarTodas.bind(notificaciones));

  return router;
}

module.exports = { crearRutas };
