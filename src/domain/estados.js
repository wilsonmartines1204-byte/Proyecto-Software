const ESTADOS = Object.freeze({
  REGISTRADA: 'REGISTRADA',
  ASIGNADA: 'ASIGNADA',
  EN_PROCESO: 'EN_PROCESO',
  RESUELTA: 'RESUELTA',
  CERRADA: 'CERRADA',
  RECHAZADA: 'RECHAZADA',
  REABIERTA: 'REABIERTA',
});

const ESTADOS_ETIQUETAS = Object.freeze({
  REGISTRADA: 'Registrada',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
  REABIERTA: 'Reabierta',
});

const PRIORIDADES = Object.freeze(['baja', 'media', 'alta', 'critica']);

const TRANSICIONES = Object.freeze([
  { de: ESTADOS.REGISTRADA, a: ESTADOS.ASIGNADA, roles: ['administrador', 'supervisor'],
    requiere: ['responsable'], descripcion: 'Asignar responsable' },
  { de: ESTADOS.REGISTRADA, a: ESTADOS.RECHAZADA, roles: ['administrador', 'supervisor'],
    requiere: ['motivo'], descripcion: 'Rechazar solicitud' },
  { de: ESTADOS.ASIGNADA, a: ESTADOS.EN_PROCESO, roles: ['funcionario', 'administrador'],
    requiere: [], soloResponsable: true, descripcion: 'Iniciar atencion' },
  { de: ESTADOS.ASIGNADA, a: ESTADOS.ASIGNADA, roles: ['administrador', 'supervisor'],
    requiere: ['responsable'], descripcion: 'Reasignar responsable' },
  { de: ESTADOS.ASIGNADA, a: ESTADOS.RECHAZADA, roles: ['administrador', 'supervisor', 'funcionario'],
    requiere: ['motivo'], soloResponsable: true, descripcion: 'Rechazar solicitud' },
  { de: ESTADOS.EN_PROCESO, a: ESTADOS.RESUELTA, roles: ['funcionario', 'administrador'],
    requiere: ['solucion'], soloResponsable: true, descripcion: 'Resolver con solucion final' },
  { de: ESTADOS.EN_PROCESO, a: ESTADOS.RECHAZADA, roles: ['funcionario', 'administrador', 'supervisor'],
    requiere: ['motivo'], soloResponsable: true, descripcion: 'Rechazar en atencion' },
  { de: ESTADOS.EN_PROCESO, a: ESTADOS.ASIGNADA, roles: ['administrador', 'supervisor'],
    requiere: ['responsable'], descripcion: 'Reasignar durante atencion' },
  { de: ESTADOS.RESUELTA, a: ESTADOS.CERRADA, roles: ['estudiante', 'administrador', 'supervisor'],
    requiere: [], soloSolicitante: true, descripcion: 'Cerrar solicitud resuelta' },
  { de: ESTADOS.RESUELTA, a: ESTADOS.REABIERTA, roles: ['estudiante', 'administrador'],
    requiere: ['motivo'], soloSolicitante: true, descripcion: 'Reabrir por inconformidad' },
  { de: ESTADOS.RECHAZADA, a: ESTADOS.REABIERTA, roles: ['estudiante', 'administrador'],
    requiere: ['motivo'], soloSolicitante: true, descripcion: 'Reabrir solicitud rechazada' },
  { de: ESTADOS.CERRADA, a: ESTADOS.REABIERTA, roles: ['administrador', 'supervisor'],
    requiere: ['motivo'], descripcion: 'Reapertura autorizada (solo administrador o supervisor)' },
  { de: ESTADOS.REABIERTA, a: ESTADOS.ASIGNADA, roles: ['administrador', 'supervisor'],
    requiere: ['responsable'], descripcion: 'Reasignar tras reapertura' },
  { de: ESTADOS.REABIERTA, a: ESTADOS.EN_PROCESO, roles: ['funcionario', 'administrador'],
    requiere: [], soloResponsable: true, descripcion: 'Retomar atencion' },
]);

class ErrorTransicion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorTransicion';
    this.estado = 'TRANSICION_INVALIDA';
  }
}

function esEstadoValido(estado) {
  return Object.values(ESTADOS).includes(estado);
}

function buscarTransicion(de, a) {
  return TRANSICIONES.find((t) => t.de === de && t.a === a) || null;
}

function puedeEjecutar(transicion, usuario, solicitud) {
  if (!transicion.roles.includes(usuario.rol)) return false;
  if (transicion.soloResponsable && usuario.rol === 'funcionario') {
    if (!solicitud || solicitud.responsable_id !== usuario.id) return false;
  }
  if (transicion.soloSolicitante && (usuario.rol === 'estudiante' || usuario.rol === 'funcionario')) {
    if (!solicitud || solicitud.solicitante_id !== usuario.id) return false;
  }
  return true;
}

function transicionesPermitidas(usuario, solicitud) {
  if (!solicitud) return [];
  return TRANSICIONES.filter((t) => t.de === solicitud.estado && puedeEjecutar(t, usuario, solicitud));
}

function validarTransicion({ estadoActual, nuevoEstado, usuario, solicitud, motivo, solucion, responsableId }) {
  if (!esEstadoValido(nuevoEstado)) {
    throw new ErrorTransicion(`Estado destino desconocido: ${nuevoEstado}`);
  }
  const transicion = buscarTransicion(estadoActual, nuevoEstado);
  if (!transicion) {
    throw new ErrorTransicion(`Transicion no permitida: ${estadoActual} -> ${nuevoEstado}`);
  }
  if (!puedeEjecutar(transicion, usuario, solicitud)) {
    throw new ErrorTransicion(`El usuario con rol '${usuario.rol}' no esta autorizado para: ${transicion.descripcion}`);
  }
  if (transicion.requiere.includes('motivo') && (!motivo || !motivo.trim())) {
    throw new ErrorTransicion('Debe indicar un motivo u observacion para esta operacion.');
  }
  if (transicion.requiere.includes('solucion') && (!solucion || !solucion.trim())) {
    throw new ErrorTransicion('Para marcar la solicitud como Resuelta debe registrar la solucion u observacion final.');
  }
  if (transicion.requiere.includes('responsable') && !responsableId) {
    throw new ErrorTransicion('Debe seleccionar un responsable para esta operacion.');
  }
  return transicion;
}

module.exports = {
  ESTADOS,
  ESTADOS_ETIQUETAS,
  PRIORIDADES,
  TRANSICIONES,
  ErrorTransicion,
  esEstadoValido,
  buscarTransicion,
  puedeEjecutar,
  transicionesPermitidas,
  validarTransicion,
};
