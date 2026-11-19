class UsuarioRepository {
  constructor(db) {
    this.db = db;
  }

  listar({ incluirInactivos = true } = {}) {
    const sql = incluirInactivos
      ? 'SELECT id, codigo, nombre, email, rol, activo, creado_en, actualizado_en FROM usuarios ORDER BY nombre'
      : "SELECT id, codigo, nombre, email, rol, activo, creado_en, actualizado_en FROM usuarios WHERE activo = 1 ORDER BY nombre";
    return this.db.prepare(sql).all();
  }

  listarPorRol(rol, { activos = true } = {}) {
    const sql = activos
      ? 'SELECT id, codigo, nombre, email, rol, activo FROM usuarios WHERE rol = ? AND activo = 1 ORDER BY nombre'
      : 'SELECT id, codigo, nombre, email, rol, activo FROM usuarios WHERE rol = ? ORDER BY nombre';
    return this.db.prepare(sql).all(rol);
  }

  porId(id) {
    return this.db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) || null;
  }

  porEmail(email) {
    return this.db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email) || null;
  }

  crear({ codigo, nombre, email, passwordHash, rol, activo = 1 }) {
    const resultado = this.db
      .prepare(
        'INSERT INTO usuarios (codigo, nombre, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(codigo, nombre, email, passwordHash, rol, activo);
    return this.porId(Number(resultado.lastInsertRowid));
  }

  actualizar(id, { nombre, email, rol, activo, passwordHash }) {
    const existente = this.porId(id);
    if (!existente) return null;
    this.db
      .prepare(
        `UPDATE usuarios
            SET nombre = ?, email = ?, rol = ?, activo = ?, password_hash = ?,
                actualizado_en = datetime('now','localtime')
          WHERE id = ?`
      )
      .run(
        nombre ?? existente.nombre,
        email ?? existente.email,
        rol ?? existente.rol,
        activo !== undefined ? (activo ? 1 : 0) : existente.activo,
        passwordHash ?? existente.password_hash,
        id
      );
    return this.porId(id);
  }

  contar() {
    return this.db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
  }

  contarPorRol() {
    return this.db.prepare('SELECT rol, COUNT(*) AS total FROM usuarios GROUP BY rol').all();
  }
}

module.exports = { UsuarioRepository };
