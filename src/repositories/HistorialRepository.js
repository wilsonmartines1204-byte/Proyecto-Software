class HistorialRepository {
  constructor(db) {
    this.db = db;
  }

  agregar({ solicitudId, estadoAnterior, estadoNuevo, usuarioId, observacion }) {
    const r = this.db
      .prepare(
        `INSERT INTO historiales (solicitud_id, estado_anterior, estado_nuevo, usuario_id, observacion)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(solicitudId, estadoAnterior || null, estadoNuevo, usuarioId, observacion || null);
    return this.db.prepare('SELECT * FROM historiales WHERE id = ?').get(Number(r.lastInsertRowid));
  }

  listarPorSolicitud(solicitudId) {
    return this.db
      .prepare(
        `SELECT h.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
           FROM historiales h
           JOIN usuarios u ON u.id = h.usuario_id
          WHERE h.solicitud_id = ?
          ORDER BY datetime(h.fecha) DESC, h.id DESC`
      )
      .all(solicitudId);
  }
}

class ObservacionRepository {
  constructor(db) {
    this.db = db;
  }

  agregar({ solicitudId, usuarioId, texto, esSolucion = false }) {
    const r = this.db
      .prepare(
        'INSERT INTO observaciones (solicitud_id, usuario_id, texto, es_solucion) VALUES (?, ?, ?, ?)'
      )
      .run(solicitudId, usuarioId, texto, esSolucion ? 1 : 0);
    return this.db.prepare('SELECT * FROM observaciones WHERE id = ?').get(Number(r.lastInsertRowid));
  }

  listarPorSolicitud(solicitudId) {
    return this.db
      .prepare(
        `SELECT o.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
           FROM observaciones o
           JOIN usuarios u ON u.id = o.usuario_id
          WHERE o.solicitud_id = ?
          ORDER BY datetime(o.fecha) DESC, o.id DESC`
      )
      .all(solicitudId);
  }
}

class NotificacionRepository {
  constructor(db) {
    this.db = db;
  }

  crear({ usuarioId, solicitudId, tipo, mensaje }) {
    const r = this.db
      .prepare(
        'INSERT INTO notificaciones (usuario_id, solicitud_id, tipo, mensaje) VALUES (?, ?, ?, ?)'
      )
      .run(usuarioId, solicitudId || null, tipo, mensaje);
    return this.db.prepare('SELECT * FROM notificaciones WHERE id = ?').get(Number(r.lastInsertRowid));
  }

  listarPorUsuario(usuarioId, { soloNoLeidas = false } = {}) {
    const sql = soloNoLeidas
      ? `SELECT n.*, s.codigo AS solicitud_codigo
           FROM notificaciones n
           LEFT JOIN solicitudes s ON s.id = n.solicitud_id
          WHERE n.usuario_id = ? AND n.leida = 0
          ORDER BY datetime(n.fecha) DESC, n.id DESC`
      : `SELECT n.*, s.codigo AS solicitud_codigo
           FROM notificaciones n
           LEFT JOIN solicitudes s ON s.id = n.solicitud_id
          WHERE n.usuario_id = ?
          ORDER BY datetime(n.fecha) DESC, n.id DESC`;
    return this.db.prepare(sql).all(usuarioId);
  }

  marcarLeida(id, usuarioId) {
    this.db
      .prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?')
      .run(id, usuarioId);
  }

  marcarTodasLeidas(usuarioId) {
    this.db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(usuarioId);
  }

  contarNoLeidas(usuarioId) {
    return this.db
      .prepare('SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0')
      .get(usuarioId).total;
  }
}

module.exports = { HistorialRepository, ObservacionRepository, NotificacionRepository };
