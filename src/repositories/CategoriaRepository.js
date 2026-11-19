class CategoriaRepository {
  constructor(db) {
    this.db = db;
  }

  listar({ soloActivas = false } = {}) {
    const sql = soloActivas
      ? 'SELECT * FROM categorias WHERE activa = 1 ORDER BY nombre'
      : 'SELECT * FROM categorias ORDER BY nombre';
    return this.db.prepare(sql).all();
  }

  porId(id) {
    return this.db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) || null;
  }

  porNombre(nombre) {
    return this.db.prepare('SELECT * FROM categorias WHERE nombre = ?').get(nombre) || null;
  }

  crear({ nombre, descripcion, activa = 1 }) {
    const r = this.db
      .prepare('INSERT INTO categorias (nombre, descripcion, activa) VALUES (?, ?, ?)')
      .run(nombre, descripcion || null, activa);
    return this.porId(Number(r.lastInsertRowid));
  }

  actualizar(id, { nombre, descripcion, activa }) {
    const existente = this.porId(id);
    if (!existente) return null;
    this.db
      .prepare('UPDATE categorias SET nombre = ?, descripcion = ?, activa = ? WHERE id = ?')
      .run(
        nombre ?? existente.nombre,
        descripcion !== undefined ? descripcion : existente.descripcion,
        activa !== undefined ? (activa ? 1 : 0) : existente.activa,
        id
      );
    return this.porId(id);
  }

  desactivar(id) {
    return this.actualizar(id, { activa: 0 });
  }

  contar() {
    return this.db.prepare('SELECT COUNT(*) AS total FROM categorias').get().total;
  }
}

module.exports = { CategoriaRepository };
