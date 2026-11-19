const { ROLES } = require('../domain/permisos');

class UsuarioController {
  constructor({ usuariosService, notificaciones }) {
    this.servicio = usuariosService;
    this.notificaciones = notificaciones;
  }

  lista(req, res) {
    return res.render('usuarios/lista', {
      titulo: 'Gestion de usuarios',
      usuarios: this.servicio.listar(),
      roles: ROLES,
      query: req.query,
      noLeidas: this.notificaciones.contarNoLeidas(req.session.usuario.id),
    });
  }

  async crear(req, res) {
    try {
      await this.servicio.crear({
        codigo: req.body.codigo,
        nombre: req.body.nombre,
        email: req.body.email,
        password: req.body.password,
        rol: req.body.rol,
      });
      req.session.flash = { tipo: 'exito', texto: 'Usuario creado correctamente.' };
      return res.redirect('/usuarios');
    } catch (error) {
      return res.redirect(`/usuarios?error=${encodeURIComponent(error.message)}`);
    }
  }

  async editar(req, res) {
    const id = Number(req.params.id || req.body.id);
    try {
      const activo = 'activoEstado' in req.body ? req.body.activo === 'on' : undefined;
      await this.servicio.actualizar(
        id,
        {
          nombre: req.body.nombre,
          email: req.body.email,
          rol: req.body.rol,
          activo,
        },
        req.session.usuario
      );
      req.session.flash = { tipo: 'exito', texto: 'Usuario actualizado correctamente.' };
      return res.redirect('/usuarios');
    } catch (error) {
      return res.redirect(`/usuarios?error=${encodeURIComponent(error.message)}`);
    }
  }
}

class CategoriaController {
  constructor({ categoriasService, notificaciones }) {
    this.servicio = categoriasService;
    this.notificaciones = notificaciones;
  }

  lista(req, res) {
    return res.render('categorias/lista', {
      titulo: 'Gestion de categorias',
      categorias: this.servicio.listar(false),
      query: req.query,
      noLeidas: this.notificaciones.contarNoLeidas(req.session.usuario.id),
    });
  }

  crear(req, res) {
    try {
      this.servicio.crear({ nombre: req.body.nombre, descripcion: req.body.descripcion });
      req.session.flash = { tipo: 'exito', texto: 'Categoria creada correctamente.' };
      return res.redirect('/categorias');
    } catch (error) {
      return res.redirect(`/categorias?error=${encodeURIComponent(error.message)}`);
    }
  }

  editar(req, res) {
    try {
      const datos = { nombre: req.body.nombre, descripcion: req.body.descripcion };
      if ('activaEstado' in req.body) datos.activa = req.body.activa === 'on';
      this.servicio.actualizar(Number(req.params.id || req.body.id), datos);
      req.session.flash = { tipo: 'exito', texto: 'Categoria actualizada correctamente.' };
      return res.redirect('/categorias');
    } catch (error) {
      return res.redirect(`/categorias?error=${encodeURIComponent(error.message)}`);
    }
  }
}

class ReporteController {
  constructor({ reportes, notificaciones }) {
    this.reportes = reportes;
    this.notificaciones = notificaciones;
  }

  indice(req, res) {
    const desde = req.query.desde || '';
    const hasta = req.query.hasta || '';
    const periodo = this.reportes.porPeriodo(desde || null, hasta || null);
    return res.render('reportes/index', {
      titulo: 'Reportes y estadisticas',
      resumen: this.reportes.resumenGeneral(),
      periodo,
      filtros: { desde, hasta },
      estadosEtiquetas: require('../domain/estados').ESTADOS_ETIQUETAS,
      noLeidas: this.notificaciones.contarNoLeidas(req.session.usuario.id),
    });
  }
}

class NotificacionController {
  constructor({ notificaciones }) {
    this.notificaciones = notificaciones;
  }

  lista(req, res) {
    const usuario = req.session.usuario;
    const items = this.notificaciones.listarPorUsuario(usuario.id);
    return res.render('notificaciones/lista', {
      titulo: 'Notificaciones',
      items,
      noLeidas: this.notificaciones.contarNoLeidas(usuario.id),
    });
  }

  marcarLeida(req, res) {
    this.notificaciones.marcarLeida(Number(req.body.id), req.session.usuario.id);
    return res.redirect(this._destinoSeguro(req, '/notificaciones'));
  }

  _destinoSeguro(req, respaldo) {
    const referencia = req.get('referer');
    if (!referencia) return respaldo;
    try {
      const url = new URL(referencia);
      const origen = `${req.protocol}://${req.get('host')}`;
      if (url.origin === origen) return `${url.pathname}${url.search}`;
    } catch (error) {
      return respaldo;
    }
    return respaldo;
  }

  marcarTodas(req, res) {
    this.notificaciones.marcarTodasLeidas(req.session.usuario.id);
    req.session.flash = { tipo: 'exito', texto: 'Notificaciones marcadas como leidas.' };
    return res.redirect('/notificaciones');
  }
}

module.exports = { UsuarioController, CategoriaController, ReporteController, NotificacionController };
