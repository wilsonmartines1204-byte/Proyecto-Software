const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ESTADOS,
  ESTADOS_ETIQUETAS,
  PRIORIDADES,
  TRANSICIONES,
  ErrorTransicion,
  esEstadoValido,
  buscarTransicion,
  puedeEjecutar,
  transicionesPermitidas,
  validarTransicion,
} = require('../../src/domain/estados');

const estudiante = { id: 2, rol: 'estudiante' };
const funcionario = { id: 3, rol: 'funcionario' };
const admin = { id: 1, rol: 'administrador' };
const supervisor = { id: 4, rol: 'supervisor' };

test('define los 7 estados del ciclo de vida con etiquetas', () => {
  assert.equal(Object.keys(ESTADOS).length, 7);
  for (const estado of Object.values(ESTADOS)) {
    assert.ok(ESTADOS_ETIQUETAS[estado], `falta etiqueta para ${estado}`);
    assert.ok(esEstadoValido(estado));
  }
  assert.ok(!esEstadoValido('PENDIENTE'));
});

test('define las 4 prioridades admitidas', () => {
  assert.deepEqual(PRIORIDADES, ['baja', 'media', 'alta', 'critica']);
});

test('la ruta principal completa esta soportada: REGISTRADA -> ASIGNADA -> EN_PROCESO -> RESUELTA -> CERRADA', () => {
  assert.ok(buscarTransicion('REGISTRADA', 'ASIGNADA'));
  assert.ok(buscarTransicion('ASIGNADA', 'EN_PROCESO'));
  assert.ok(buscarTransicion('EN_PROCESO', 'RESUELTA'));
  assert.ok(buscarTransicion('RESUELTA', 'CERRADA'));
});

test('existen transiciones para RECHAZADA y REABIERTA con sus condiciones', () => {
  assert.ok(buscarTransicion('REGISTRADA', 'RECHAZADA'));
  assert.ok(buscarTransicion('EN_PROCESO', 'RECHAZADA'));
  const rechazar = buscarTransicion('EN_PROCESO', 'RECHAZADA');
  assert.ok(rechazar.requiere.includes('motivo'));
  const reabrir = buscarTransicion('RECHAZADA', 'REABIERTA');
  assert.ok(reabrir.requiere.includes('motivo'));
});

test('no existen transiciones saltando etapas ni bucles invalidos', () => {
  assert.equal(buscarTransicion('REGISTRADA', 'RESUELTA'), null);
  assert.equal(buscarTransicion('REGISTRADA', 'CERRADA'), null);
  assert.equal(buscarTransicion('RESUELTA', 'EN_PROCESO'), null);
  assert.equal(buscarTransicion('CERRADA', 'EN_PROCESO'), null);
  assert.equal(buscarTransicion('CERRADA', 'CERRADA'), null);
});

test('validarTransicion exige motivo para RECHAZADA', () => {
  assert.throws(
    () => validarTransicion({
      estadoActual: 'EN_PROCESO',
      nuevoEstado: 'RECHAZADA',
      usuario: funcionario,
      solicitud: { id: 1, estado: 'EN_PROCESO', responsable_id: 3, solicitante_id: 2 },
    }),
    (e) => e instanceof ErrorTransicion && /motivo/i.test(e.message)
  );
});

test('validarTransicion exige solucion final para RESUELTA (regla de negocio)', () => {
  assert.throws(
    () => validarTransicion({
      estadoActual: 'EN_PROCESO',
      nuevoEstado: 'RESUELTA',
      usuario: funcionario,
      solicitud: { id: 1, estado: 'EN_PROCESO', responsable_id: 3, solicitante_id: 2 },
    }),
    (e) => e instanceof ErrorTransicion && /solucion/i.test(e.message)
  );
  const ok = validarTransicion({
    estadoActual: 'EN_PROCESO',
    nuevoEstado: 'RESUELTA',
    usuario: funcionario,
    solicitud: { id: 1, estado: 'EN_PROCESO', responsable_id: 3, solicitante_id: 2 },
    solucion: 'Se aplico la correccion.',
  });
  assert.equal(ok.a, 'RESUELTA');
});

test('validarTransicion exige responsable para asignar', () => {
  assert.throws(
    () => validarTransicion({
      estadoActual: 'REGISTRADA',
      nuevoEstado: 'ASIGNADA',
      usuario: admin,
      solicitud: { id: 1, estado: 'REGISTRADA', solicitante_id: 2 },
    }),
    (e) => e instanceof ErrorTransicion && /responsable/i.test(e.message)
  );
});

test('validarTransicion rechaza estados destino desconocidos y rutas inexistentes', () => {
  assert.throws(
    () => validarTransicion({ estadoActual: 'REGISTRADA', nuevoEstado: 'INVENTADO', usuario: admin, solicitud: { estado: 'REGISTRADA' } }),
    /Estado destino desconocido/
  );
  assert.throws(
    () => validarTransicion({ estadoActual: 'CERRADA', nuevoEstado: 'EN_PROCESO', usuario: admin, solicitud: { estado: 'CERRADA' } }),
    /Transicion no permitida/
  );
});

test('solo administrador o supervisor pueden reabrir una solicitud CERRADA (reapertura autorizada)', () => {
  const cerrada = { id: 1, estado: 'CERRADA', solicitante_id: 2, responsable_id: 3 };
  const base = { estadoActual: 'CERRADA', nuevoEstado: 'REABIERTA', motivo: 'Persiste el problema.' };

  assert.throws(
    () => validarTransicion({ ...base, usuario: estudiante, solicitud: cerrada }),
    (e) => e instanceof ErrorTransicion && /estudiante/.test(e.message)
  );
  assert.throws(
    () => validarTransicion({ ...base, usuario: funcionario, solicitud: cerrada }),
    ErrorTransicion
  );
  validarTransicion({ ...base, usuario: admin, solicitud: cerrada });
  validarTransicion({ ...base, usuario: supervisor, solicitud: cerrada });
});

test('el estudiante solo puede cerrar o reabrir sus propias solicitudes', () => {
  const propia = { id: 1, estado: 'RESUELTA', solicitante_id: 2 };
  const ajena = { id: 2, estado: 'RESUELTA', solicitante_id: 5 };

  validarTransicion({ estadoActual: 'RESUELTA', nuevoEstado: 'CERRADA', usuario: estudiante, solicitud: propia });
  assert.throws(
    () => validarTransicion({ estadoActual: 'RESUELTA', nuevoEstado: 'CERRADA', usuario: estudiante, solicitud: ajena }),
    (e) => e instanceof ErrorTransicion && /autorizado/.test(e.message)
  );
});

test('solo el funcionario responsable puede iniciar y finalizar la atencion', () => {
  const asignadaOtra = { id: 1, estado: 'ASIGNADA', responsable_id: 6, solicitante_id: 2 };
  assert.throws(
    () => validarTransicion({ estadoActual: 'ASIGNADA', nuevoEstado: 'EN_PROCESO', usuario: funcionario, solicitud: asignadaOtra }),
    ErrorTransicion
  );
  const asignadaPropia = { id: 1, estado: 'ASIGNADA', responsable_id: 3, solicitante_id: 2 };
  validarTransicion({ estadoActual: 'ASIGNADA', nuevoEstado: 'EN_PROCESO', usuario: funcionario, solicitud: asignadaPropia });
});

test('un rol no autorizado no puede ejecutar una transicion valida', () => {
  assert.throws(
    () => validarTransicion({
      estadoActual: 'REGISTRADA',
      nuevoEstado: 'ASIGNADA',
      usuario: estudiante,
      solicitud: { estado: 'REGISTRADA', solicitante_id: 2 },
      responsableId: 3,
    }),
    (e) => e instanceof ErrorTransicion && /estudiante/.test(e.message)
  );
});

test('transicionesPermitidas devuelve solo las acciones disponibles para cada rol', () => {
  const registrada = { id: 1, estado: 'REGISTRADA', solicitante_id: 2, responsable_id: null };
  const paraAdmin = transicionesPermitidas(admin, registrada).map((t) => t.a).sort();
  assert.deepEqual(paraAdmin, ['ASIGNADA', 'RECHAZADA']);
  assert.deepEqual(transicionesPermitidas(estudiante, registrada), []);
  assert.deepEqual(transicionesPermitidas(funcionario, registrada), []);

  const enProceso = { id: 2, estado: 'EN_PROCESO', solicitante_id: 2, responsable_id: 3 };
  const paraFuncionario = transicionesPermitidas(funcionario, enProceso).map((t) => t.a).sort();
  assert.deepEqual(paraFuncionario, ['RECHAZADA', 'RESUELTA'], 'el funcionario no reasigna (solo admin/supervisor)');
  const paraAdminEnProceso = transicionesPermitidas(admin, enProceso).map((t) => t.a).sort();
  assert.deepEqual(paraAdminEnProceso, ['ASIGNADA', 'RECHAZADA', 'RESUELTA']);

  const cerrada = { id: 3, estado: 'CERRADA', solicitante_id: 2, responsable_id: 3 };
  assert.deepEqual(transicionesPermitidas(estudiante, cerrada), []);
  assert.deepEqual(transicionesPermitidas(admin, cerrada).map((t) => t.a), ['REABIERTA']);
});

test('puedeEjecutar respeta la lista de roles de cada transicion', () => {
  const transicion = buscarTransicion('RESUELTA', 'CERRADA');
  assert.ok(puedeEjecutar(transicion, estudiante, { solicitante_id: 2, responsable_id: null }));
  assert.equal(puedeEjecutar(transicion, funcionario, { solicitante_id: 2, responsable_id: 3 }), false);
});

test('toda transicion declarada apunta a un estado valido y parte de uno valido', () => {
  assert.ok(TRANSICIONES.length >= 13);
  for (const t of TRANSICIONES) {
    assert.ok(esEstadoValido(t.de), `origen invalido: ${t.de}`);
    assert.ok(esEstadoValido(t.a), `destino invalido: ${t.a}`);
    assert.ok(Array.isArray(t.roles) && t.roles.length > 0, `transicion ${t.de}->${t.a} sin roles`);
    assert.ok(typeof t.descripcion === 'string' && t.descripcion.length > 0);
  }
});
