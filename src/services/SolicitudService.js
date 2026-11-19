const {
  ESTADOS,
  PRIORIDADES,
  ErrorTransicion,
  validarTransicion,
  transicionesPermitidas,
} = require('../domain/estados');
const { puedeVerSolicitud, tieneCapacidad } = require('../domain/permisos');

class ErrorSolicitud extends Error {
  constructor(mensaje, estado = 'VALIDACION') {
    super(mensaje);
    this.name = 'ErrorSolicitud';
    this.estado = estado;
  }
}

class SolicitudService {
  constructor({ db, solicitudes, categorias, usuarios, historiales, observaciones, notificador }) {
    this.db = db;
    this.solicitudes = solicitudes;
    this.categorias = categorias;
    this.usuarios = usuarios;
    this.historiales = historiales;
    this.observaciones = observaciones;
    this.notificador = notificador;
  }

  _transaccion(fn) {
    if (!this.db) return fn();
    this.db.exec('BEGIN');
    try {
      const resultado = fn();
      this.db.exec('COMMIT');
      return resultado;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listarParaUsuario(filtros, usuario) {
    if (!usuario) throw new ErrorSolicitud('No autenticado.', 'AUTENTICACION');
    let base = { ...filtros };
    if (usuario.rol === 'estudiante') base.solicitanteId = usuario.id;
    if (usuario.rol === 'funcionario') base.responsableId = usuario.id;
    return this.solicitudes.listar(base);
  }

  obtener(codigo, usuario) {
    const solicitud = this.solicitudes.porCodigo(codigo);
    if (!solicitud) throw new ErrorSolicitud('Solicitud no encontrada.', 'NO_ENCONTRADA');
    if (!puedeVerSolicitud(usuario, solicitud)) {
      throw new ErrorSolicitud('No tiene permiso para consultar esta solicitud.', 'PROHIBIDO');
    }
    return solicitud;
  }

  obtenerDetalle(codigo, usuario) {
    const solicitud = this.obtener(codigo, usuario);
    return {
      solicitud,
      historial: this.historiales.listarPorSolicitud(solicitud.id),
      observaciones: this.observaciones.listarPorSolicitud(solicitud.id),
      transiciones: transicionesPermitidas(usuario, solicitud),
    };
  }

  async crear({ titulo, descripcion, categoriaId, prioridad, solicitante }) {
    if (!tieneCapacidad(solicitante, 'solicitudes.crear')) {
      throw new ErrorSolicitud('Su rol no permite registrar solicitudes.', 'PROHIBIDO');
    }
    if (!titulo || !String(titulo).trim()) throw new ErrorSolicitud('El titulo es obligatorio.');
    if (!descripcion || !String(descripcion).trim()) {
      throw new ErrorSolicitud('La descripcion es obligatoria.');
    }
    if (!categoriaId) throw new ErrorSolicitud('Debe seleccionar una categoria.');
    if (!PRIORIDADES.includes(prioridad)) {
      throw new ErrorSolicitud('Prioridad invalida. Valores admitidos: baja, media, alta, critica.');
    }
    const categoria = this.categorias.porId(Number(categoriaId));
    if (!categoria || !categoria.activa) {
      throw new ErrorSolicitud('La categoria seleccionada no existe o esta inactiva.');
    }
    const codigo = this.solicitudes.siguienteCodigo(new Date().getFullYear());
    const solicitud = this._transaccion(() => {
      const creada = this.solicitudes.crear({
        codigo,
        solicitanteId: solicitante.id,
        categoriaId: categoria.id,
        titulo: String(titulo).trim(),
        descripcion: String(descripcion).trim(),
        prioridad,
        estado: ESTADOS.REGISTRADA,
      });
      this.historiales.agregar({
        solicitudId: creada.id,
        estadoAnterior: null,
        estadoNuevo: ESTADOS.REGISTRADA,
        usuarioId: solicitante.id,
        observacion: 'Registro inicial de la solicitud.',
      });
      return creada;
    });
    this.notificador.notificarPorRol('administrador', {
      solicitudId: solicitud.id,
      tipo: 'REGISTRO',
      mensaje: `Nueva solicitud ${codigo}: "${solicitud.titulo}" registrada por ${solicitante.nombre}.`,
    });
    this.notificador.notificarPorRol('supervisor', {
      solicitudId: solicitud.id,
      tipo: 'REGISTRO',
      mensaje: `Nueva solicitud ${codigo}: "${solicitud.titulo}" registrada por ${solicitante.nombre}.`,
    });
    if (solicitante.rol !== 'administrador' && solicitante.rol !== 'supervisor') {
      this.notificador.notificar({
        destinatarios: [solicitante.id],
        solicitudId: solicitud.id,
        tipo: 'REGISTRO',
        mensaje: `Su solicitud ${codigo} fue registrada correctamente. Recibira un aviso cada vez que cambie de estado.`,
      });
    }
    return solicitud;
  }

  asignar({ codigo, responsableId, usuario, motivo }) {
    const solicitud = this.obtener(codigo, usuario);
    if (!tieneCapacidad(usuario, 'solicitudes.asignar') && usuario.rol !== 'administrador') {
      throw new ErrorSolicitud('Solo un usuario autorizado puede asignar o reasignar responsables.', 'PROHIBIDO');
    }
    const responsable = this.usuarios.porId(Number(responsableId));
    if (!responsable || !responsable.activo) {
      throw new ErrorSolicitud('El responsable seleccionado no existe o esta inactivo.');
    }
    if (responsable.rol !== 'funcionario') {
      throw new ErrorSolicitud('El responsable debe ser un usuario con rol funcionario.');
    }
    const transicion = validarTransicion({
      estadoActual: solicitud.estado,
      nuevoEstado: ESTADOS.ASIGNADA,
      usuario,
      solicitud,
      motivo,
      responsableId: responsable.id,
    });
    const estadoAnterior = solicitud.estado;
    const actualizada = this._transaccion(() => {
      const actualizadaInterna = this.solicitudes.actualizarEstado(solicitud.id, {
        estado: ESTADOS.ASIGNADA,
        responsableId: responsable.id,
      });
      this.historiales.agregar({
        solicitudId: solicitud.id,
        estadoAnterior,
        estadoNuevo: ESTADOS.ASIGNADA,
        usuarioId: usuario.id,
        observacion: motivo || `Asignada a ${responsable.nombre}. ${transicion.descripcion}.`,
      });
      return actualizadaInterna;
    });
    this.notificador.notificarResponsable(responsable.id, {
      solicitudId: solicitud.id,
      tipo: 'ASIGNACION',
      mensaje: `Se le ha asignado la solicitud ${solicitud.codigo} "${solicitud.titulo}".`,
    });
    this.notificador.notificar({
      destinatarios: [solicitud.solicitante_id],
      solicitudId: solicitud.id,
      tipo: 'ACTUALIZACION',
      mensaje: `Su solicitud ${solicitud.codigo} fue asignada a ${responsable.nombre}.`,
    });
    return actualizada;
  }

  cambiarEstado({ codigo, nuevoEstado, usuario, motivo, solucion, responsableId }) {
    const solicitud = this.obtener(codigo, usuario);
    if (!tieneCapacidad(usuario, 'solicitudes.gestionar') && usuario.rol !== 'funcionario'
      && usuario.rol !== 'estudiante') {
      throw new ErrorSolicitud('Su rol no permite actualizar el estado de solicitudes.', 'PROHIBIDO');
    }
    const transicion = validarTransicion({
      estadoActual: solicitud.estado,
      nuevoEstado,
      usuario,
      solicitud,
      motivo,
      solucion,
      responsableId: responsableId || undefined,
    });
    const estadoAnterior = solicitud.estado;
    const conservarSolucion = nuevoEstado === ESTADOS.CERRADA;
    const actualizada = this._transaccion(() => {
      const actualizadaInterna = this.solicitudes.actualizarEstado(solicitud.id, {
        estado: nuevoEstado,
        responsableId: transicion.requiere.includes('responsable') ? Number(responsableId) : undefined,
        solucion: nuevoEstado === ESTADOS.RESUELTA ? solucion : conservarSolucion ? undefined : null,
      });
      const observacionRegistro = nuevoEstado === ESTADOS.RESUELTA
        ? `Solucion registrada: ${solucion}`
        : motivo || transicion.descripcion;
      this.historiales.agregar({
        solicitudId: solicitud.id,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        usuarioId: usuario.id,
        observacion: observacionRegistro,
      });
      if (nuevoEstado === ESTADOS.RESUELTA) {
        this.observaciones.agregar({
          solicitudId: solicitud.id,
          usuarioId: usuario.id,
          texto: solucion,
          esSolucion: true,
        });
      }
      return actualizadaInterna;
    });
    this._notificarCambio({ solicitud, estadoAnterior, nuevoEstado, usuario, motivo, transicion });
    return actualizada;
  }

  _notificarCambio({ solicitud, nuevoEstado, usuario, motivo, transicion }) {
    const etiqueta = nuevoEstado.replace('_', ' ');
    if (solicitud.solicitante_id !== usuario.id) {
      this.notificador.notificar({
        destinatarios: [solicitud.solicitante_id],
        solicitudId: solicitud.id,
        tipo: 'ACTUALIZACION',
        mensaje: `Su solicitud ${solicitud.codigo} paso a estado ${etiqueta}. ${motivo || transicion.descripcion}`,
      });
    }
    if (solicitud.responsable_id && solicitud.responsable_id !== usuario.id) {
      this.notificador.notificar({
        destinatarios: [solicitud.responsable_id],
        solicitudId: solicitud.id,
        tipo: 'ACTUALIZACION',
        mensaje: `La solicitud ${solicitud.codigo} ahora esta en estado ${etiqueta}.`,
      });
    }
    if (nuevoEstado === ESTADOS.REGISTRADA) {
      this.notificador.notificarPorRol('supervisor', {
        solicitudId: solicitud.id,
        tipo: 'ACTUALIZACION',
        mensaje: `La solicitud ${solicitud.codigo} regreso al estado Registrada.`,
      });
    }
  }

  agregarObservacion({ codigo, usuario, texto, esSolucion = false }) {
    const solicitud = this.obtener(codigo, usuario);
    if (!texto || !String(texto).trim()) {
      throw new ErrorSolicitud('La observacion no puede estar vacia.');
    }
    const esPropia = solicitud.solicitante_id === usuario.id;
    const esResponsable = solicitud.responsable_id === usuario.id;
    const permitido =
      tieneCapacidad(usuario, 'observaciones.crear') ||
      (esPropia && tieneCapacidad(usuario, 'observaciones.crearPropias')) ||
      (esResponsable && tieneCapacidad(usuario, 'observaciones.crear'));
    if (!permitido) {
      throw new ErrorSolicitud('No esta autorizado para agregar observaciones.', 'PROHIBIDO');
    }
    if (solicitud.estado === ESTADOS.CERRADA) {
      throw new ErrorSolicitud('Una solicitud Cerrada no admite nuevas observaciones; solicite una reapertura.', 'REGLA_NEGOCIO');
    }
    const creada = this.observaciones.agregar({
      solicitudId: solicitud.id,
      usuarioId: usuario.id,
      texto: String(texto).trim(),
      esSolucion,
    });
    const destinatarios = new Set();
    if (solicitud.solicitante_id !== usuario.id) destinatarios.add(solicitud.solicitante_id);
    if (solicitud.responsable_id && solicitud.responsable_id !== usuario.id) {
      destinatarios.add(solicitud.responsable_id);
    }
    if (destinatarios.size) {
      this.notificador.notificar({
        destinatarios: [...destinatarios],
        solicitudId: solicitud.id,
        tipo: 'OBSERVACION',
        mensaje: `Nueva observacion en la solicitud ${solicitud.codigo} por ${usuario.nombre}.`,
      });
    }
    return creada;
  }

  resumenParaUsuario(usuario) {
    if (usuario.rol === 'estudiante') {
      const propias = this.solicitudes.listar({ solicitanteId: usuario.id });
      const porEstado = Object.fromEntries(
        propias.reduce((mapa, s) => mapa.set(s.estado, (mapa.get(s.estado) || 0) + 1), new Map())
      );
      return {
        total: propias.length,
        abiertas: ['REGISTRADA', 'ASIGNADA', 'EN_PROCESO', 'REABIERTA']
          .reduce((n, e) => n + (porEstado[e] || 0), 0),
        propias,
        porEstado,
      };
    }
    if (usuario.rol === 'funcionario') {
      const asignadas = this.solicitudes.listar({ responsableId: usuario.id });
      const porEstado = Object.fromEntries(
        asignadas.reduce((mapa, s) => mapa.set(s.estado, (mapa.get(s.estado) || 0) + 1), new Map())
      );
      return {
        total: asignadas.length,
        asignadas,
        porEstado,
      };
    }
    const estados = this.solicitudes.contarPorEstado();
    const porEstado = Object.fromEntries(estados.map((e) => [e.estado, e.total]));
    return {
      total: this.solicitudes.contar(),
      porEstado,
      pendientesAsignar: (porEstado[ESTADOS.REGISTRADA] || 0) + (porEstado[ESTADOS.REABIERTA] || 0),
    };
  }
}

module.exports = { SolicitudService, ErrorSolicitud, ErrorTransicion };
