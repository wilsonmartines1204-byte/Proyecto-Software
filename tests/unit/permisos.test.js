const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ROLES,
  CAPACIDADES,
  tieneCapacidad,
  puedeVerSolicitud,
  filtroVisibilidad,
  esRolValido,
} = require('../../src/domain/permisos');

const admin = { id: 1, rol: 'administrador' };
const estudiante = { id: 2, rol: 'estudiante' };
const funcionario = { id: 3, rol: 'funcionario' };
const supervisor = { id: 4, rol: 'supervisor' };

test('define exactamente los 4 roles requeridos por el proyecto', () => {
  assert.deepEqual([...ROLES].sort(), ['administrador', 'estudiante', 'funcionario', 'supervisor']);
  assert.ok(esRolValido('supervisor'));
  assert.ok(!esRolValido('cliente'));
  assert.ok(!esRolValido(null));
});

test('el administrador tiene acceso total (*)', () => {
  assert.ok(tieneCapacidad(admin, 'reportes.ver'));
  assert.ok(tieneCapacidad(admin, 'usuarios.gestionar'));
  assert.ok(tieneCapacidad(admin, 'solicitudes.gestionar'));
});

test('cada rol recibe solo sus capacidades (RF01 control de acceso)', () => {
  assert.ok(tieneCapacidad(supervisor, 'reportes.ver'));
  assert.ok(tieneCapacidad(supervisor, 'solicitudes.asignar'));
  assert.ok(!tieneCapacidad(supervisor, 'usuarios.gestionar'));

  assert.ok(tieneCapacidad(funcionario, 'solicitudes.atender'));
  assert.ok(!tieneCapacidad(funcionario, 'reportes.ver'));
  assert.ok(!tieneCapacidad(funcionario, 'solicitudes.asignar'));

  assert.ok(tieneCapacidad(estudiante, 'solicitudes.crear'));
  assert.ok(tieneCapacidad(estudiante, 'solicitudes.verPropias'));
  assert.ok(!tieneCapacidad(estudiante, 'solicitudes.atender'));
  assert.ok(!tieneCapacidad(estudiante, 'reportes.ver'));
});

test('sin usuario no hay capacidades', () => {
  assert.equal(tieneCapacidad(null, 'solicitudes.crear'), false);
  assert.equal(tieneCapacidad(undefined, 'solicitudes.crear'), false);
});

test('puedeVerSolicitud: administrador y supervisor ven cualquier caso', () => {
  const ajena = { solicitante_id: 99, responsable_id: null };
  assert.ok(puedeVerSolicitud(admin, ajena));
  assert.ok(puedeVerSolicitud(supervisor, ajena));
});

test('puedeVerSolicitud: el estudiante solo ve las suyas (RF05)', () => {
  assert.ok(puedeVerSolicitud(estudiante, { solicitante_id: 2, responsable_id: null }));
  assert.equal(puedeVerSolicitud(estudiante, { solicitante_id: 5, responsable_id: 3 }), false);
});

test('puedeVerSolicitud: el funcionario solo ve las asignadas (RF06)', () => {
  assert.ok(puedeVerSolicitud(funcionario, { solicitante_id: 2, responsable_id: 3 }));
  assert.equal(puedeVerSolicitud(funcionario, { solicitante_id: 2, responsable_id: 6 }), false);
  assert.equal(puedeVerSolicitud(funcionario, { solicitante_id: 2, responsable_id: null }), false);
});

test('filtroVisibilidad limita las consultas por rol', () => {
  assert.deepEqual(filtroVisibilidad(estudiante), { columna: 'solicitante_id', valor: 2 });
  assert.deepEqual(filtroVisibilidad(funcionario), { columna: 'responsable_id', valor: 3 });
  assert.equal(filtroVisibilidad(admin), null);
  assert.equal(filtroVisibilidad(supervisor), null);
});

test('la matriz de capacidades cubre a los 4 roles', () => {
  for (const rol of ROLES) {
    assert.ok(Array.isArray(CAPACIDADES[rol]), `falta la matriz del rol ${rol}`);
    assert.ok(CAPACIDADES[rol].length > 0, `el rol ${rol} no tiene capacidades`);
  }
});
