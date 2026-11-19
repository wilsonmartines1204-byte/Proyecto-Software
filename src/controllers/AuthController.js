class AuthController {
  constructor({ auth, categorias, solicitudes, notificaciones }) {
    this.auth = auth;
    this.categorias = categorias;
    this.solicitudes = solicitudes;
    this.notificaciones = notificaciones;
  }

  mostrarLogin(req, res) {
    if (req.session.usuario) return res.redirect('/');
    return res.render('sesion/login', { titulo: 'Iniciar sesion', error: null });
  }

  async iniciarSesion(req, res) {
    try {
      const usuario = await this.auth.autenticar(req.body.email, req.body.password);
      req.session.usuario = usuario;
      req.session.flash = { tipo: 'exito', texto: `Bienvenido(a), ${usuario.nombre}.` };
      return res.redirect('/');
    } catch (error) {
      return res.status(401).render('sesion/login', {
        titulo: 'Iniciar sesion',
        error: error.message,
        email: req.body.email,
      });
    }
  }

  cerrarSesion(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
}

module.exports = { AuthController };
