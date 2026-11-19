const { ESTADOS_ETIQUETAS, PRIORIDADES } = require('../domain/estados');
const { ROLES } = require('../domain/permisos');

class InicioController {
  constructor({ solicitudes, categorias, usuarios, reportes, notificaciones, solicitudesService }) {
    this.solicitudes = solicitudes;
    this.categorias = categorias;
    this.usuarios = usuarios;
    this.reportes = reportes;
    this.notificaciones = notificaciones;
    this.solicitudesService = solicitudesService;
  }

  dashboard(req, res) {
    const usuario = req.session.usuario;
    const resumen = this.solicitudesService.resumenParaUsuario(usuario);
    const noLeidas = this.notificaciones.contarNoLeidas(usuario.id);
    let recientes = [];
    if (usuario.rol === 'estudiante') {
      recientes = this.solicitudes.listar({ solicitanteId: usuario.id }).slice(0, 5);
    } else if (usuario.rol === 'funcionario') {
      recientes = this.solicitudes.listar({ responsableId: usuario.id }).slice(0, 5);
    } else {
      recientes = this.solicitudes.listar({}).slice(0, 5);
    }
    return res.render('inicio', {
      titulo: 'Panel principal',
      resumen,
      recientes,
      noLeidas,
      estadosEtiquetas: ESTADOS_ETIQUETAS,
    });
  }
}

class SolicitudController {
  constructor({ solicitudesService, categorias, usuarios, notificaciones }) {
    this.servicio = solicitudesService;
    this.categorias = categorias;
    this.usuarios = usuarios;
    this.notificaciones = notificaciones;
  }

  lista(req, res) {
    const usuario = req.session.usuario;
    const filtros = {
      estado: req.query.estado || '',
      categoriaId: req.query.categoriaId || '',
      prioridad: req.query.prioridad || '',
      responsableId: req.query.responsableId || '',
      busqueda: req.query.busqueda || '',
      desde: req.query.desde || '',
      hasta: req.query.hasta || '',
    };
    Object.keys(filtros).forEach((k) => { if (!filtros[k]) delete filtros[k]; });
    const solicitudes = this.servicio.listarParaUsuario(filtros, usuario);
    const puedeCrear = ['estudiante', 'administrador', 'supervisor'].includes(usuario.rol);
    const puedeAsignar = ['administrador', 'supervisor'].includes(usuario.rol);
    return res.render('solicitudes/lista', {
      titulo: usuario.rol === 'funcionario' ? 'Solicitudes asignadas'
        : usuario.rol === 'estudiante' ? 'Mis solicitudes' : 'Solicitudes',
      solicitudes,
      filtros,
      categorias: this.categorias.listar({ soloActivas: true }),
      funcionarios: this.usuarios.listarPorRol('funcionario'),
      estadosEtiquetas: ESTADOS_ETIQUETAS,
      prioridades: PRIORIDADES,
      puedeCrear,
      puedeAsignar,
      noLeidas: this.notificaciones.contarNoLeidas(usuario.id),
    });
  }

  nueva(req, res) {
    return res.render('solicitudes/nueva', {
      titulo: 'Registrar solicitud',
      categorias: this.categorias.listar({ soloActivas: true }),
      prioridades: PRIORIDADES,
      error: null,
      datos: {},
      noLeidas: this.notificaciones.contarNoLeidas(req.session.usuario.id),
    });
  }

  async crear(req, res) {
    const usuario = req.session.usuario;
    const datos = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      categoriaId: req.body.categoriaId,
      prioridad: req.body.prioridad,
    };
    try {
      const solicitud = await this.servicio.crear({ ...datos, solicitante: usuario });
      req.session.flash = {
        tipo: 'exito',
        texto: `Solicitud ${solicitud.codigo} registrada correctamente.`,
      };
      return res.redirect(`/solicitudes/${solicitud.codigo}`);
    } catch (error) {
      return res.status(400).render('solicitudes/nueva', {
        titulo: 'Registrar solicitud',
        categorias: this.categorias.listar({ soloActivas: true }),
        prioridades: PRIORIDADES,
        error: error.message,
        datos,
        noLeidas: this.notificaciones.contarNoLeidas(usuario.id),
      });
    }
  }

  detalle(req, res) {
    const usuario = req.session.usuario;
    try {
      const detalle = this.servicio.obtenerDetalle(req.params.codigo, usuario);
      const puedeAsignar = ['administrador', 'supervisor'].includes(usuario.rol);
      return res.render('solicitudes/detalle', {
        titulo: `Solicitud ${detalle.solicitud.codigo}`,
        ...detalle,
        query: req.query,
        estadosEtiquetas: ESTADOS_ETIQUETAS,
        prioridades: PRIORIDADES,
        funcionarios: puedeAsignar ? this.usuarios.listarPorRol('funcionario') : [],
        puedeAsignar,
        puedeObservar: true,
        error: null,
        noLeidas: this.notificaciones.contarNoLeidas(usuario.id),
      });
    } catch (error) {
      return res.status(error.estado === 'NO_ENCONTRADA' ? 404 : 403).render('error', {
        titulo: 'Solicitud no disponible',
        mensaje: error.message,
        usuario,
      });
    }
  }

  asignar(req, res) {
    const usuario = req.session.usuario;
    try {
      this.servicio.asignar({
        codigo: req.params.codigo,
        responsableId: req.body.responsableId,
        usuario,
        motivo: req.body.motivo,
      });
      req.session.flash = { tipo: 'exito', texto: 'Responsable asignado correctamente.' };
      return res.redirect(`/solicitudes/${req.params.codigo}`);
    } catch (error) {
      return res.status(400).redirect(`/solicitudes/${req.params.codigo}?error=${encodeURIComponent(error.message)}`);
    }
  }

  cambiarEstado(req, res) {
    const usuario = req.session.usuario;
    try {
      this.servicio.cambiarEstado({
        codigo: req.params.codigo,
        nuevoEstado: req.body.nuevoEstado,
        usuario,
        motivo: req.body.motivo,
        solucion: req.body.solucion,
        responsableId: req.body.responsableId,
      });
      req.session.flash = { tipo: 'exito', texto: 'Estado actualizado correctamente.' };
      return res.redirect(`/solicitudes/${req.params.codigo}`);
    } catch (error) {
      return res.status(400).redirect(`/solicitudes/${req.params.codigo}?error=${encodeURIComponent(error.message)}`);
    }
  }

  observacion(req, res) {
    const usuario = req.session.usuario;
    try {
      this.servicio.agregarObservacion({
        codigo: req.params.codigo,
        usuario,
        texto: req.body.texto,
        esSolucion: req.body.es_solucion === 'on',
      });
      req.session.flash = { tipo: 'exito', texto: 'Observacion registrada.' };
      return res.redirect(`/solicitudes/${req.params.codigo}`);
    } catch (error) {
      return res.status(400).redirect(`/solicitudes/${req.params.codigo}?error=${encodeURIComponent(error.message)}`);
    }
  }
}

module.exports = { InicioController, SolicitudController };
