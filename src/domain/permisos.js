const ROLES = Object.freeze(['administrador', 'estudiante', 'funcionario', 'supervisor']);

const CAPACIDADES = Object.freeze({
  administrador: ['*'],
  supervisor: [
    'solicitudes.verTodas',
    'solicitudes.crear',
    'solicitudes.asignar',
    'solicitudes.atender',
    'solicitudes.gestionar',
    'observaciones.crear',
    'reportes.ver',
    'notificaciones.ver',
  ],
  funcionario: [
    'solicitudes.verAsignadas',
    'solicitudes.atender',
    'observaciones.crear',
    'notificaciones.ver',
  ],
  estudiante: [
    'solicitudes.crear',
    'solicitudes.verPropias',
    'solicitudes.cerrarPropias',
    'observaciones.crearPropias',
    'notificaciones.ver',
  ],
});

function tieneCapacidad(usuario, capacidad) {
  if (!usuario) return false;
  const permitidas = CAPACIDADES[usuario.rol] || [];
  return permitidas.includes('*') || permitidas.includes(capacidad);
}

function puedeVerSolicitud(usuario, solicitud) {
  if (!usuario || !solicitud) return false;
  if (usuario.rol === 'administrador' || usuario.rol === 'supervisor') return true;
  if (usuario.rol === 'estudiante') return solicitud.solicitante_id === usuario.id;
  if (usuario.rol === 'funcionario') {
    return solicitud.responsable_id === usuario.id;
  }
  return false;
}

function filtroVisibilidad(usuario) {
  if (usuario.rol === 'estudiante') return { columna: 'solicitante_id', valor: usuario.id };
  if (usuario.rol === 'funcionario') return { columna: 'responsable_id', valor: usuario.id };
  return null;
}

function esRolValido(rol) {
  return ROLES.includes(rol);
}

module.exports = { ROLES, CAPACIDADES, tieneCapacidad, puedeVerSolicitud, filtroVisibilidad, esRolValido };
