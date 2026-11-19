const path = require('path');

module.exports = {
  puerto: parseInt(process.env.PORT || '3000', 10),
  rutaBaseDatos: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sgsu.db'),
  secretoSesion: process.env.SESSION_SECRET || 'sgsu-secreto-desarrollo-cambiar-en-produccion',
  nombreSistema: 'SGSU - Sistema de Gestion de Solicitudes Universitarias',
  diasSesion: 8 * 60 * 60 * 1000,
};
