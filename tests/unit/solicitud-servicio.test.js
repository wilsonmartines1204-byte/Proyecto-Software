const test = require('node:test');
const assert = require('node:assert/strict');

const { prepararEscenario, crearSolicitudPrueba } = require('../utilidades-prueba');

function nuevaSolicitud(esc, extras) {
  return crearSolicitudPrueba(esc, extras);
}

test('Registro de solicitudes: validaciones y reglas iniciales (RF04)', async (t) => {
  const esc = prepararEscenario('crear-sol');
  t.after(() => esc.cerrar());
  const svc = esc.servicios.solicitudesService;

  await t.test('un estudiante registra y nace en estado REGISTRADA con codigo correlativo', async () => {
    const s = await nuevaSolicitud(esc);
    assert.equal(s.estado, 'REGISTRADA');
    assert.match(s.codigo, /^SOL-\d{4}-\d{4}$/);
    const hist = esc.repositorios.historiales.listarPorSolicitud(s.id);
    assert.equal(hist.length, 1);
    assert.equal(hist[0].estado_nuevo, 'REGISTRADA');
    assert.ok(hist[0].fecha);
  });

  await t.test('el alta exige titulo, descripcion, categoria y prioridad validos', async () => {
    const { estudiante } = esc.usuarios;
    await assert.rejects(() => svc.crear({ titulo: ' ', descripcion: 'x', categoriaId: 1, prioridad: 'media', solicitante: estudiante }), /titulo es obligatorio/);
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: '', categoriaId: 1, prioridad: 'media', solicitante: estudiante }), /descripcion es obligatoria/);
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 0, prioridad: 'media', solicitante: estudiante }), /Debe seleccionar una categoria/);
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 1, prioridad: 'urgente', solicitante: estudiante }), /Prioridad invalida/);
  });

  await t.test('toda solicitud queda asociada a una categoria existente y activa', async () => {
    const { estudiante } = esc.usuarios;
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 3, prioridad: 'media', solicitante: estudiante }), /inactiva/);
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 999, prioridad: 'media', solicitante: estudiante }), /inactiva/);
  });

  await t.test('solo un usuario autenticado y autorizado puede registrar (regla de negocio)', async () => {
    await assert.rejects(() => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 1, prioridad: 'media', solicitante: null }), /no permite registrar/);
    await assert.rejects(
      () => svc.crear({ titulo: 'x', descripcion: 'y', categoriaId: 1, prioridad: 'media', solicitante: esc.usuarios.funcionario }),
      /Su rol no permite/
    );
  });

  await t.test('al registrar se notifica a administrador y supervisor (RF10)', async () => {
    const creadas = esc.repositorios.notificaciones.listarPorUsuario(1, { soloNoLeidas: true });
    const deSupervisor = esc.repositorios.notificaciones.listarPorUsuario(4, { soloNoLeidas: true });
    assert.ok(creadas.length > 0, 'faltan notificaciones al administrador');
    assert.ok(deSupervisor.length > 0, 'faltan notificaciones al supervisor');
  });

  await t.test('los codigos no se duplican aunque existan huecos', async () => {
    const s1 = await nuevaSolicitud(esc, { titulo: 'Codigos 1' });
    const s3 = await nuevaSolicitud(esc, { titulo: 'Codigos 3' });
    assert.notEqual(s1.codigo, s3.codigo);
    esc.repositorios.solicitudes.db.exec(`DELETE FROM solicitudes WHERE id = ${s3.id}`);
    const s4 = await nuevaSolicitud(esc, { titulo: 'Codigos 4' });
    assert.notEqual(s1.codigo, s4.codigo);
    const todos = esc.repositorios.solicitudes.listar();
    const codigos = todos.map((x) => x.codigo);
    assert.equal(new Set(codigos).size, codigos.length, 'codigos duplicados');
  });
});

test('Asignacion y atencion: solo autorizados, responsable funcionario (RF06/RF07)', async (t) => {
  const esc = prepararEscenario('asignar');
  t.after(() => esc.cerrar());
  const svc = esc.servicios.solicitudesService;

  await t.test('el estudiante no puede asignar responsables', async () => {
    const s = await nuevaSolicitud(esc);
    assert.throws(
      () => svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.estudiante }),
      /Solo un usuario autorizado/
    );
  });

  await t.test('el responsable debe ser un funcionario activo', async () => {
    const s = await nuevaSolicitud(esc);
    assert.throws(() => svc.asignar({ codigo: s.codigo, responsableId: 2, usuario: esc.usuarios.admin }), /rol funcionario/);
    assert.throws(() => svc.asignar({ codigo: s.codigo, responsableId: 7, usuario: esc.usuarios.admin }), /inactivo/);
    assert.throws(() => svc.asignar({ codigo: s.codigo, responsableId: 999, usuario: esc.usuarios.admin }), /inactivo/);
  });

  await t.test('admin asigna: pasa a ASIGNADA, registra historial y notifica (RF09/RF10)', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin, motivo: 'Derivado a servicios generales.' });
    const actual = esc.repositorios.solicitudes.porCodigo(s.codigo);
    assert.equal(actual.estado, 'ASIGNADA');
    assert.equal(actual.responsable_id, 3);
    const hist = esc.repositorios.historiales.listarPorSolicitud(s.id);
    assert.equal(hist[0].estado_anterior, 'REGISTRADA');
    assert.equal(hist[0].estado_nuevo, 'ASIGNADA');
    assert.equal(hist[0].usuario_id, 1);
    assert.ok(hist[0].observacion);
    const alFuncionario = esc.repositorios.notificaciones.listarPorUsuario(3, { soloNoLeidas: true });
    assert.ok(alFuncionario.some((n) => n.mensaje.includes(s.codigo)));
  });

  await t.test('supervisor tambien puede asignar y reasignar', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.supervisor });
    svc.asignar({ codigo: s.codigo, responsableId: 6, usuario: esc.usuarios.supervisor, motivo: 'Reasignacion por carga.' });
    assert.equal(esc.repositorios.solicitudes.porCodigo(s.codigo).responsable_id, 6);
  });
});

test('Ciclo de vida completo y reglas de negocio (RF07/RF08)', async (t) => {
  const esc = prepararEscenario('ciclo');
  t.after(() => esc.cerrar());
  const svc = esc.servicios.solicitudesService;

  async function flujoHastaEnProceso() {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario });
    return s;
  }

  await t.test('REGISTRADA -> ASIGNADA -> EN_PROCESO -> RESUELTA -> CERRADA', async () => {
    const s = await flujoHastaEnProceso();
    svc.cambiarEstado({
      codigo: s.codigo, nuevoEstado: 'RESUELTA', usuario: esc.usuarios.funcionario,
      solucion: 'Se atendio el caso completo.',
    });
    let actual = esc.repositorios.solicitudes.porCodigo(s.codigo);
    assert.equal(actual.estado, 'RESUELTA');
    assert.equal(actual.solucion, 'Se atendio el caso completo.');

    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'CERRADA', usuario: esc.usuarios.estudiante });
    actual = esc.repositorios.solicitudes.porCodigo(s.codigo);
    assert.equal(actual.estado, 'CERRADA');
    assert.equal(actual.solucion, 'Se atendio el caso completo.', 'CERRADA conserva la solucion');

    const hist = esc.repositorios.historiales.listarPorSolicitud(s.id).reverse();
    assert.deepEqual(hist.map((h) => h.estado_nuevo), ['REGISTRADA', 'ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CERRADA']);
    assert.ok(hist.every((h) => h.fecha && h.usuario_id && h.estado_nuevo));
  });

  await t.test('una solicitud CERRADA no admite observaciones (regla de negocio)', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'RESUELTA', usuario: esc.usuarios.funcionario, solucion: 'OK' });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'CERRADA', usuario: esc.usuarios.estudiante });
    assert.throws(
      () => svc.agregarObservacion({ codigo: s.codigo, usuario: esc.usuarios.admin, texto: 'post cierre' }),
      /Cerrada no admite/
    );
  });

  await t.test('la reapertura de una CERRADA requiere autorizacion (admin/supervisor)', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'RESUELTA', usuario: esc.usuarios.funcionario, solucion: 'OK' });
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'CERRADA', usuario: esc.usuarios.estudiante });

    assert.throws(
      () => svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'REABIERTA', usuario: esc.usuarios.estudiante, motivo: 'No funciono.' }),
      /estudiante/
    );
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'REABIERTA', usuario: esc.usuarios.admin, motivo: 'Autoriza reapertura.' });
    const actual = esc.repositorios.solicitudes.porCodigo(s.codigo);
    assert.equal(actual.estado, 'REABIERTA');
    assert.equal(actual.solucion, null, 'la solucion se limpia al reabrir');
  });

  await t.test('RECHAZADA exige motivo y conserva la trazabilidad', async () => {
    const s = await nuevaSolicitud(esc);
    assert.throws(
      () => svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'RECHAZADA', usuario: esc.usuarios.admin }),
      /motivo/
    );
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'RECHAZADA', usuario: esc.usuarios.admin, motivo: 'Fuera del alcance institucional.' });
    const hist = esc.repositorios.historiales.listarPorSolicitud(s.id);
    assert.equal(hist[0].estado_nuevo, 'RECHAZADA');
    assert.equal(hist[0].observacion, 'Fuera del alcance institucional.');
  });

  await t.test('solo el funcionario responsable puede atender su caso', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 6, usuario: esc.usuarios.admin });
    assert.throws(
      () => svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario }),
      /No tiene permiso/
    );
    svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario2 });
  });

  await t.test('no se puede saltar de REGISTRADA directamente a RESUELTA', async () => {
    const s = await nuevaSolicitud(esc);
    assert.throws(
      () => svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'RESUELTA', usuario: esc.usuarios.admin, solucion: 'x' }),
      /Transicion no permitida/
    );
  });

  await t.test('el estudiante solo accede a sus propias solicitudes (RF05)', async () => {
    const s = await nuevaSolicitud(esc, { solicitante: esc.usuarios.estudiante });
    assert.throws(
      () => svc.obtener(s.codigo, esc.usuarios.estudianteAjeno),
      /No tiene permiso/
    );
    const propia = svc.obtener(s.codigo, esc.usuarios.estudiante);
    assert.equal(propia.codigo, s.codigo);
    const listado = svc.listarParaUsuario({}, esc.usuarios.estudianteAjeno);
    assert.ok(listado.every((x) => x.solicitante_id === 5));
  });

  await t.test('las observaciones quedan registradas con autor y fecha (RF08)', async () => {
    const s = await nuevaSolicitud(esc);
    svc.agregarObservacion({ codigo: s.codigo, usuario: esc.usuarios.estudiante, texto: 'Agrego datos de contacto.' });
    const obs = esc.repositorios.observaciones.listarPorSolicitud(s.id);
    assert.equal(obs.length, 1);
    assert.equal(obs[0].usuario_id, 2);
    assert.ok(obs[0].fecha);
  });
});

test('Transacciones: un fallo a mitad no deja datos inconsistentes (integridad)', async (t) => {
  const esc = prepararEscenario('transaccion');
  t.after(() => esc.cerrar());
  const svc = esc.servicios.solicitudesService;

  await t.test('si falla el historial al crear, la solicitud no queda registrada', async () => {
    const original = esc.repositorios.historiales.agregar;
    esc.repositorios.historiales.agregar = () => { throw new Error('fallo simulado de historial'); };
    const antes = esc.repositorios.solicitudes.contar();
    await assert.rejects(
      () => svc.crear({ titulo: 'Se revertira', descripcion: 'Transaccion forzada.', categoriaId: 1, prioridad: 'alta', solicitante: esc.usuarios.estudiante }),
      /fallo simulado/
    );
    assert.equal(esc.repositorios.solicitudes.contar(), antes, 'la solicitud debio revertirse');
    esc.repositorios.historiales.agregar = original;
  });

  await t.test('si falla el historial al cambiar estado, se revierte el estado', async () => {
    const s = await nuevaSolicitud(esc);
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin });
    const original = esc.repositorios.historiales.agregar;
    esc.repositorios.historiales.agregar = () => { throw new Error('fallo simulado 2'); };
    assert.throws(() => svc.cambiarEstado({ codigo: s.codigo, nuevoEstado: 'EN_PROCESO', usuario: esc.usuarios.funcionario }), /fallo simulado 2/);
    assert.equal(esc.repositorios.solicitudes.porCodigo(s.codigo).estado, 'ASIGNADA', 'el estado debio revertirse');
    esc.repositorios.historiales.agregar = original;
  });
});

test('Resumen del panel segmentado por rol (usabilidad y no fuga de datos)', async (t) => {
  const esc = prepararEscenario('resumen');
  t.after(() => esc.cerrar());
  const svc = esc.servicios.solicitudesService;

  await t.test('el estudiante ve contadores solo de sus solicitudes', async () => {
    const propia = await nuevaSolicitud(esc, { solicitante: esc.usuarios.estudiante });
    await nuevaSolicitud(esc, { solicitante: esc.usuarios.estudianteAjeno, titulo: 'Ajena 1' });
    await nuevaSolicitud(esc, { solicitante: esc.usuarios.estudianteAjeno, titulo: 'Ajena 2' });

    const resumen = svc.resumenParaUsuario(esc.usuarios.estudiante);
    assert.equal(resumen.total, 1);
    assert.equal(resumen.porEstado.REGISTRADA, 1);
    assert.equal(resumen.porEstado.ASIGNADA, undefined);
    assert.equal(resumen.abiertas, 1);
    assert.ok(resumen.propias.every((s) => s.solicitante_id === propia.solicitante_id || s.id === propia.id));
  });

  await t.test('el funcionario ve contadores solo de las asignadas', async () => {
    const s = await nuevaSolicitud(esc, { titulo: 'Para funcionario' });
    svc.asignar({ codigo: s.codigo, responsableId: 3, usuario: esc.usuarios.admin });
    const resumen = svc.resumenParaUsuario(esc.usuarios.funcionario);
    assert.equal(resumen.total, resumen.asignadas.length);
    assert.ok(resumen.asignadas.every((x) => x.responsable_id === 3));
    assert.equal(resumen.porEstado.ASIGNADA, resumen.asignadas.length);
  });

  await t.test('administrador y supervisor ven los indicadores globales', () => {
    const resumen = svc.resumenParaUsuario(esc.usuarios.admin);
    assert.equal(resumen.total, esc.repositorios.solicitudes.contar());
    assert.ok(resumen.pendientesAsignar >= 0);
    const resumenSup = svc.resumenParaUsuario(esc.usuarios.supervisor);
    assert.equal(resumenSup.total, resumen.total);
  });
});
