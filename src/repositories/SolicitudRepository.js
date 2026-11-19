class SolicitudRepository {
  constructor(db) {
    this.db = db;
  }

  _filtrosSQL(filtros = {}) {
    const where = [];
    const params = [];
    if (filtros.estado) {
      where.push('s.estado = ?');
      params.push(filtros.estado);
    }
    if (filtros.categoriaId) {
      where.push('s.categoria_id = ?');
      params.push(Number(filtros.categoriaId));
    }
    if (filtros.prioridad) {
      where.push('s.prioridad = ?');
      params.push(filtros.prioridad);
    }
    if (filtros.responsableId === 'sin_asignar') {
      where.push('s.responsable_id IS NULL');
    } else if (filtros.responsableId) {
      where.push('s.responsable_id = ?');
      params.push(Number(filtros.responsableId));
    }
    if (filtros.solicitanteId) {
      where.push('s.solicitante_id = ?');
      params.push(Number(filtros.solicitanteId));
    }
    if (filtros.desde) {
      where.push("date(s.creado_en) >= date(?)");
      params.push(filtros.desde);
    }
    if (filtros.hasta) {
      where.push("date(s.creado_en) <= date(?)");
      params.push(filtros.hasta);
    }
    if (filtros.busqueda) {
      where.push('(s.codigo LIKE ? OR s.titulo LIKE ? OR s.descripcion LIKE ?)');
      const q = `%${filtros.busqueda}%`;
      params.push(q, q, q);
    }
    return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  listar(filtros = {}) {
    const { where, params } = this._filtrosSQL(filtros);
    const sql = `
      SELECT s.*, u.nombre AS solicitante_nombre, u.rol AS solicitante_rol,
             r.nombre AS responsable_nombre, c.nombre AS categoria_nombre
        FROM solicitudes s
        JOIN usuarios u ON u.id = s.solicitante_id
        LEFT JOIN usuarios r ON r.id = s.responsable_id
        JOIN categorias c ON c.id = s.categoria_id
        ${where}
       ORDER BY datetime(s.creado_en) DESC`;
    return this.db.prepare(sql).all(...params);
  }

  porId(id) {
    return this.db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id) || null;
  }

  porCodigo(codigo) {
    const sql = `
      SELECT s.*, u.nombre AS solicitante_nombre, u.email AS solicitante_email, u.rol AS solicitante_rol,
             r.nombre AS responsable_nombre, r.email AS responsable_email, c.nombre AS categoria_nombre
        FROM solicitudes s
        JOIN usuarios u ON u.id = s.solicitante_id
        LEFT JOIN usuarios r ON r.id = s.responsable_id
        JOIN categorias c ON c.id = s.categoria_id
       WHERE s.codigo = ?`;
    return this.db.prepare(sql).get(codigo) || null;
  }

  siguienteCodigo(anio) {
    const prefijo = `SOL-${anio}-`;
    const fila = this.db
      .prepare(
        `SELECT MAX(CAST(SUBSTR(codigo, ?) AS INTEGER)) AS maximo
           FROM solicitudes WHERE codigo LIKE ?`
      )
      .get(prefijo.length + 1, `${prefijo}%`);
    const numero = String((fila.maximo || 0) + 1).padStart(4, '0');
    return `${prefijo}${numero}`;
  }

  crear({ codigo, solicitanteId, categoriaId, titulo, descripcion, prioridad, estado = 'REGISTRADA' }) {
    const r = this.db
      .prepare(
        `INSERT INTO solicitudes (codigo, solicitante_id, categoria_id, titulo, descripcion, prioridad, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(codigo, solicitanteId, categoriaId, titulo, descripcion, prioridad, estado);
    return this.porId(Number(r.lastInsertRowid));
  }

  actualizarEstado(id, { estado, responsableId, solucion }) {
    const existente = this.porId(id);
    if (!existente) return null;
    const columnas = ['estado = ?', "actualizado_en = datetime('now','localtime')"];
    const params = [estado];
    if (responsableId !== undefined) {
      columnas.push('responsable_id = ?');
      params.push(responsableId);
    }
    if (solucion !== undefined) {
      columnas.push('solucion = ?');
      params.push(solucion);
    }
    params.push(id);
    this.db
      .prepare(`UPDATE solicitudes SET ${columnas.join(', ')} WHERE id = ?`)
      .run(...params);
    return this.porId(id);
  }

  contar() {
    return this.db.prepare('SELECT COUNT(*) AS total FROM solicitudes').get().total;
  }

  contarPorEstado() {
    return this.db.prepare('SELECT estado, COUNT(*) AS total FROM solicitudes GROUP BY estado').all();
  }

  contarPorSolicitante(solicitanteId) {
    return this.db
      .prepare('SELECT COUNT(*) AS total FROM solicitudes WHERE solicitante_id = ?')
      .get(solicitanteId).total;
  }

  contarPorResponsable(responsableId) {
    return this.db
      .prepare('SELECT COUNT(*) AS total FROM solicitudes WHERE responsable_id = ?')
      .get(responsableId).total;
  }
}

module.exports = { SolicitudRepository };
