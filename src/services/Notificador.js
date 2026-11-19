class Notificador {
  constructor({ notificaciones, usuarios }) {
    this.notificaciones = notificaciones;
    this.usuarios = usuarios;
    this.observadores = [];
  }

  suscribir(observador) {
    this.observadores.push(observador);
  }

  notificar({ destinatarios, solicitudId, tipo, mensaje }) {
    const creadas = [];
    for (const usuarioId of destinatarios) {
      const creada = this.notificaciones.crear({ usuarioId, solicitudId, tipo, mensaje });
      creadas.push(creada);
      for (const observador of this.observadores) {
        observador.actualizar({ destinatario: usuarioId, tipo, mensaje, solicitudId });
      }
    }
    return creadas;
  }

  notificarPorRol(rol, datos) {
    const destinatarios = this.usuarios.listarPorRol(rol).map((u) => u.id);
    if (!destinatarios.length) return [];
    return this.notificar({ ...datos, destinatarios });
  }

  notificarResponsable(responsableId, datos) {
    if (!responsableId) return [];
    return this.notificar({ ...datos, destinatarios: [responsableId] });
  }
}

class ObservadorCorreo {
  constructor() {
    this.enviados = [];
  }

  actualizar(evento) {
    this.enviados.push({ ...evento, canal: 'correo', estado: 'SIMULADO' });
  }
}

module.exports = { Notificador, ObservadorCorreo };
