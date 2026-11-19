const path = require('path');
const express = require('express');
const session = require('express-session');

const { crearBase } = require('./db/connection');
const { UsuarioRepository } = require('./repositories/UsuarioRepository');
const { CategoriaRepository } = require('./repositories/CategoriaRepository');
const { SolicitudRepository } = require('./repositories/SolicitudRepository');
const {
  HistorialRepository,
  ObservacionRepository,
  NotificacionRepository,
} = require('./repositories/HistorialRepository');

const { AuthService } = require('./services/AuthService');
const { UsuarioService, CategoriaService } = require('./services/AdminServices');
const { SolicitudService } = require('./services/SolicitudService');
const { ReporteService } = require('./services/ReporteService');
const { Notificador, ObservadorCorreo } = require('./services/Notificador');

const { AuthController } = require('./controllers/AuthController');
const { InicioController, SolicitudController } = require('./controllers/SolicitudController');
const {
  UsuarioController,
  CategoriaController,
  ReporteController,
  NotificacionController,
} = require('./controllers/AdminController');

const { crearRutas } = require('./routes/index');
const { adjuntarUsuario } = require('./middleware/auth');
const configuracion = require('./config');

function crearContenedor({ db, secreto }) {
  const repositorios = {
    usuarios: new UsuarioRepository(db),
    categorias: new CategoriaRepository(db),
    solicitudes: new SolicitudRepository(db),
    historiales: new HistorialRepository(db),
    observaciones: new ObservacionRepository(db),
    notificaciones: new NotificacionRepository(db),
  };

  const observadorCorreo = new ObservadorCorreo();
  const notificador = new Notificador(repositorios);
  notificador.suscribir(observadorCorreo);

  const servicios = {
    auth: new AuthService({ usuarios: repositorios.usuarios }),
    usuariosService: new UsuarioService({ usuarios: repositorios.usuarios, notificador }),
    categoriasService: new CategoriaService({ categorias: repositorios.categorias }),
    solicitudesService: new SolicitudService({
      db,
      solicitudes: repositorios.solicitudes,
      categorias: repositorios.categorias,
      usuarios: repositorios.usuarios,
      historiales: repositorios.historiales,
      observaciones: repositorios.observaciones,
      notificador,
    }),
    reportes: new ReporteService({ solicitudes: repositorios.solicitudes, db }),
    notificador,
    observadorCorreo,
  };

  const controladores = {
    auth: new AuthController({
      auth: servicios.auth,
      categorias: repositorios.categorias,
      solicitudes: repositorios.solicitudes,
      notificaciones: repositorios.notificaciones,
    }),
    inicio: new InicioController({
      solicitudes: repositorios.solicitudes,
      categorias: repositorios.categorias,
      usuarios: repositorios.usuarios,
      reportes: servicios.reportes,
      notificaciones: repositorios.notificaciones,
      solicitudesService: servicios.solicitudesService,
    }),
    solicitudes: new SolicitudController({
      solicitudesService: servicios.solicitudesService,
      categorias: repositorios.categorias,
      usuarios: repositorios.usuarios,
      notificaciones: repositorios.notificaciones,
    }),
    usuarios: new UsuarioController({
      usuariosService: servicios.usuariosService,
      notificaciones: repositorios.notificaciones,
    }),
    categorias: new CategoriaController({
      categoriasService: servicios.categoriasService,
      notificaciones: repositorios.notificaciones,
    }),
    reportes: new ReporteController({
      reportes: servicios.reportes,
      notificaciones: repositorios.notificaciones,
    }),
    notificaciones: new NotificacionController({
      notificaciones: repositorios.notificaciones,
    }),
  };

  return { repositorios, servicios, controladores, observadorCorreo };
}

function crearApp({ dbPath = configuracion.rutaBaseDatos, secreto = configuracion.secretoSesion, sembrar = false } = {}) {
  const db = crearBase(dbPath, { sembrar });
  const contenedor = crearContenedor({ db, secreto });

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(
    session({
      secret: secreto,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: configuracion.diasSesion, sameSite: 'lax' },
    })
  );
  app.use(adjuntarUsuario);

  app.use((req, res, next) => {
    res.locals.sistema = configuracion.nombreSistema;
    next();
  });

  app.use('/', crearRutas(contenedor.controladores));

  app.use((req, res) => {
    res.status(404).render('error', {
      titulo: 'Pagina no encontrada',
      mensaje: 'La ruta solicitada no existe.',
      usuario: req.session && req.session.usuario,
    });
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).render('error', {
      titulo: 'Error del servidor',
      mensaje: 'Ocurrio un error inesperado. Intente de nuevo.',
      usuario: req.session && req.session.usuario,
    });
  });

  app.locals.db = db;
  return { app, db, ...contenedor };
}

module.exports = { crearApp, crearContenedor };
