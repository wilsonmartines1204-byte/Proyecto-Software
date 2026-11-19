PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo        TEXT    UNIQUE,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL CHECK (rol IN ('administrador','estudiante','funcionario','supervisor')),
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en TEXT
);

CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL UNIQUE,
  descripcion TEXT,
  activa      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo          TEXT    NOT NULL UNIQUE,
  solicitante_id  INTEGER NOT NULL REFERENCES usuarios(id),
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  titulo          TEXT    NOT NULL,
  descripcion     TEXT    NOT NULL,
  prioridad       TEXT    NOT NULL CHECK (prioridad IN ('baja','media','alta','critica')),
  estado          TEXT    NOT NULL DEFAULT 'REGISTRADA'
                    CHECK (estado IN ('REGISTRADA','ASIGNADA','EN_PROCESO','RESUELTA','CERRADA','RECHAZADA','REABIERTA')),
  responsable_id  INTEGER REFERENCES usuarios(id),
  solucion        TEXT,
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS historiales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id   INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo   TEXT    NOT NULL,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  observacion    TEXT,
  fecha          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS observaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id  INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  texto         TEXT    NOT NULL,
  es_solucion   INTEGER NOT NULL DEFAULT 0,
  fecha         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  solicitud_id  INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
  tipo          TEXT    NOT NULL,
  mensaje       TEXT    NOT NULL,
  leida         INTEGER NOT NULL DEFAULT 0,
  fecha         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado       ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante  ON solicitudes(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_responsable  ON solicitudes(responsable_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_categoria    ON solicitudes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_creado       ON solicitudes(creado_en);
CREATE INDEX IF NOT EXISTS idx_historial_solicitud      ON historiales(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario   ON notificaciones(usuario_id, leida);
