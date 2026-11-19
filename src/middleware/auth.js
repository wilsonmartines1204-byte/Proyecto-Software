const { tieneCapacidad } = require('../domain/permisos');

function requerirAutenticacion(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login');
  }
  return next();
}

function requerirCapacidad(capacidad) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login');
    }
    if (!tieneCapacidad(req.session.usuario, capacidad)) {
      return res.status(403).render('error', {
        titulo: 'Acceso denegado',
        mensaje: 'No tiene permisos para realizar esta operacion.',
        usuario: req.session.usuario,
      });
    }
    return next();
  };
}

function adjuntarUsuario(req, res, next) {
  res.locals.usuario = (req.session && req.session.usuario) || null;
  res.locals.flash = req.session && req.session.flash ? req.session.flash : null;
  if (req.session) delete req.session.flash;
  next();
}

module.exports = {
  requerirAutenticacion,
  requerirCapacidad,
  adjuntarUsuario,
};
