const { crearApp } = require('./app');
const configuracion = require('./config');

const { app } = crearApp({ sembrar: true });

const servidor = app.listen(configuracion.puerto, '0.0.0.0', () => {
  console.log(`SGSU escuchando en http://0.0.0.0:${configuracion.puerto}`);
});

function apagar() {
  servidor.close(() => {
    try {
      app.locals.db.close();
    } catch (e) {
      /* base ya cerrada */
    }
    process.exit(0);
  });
}

process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
