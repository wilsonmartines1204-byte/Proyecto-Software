const { ESTADOS } = require('../domain/estados');

class ReporteService {
  constructor({ solicitudes, db }) {
    this.solicitudes = solicitudes;
    this.db = db;
  }

  porEstado() {
    const filas = this.solicitudes.contarPorEstado();
    const total = filas.reduce((n, f) => n + f.total, 0);
    return filas.map((f) => ({ ...f, porcentaje: total ? Math.round((f.total * 100) / total) : 0 }));
  }

  porCategoria() {
    return this.db
      .prepare(
        `SELECT c.nombre AS categoria, COUNT(s.id) AS total
           FROM categorias c
           LEFT JOIN solicitudes s ON s.categoria_id = c.id
          GROUP BY c.id
          ORDER BY total DESC, c.nombre`
      )
      .all();
  }

  porPrioridad() {
    return this.db
      .prepare('SELECT prioridad, COUNT(*) AS total FROM solicitudes GROUP BY prioridad ORDER BY total DESC')
      .all();
  }

  porResponsable() {
    return this.db
      .prepare(
        `SELECT u.nombre AS responsable, COUNT(s.id) AS total,
                SUM(CASE WHEN s.estado IN ('RESUELTA','CERRADA') THEN 1 ELSE 0 END) AS resueltas
           FROM usuarios u
           LEFT JOIN solicitudes s ON s.responsable_id = u.id
          WHERE u.rol = 'funcionario'
          GROUP BY u.id
          ORDER BY total DESC`
      )
      .all();
  }

  porPeriodo(desde, hasta) {
    const params = [];
    let where = '';
    if (desde) {
      where += ' AND date(s.creado_en) >= date(?)';
      params.push(desde);
    }
    if (hasta) {
      where += ' AND date(s.creado_en) <= date(?)';
      params.push(hasta);
    }
    const total = this.db
      .prepare(`SELECT COUNT(*) AS total FROM solicitudes s WHERE 1 = 1${where}`)
      .get(...params).total;
    const porEstado = this.db
      .prepare(
        `SELECT s.estado, COUNT(*) AS total FROM solicitudes s WHERE 1 = 1${where} GROUP BY s.estado`
      )
      .all(...params);
    const resueltas = this.db
      .prepare(
        `SELECT COUNT(*) AS total FROM solicitudes s
          WHERE 1 = 1${where} AND s.estado IN ('RESUELTA','CERRADA')`
      )
      .get(...params).total;
    return {
      desde: desde || 'inicio',
      hasta: hasta || 'hoy',
      total,
      porEstado,
      resueltas,
      tasaResolucion: total ? Math.round((resueltas * 100) / total) : 0,
    };
  }

  tiempoPromedioResolucion() {
    const fila = this.db
      .prepare(
        `SELECT AVG(julianday(actualizado_en) - julianday(creado_en)) * 24 AS horas
           FROM solicitudes
          WHERE estado IN ('RESUELTA','CERRADA')`
      )
      .get();
    return fila && fila.horas != null ? Math.round(fila.horas * 10) / 10 : null;
  }

  resumenGeneral() {
    return {
      porEstado: this.porEstado(),
      porCategoria: this.porCategoria(),
      porPrioridad: this.porPrioridad(),
      porResponsable: this.porResponsable(),
      tiempoPromedioHoras: this.tiempoPromedioResolucion(),
      estados: ESTADOS,
    };
  }
}

module.exports = { ReporteService };
