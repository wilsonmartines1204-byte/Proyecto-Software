const test = require('node:test');
const assert = require('node:assert/strict');

const { prepararEscenario } = require('../utilidades-prueba');

test('SolicitudRepository: codigos correlativos robustos y consultas con filtros', async (t) => {
  const esc = prepararEscenario('repo-sol');
  t.after(() => esc.cerrar());
  const repo = esc.repositorios.solicitudes;

  await t.test('siguienteCodigo arranca en 0001 y avanza con MAX (no COUNT)', () => {
    assert.equal(repo.siguienteCodigo(2026), 'SOL-2026-0001');
    repo.crear({ codigo: 'SOL-2026-0001', solicitanteId: 2, categoriaId: 1, titulo: 'A', descripcion: 'x', prioridad: 'baja' });
    repo.crear({ codigo: 'SOL-2026-0002', solicitanteId: 2, categoriaId: 1, titulo: 'B', descripcion: 'x', prioridad: 'baja' });
    assert.equal(repo.siguienteCodigo(2026), 'SOL-2026-0003');
    repo.crear({ codigo: 'SOL-2026-0007', solicitanteId: 5, categoriaId: 1, titulo: 'Hueco', descripcion: 'x', prioridad: 'baja' });
    assert.equal(repo.siguienteCodigo(2026), 'SOL-2026-0008', 'debe usar MAX y no llenar huecos');
    assert.equal(repo.siguienteCodigo(2027), 'SOL-2027-0001', 'el correlativo es por anio');
  });

  await t.test('listar filtra por estado, prioridad, solicitante y busqueda de texto', () => {
    const porEstado = repo.listar({ estado: 'REGISTRADA' });
    assert.ok(porEstado.length > 0 && porEstado.every((s) => s.estado === 'REGISTRADA'));

    const porPrioridad = repo.listar({ prioridad: 'baja' });
    assert.ok(porPrioridad.every((s) => s.prioridad === 'baja'));

    const porSolicitante = repo.listar({ solicitanteId: 5 });
    assert.ok(porSolicitante.every((s) => s.solicitante_id === 5));

    const porTexto = repo.listar({ busqueda: 'Hueco' });
    assert.equal(porTexto.length, 1);
    assert.equal(porTexto[0].codigo, 'SOL-2026-0007');

    const sinAsignar = repo.listar({ responsableId: 'sin_asignar' });
    assert.ok(sinAsignar.every((s) => s.responsable_id === null));
  });

  await t.test('listar trae los nombres de solicitante, responsable y categoria', () => {
    const una = repo.listar({})[0];
    assert.ok(una.solicitante_nombre);
    assert.ok(una.categoria_nombre);
    assert.ok('responsable_nombre' in una);
  });

  await t.test('actualizarEstado escribe solo lo pedido y limpia la solucion al salir de RESUELTA', () => {
    const s = repo.listar({})[0];
    repo.actualizarEstado(s.id, { estado: 'EN_PROCESO', solucion: 'Solucion previa.' });
    let guardada = repo.porId(s.id);
    assert.equal(guardada.estado, 'EN_PROCESO');
    assert.equal(guardada.solucion, 'Solucion previa.');

    repo.actualizarEstado(s.id, { estado: 'EN_PROCESO' });
    guardada = repo.porId(s.id);
    assert.equal(guardada.solucion, 'Solucion previa.', 'sin tocar solucion se conserva');

    repo.actualizarEstado(s.id, { estado: 'REABIERTA', solucion: null });
    guardada = repo.porId(s.id);
    assert.equal(guardada.solucion, null, 'null explicito debe limpiar la solucion');
    assert.equal(guardada.estado, 'REABIERTA');
  });

  await t.test('contadores globales y por estado', () => {
    assert.equal(repo.contar(), repo.listar({}).length);
    const porEstado = repo.contarPorEstado();
    const suma = porEstado.reduce((n, e) => n + e.total, 0);
    assert.equal(suma, repo.contar());
    assert.ok(repo.contarPorSolicitante(2) >= 0);
    assert.ok(repo.contarPorResponsable(3) >= 0);
  });
});

test('UsuarioRepository: CRUD, listados por rol y estados', async (t) => {
  const esc = prepararEscenario('repo-usuarios');
  t.after(() => esc.cerrar());
  const repo = esc.repositorios.usuarios;

  await t.test('listar con y sin inactivos', () => {
    const todos = repo.listar();
    assert.equal(todos.length, 7);
    const activos = repo.listar({ incluirInactivos: false });
    assert.equal(activos.length, 6);
    assert.ok(activos.every((u) => u.activo === 1));
    assert.ok(!todos.some((u) => u.password_hash), 'el listado nunca expone el hash');
  });

  await t.test('listarPorRol devuelve solo activos por defecto', () => {
    const estudiantes = repo.listarPorRol('estudiante');
    assert.ok(estudiantes.every((u) => u.rol === 'estudiante' && u.activo === 1));
    assert.ok(!estudiantes.some((u) => u.id === 7));
    const todosEstudiantes = repo.listarPorRol('estudiante', { activos: false });
    assert.ok(todosEstudiantes.some((u) => u.id === 7));
  });

  await t.test('buscar por id y correo', () => {
    assert.equal(repo.porId(1).email, 'admin@uni.edu');
    assert.equal(repo.porId(999), null);
    assert.equal(repo.porEmail('ana@uni.edu').id, 2);
    assert.equal(repo.porEmail('otro@uni.edu'), null);
  });

  await t.test('actualizar campos seleccionados y desactivar', () => {
    repo.actualizar(5, { activo: false });
    assert.equal(repo.porId(5).activo, 0);
    repo.actualizar(5, { activo: true, nombre: 'Pedro Editado' });
    const u = repo.porId(5);
    assert.equal(u.activo, 1);
    assert.equal(u.nombre, 'Pedro Editado');
    assert.ok(u.actualizado_en, 'debe registrar la fecha de actualizacion');
  });

  await t.test('contadores por rol', () => {
    const porRol = repo.contarPorRol();
    const total = porRol.reduce((n, r) => n + r.total, 0);
    assert.equal(total, repo.contar());
  });
});

test('CategoriaRepository: alta, edicion y filtro de activas', async (t) => {
  const esc = prepararEscenario('repo-categorias');
  t.after(() => esc.cerrar());
  const repo = esc.repositorios.categorias;

  await t.test('crear, consultar por id y por nombre', () => {
    const creada = repo.crear({ nombre: 'Laboratorios', descripcion: 'Reserva de laboratorios.' });
    assert.equal(repo.porId(creada.id).nombre, 'Laboratorios');
    assert.equal(repo.porNombre('Laboratorios').id, creada.id);
    assert.equal(repo.porNombre('NoExiste'), null);
  });

  await t.test('actualizar conserva valores no enviados y desactiva', () => {
    const id = repo.porNombre('Laboratorios').id;
    repo.actualizar(id, { activa: false });
    assert.equal(repo.porId(id).activa, 0);
    repo.actualizar(id, { descripcion: 'Nueva descripcion.' });
    const c = repo.porId(id);
    assert.equal(c.descripcion, 'Nueva descripcion.');
    assert.equal(c.activa, 0, 'descripcion no debe reactivar');
    assert.equal(repo.porId(999), null);
  });

  await t.test('listar solo activas excluye las deshabilitadas', () => {
    const activas = repo.listar({ soloActivas: true });
    assert.ok(activas.every((c) => c.activa === 1));
    assert.ok(!activas.some((c) => c.nombre === 'Inactiva Demo'));
    const todas = repo.listar();
    assert.ok(todas.some((c) => c.nombre === 'Inactiva Demo'));
  });

  await t.test('contar y desactivar', () => {
    assert.equal(repo.contar(), repo.listar().length);
    const id = repo.porNombre('Becas').id;
    repo.desactivar(id);
    assert.equal(repo.porId(id).activa, 0);
  });
});

test('Repositorios de historial, observaciones y notificaciones (RF09/RF10)', async (t) => {
  const esc = prepararEscenario('repo-historial');
  t.after(() => esc.cerrar());

  await t.test('historial guarda estado, usuario, observacion y fecha', () => {
    esc.repositorios.solicitudes.crear({
      codigo: 'SOL-2026-0001', solicitanteId: 2, categoriaId: 1, titulo: 'Base', descripcion: 'Fila base.', prioridad: 'media',
    });
    const creado = esc.repositorios.historiales.agregar({
      solicitudId: 1, estadoAnterior: null, estadoNuevo: 'REGISTRADA', usuarioId: 2, observacion: 'Alta inicial.',
    });
    assert.ok(creado.id && creado.fecha);
    const listado = esc.repositorios.historiales.listarPorSolicitud(1);
    assert.equal(listado[0].usuario_nombre, 'Ana Estudiante');
    assert.equal(listado[0].usuario_rol, 'estudiante');
  });

  await t.test('notificaciones: crear, contar no leidas y marcar', () => {
    const notif = esc.repositorios.notificaciones;
    notif.crear({ usuarioId: 3, solicitudId: null, tipo: 'USUARIO', mensaje: 'Prueba 1' });
    notif.crear({ usuarioId: 3, solicitudId: null, tipo: 'USUARIO', mensaje: 'Prueba 2' });
    assert.equal(notif.contarNoLeidas(3), 2);

    const primera = notif.listarPorUsuario(3, { soloNoLeidas: true })[0];
    notif.marcarLeida(primera.id, 3);
    assert.equal(notif.contarNoLeidas(3), 1);

    notif.marcarTodasLeidas(3);
    assert.equal(notif.contarNoLeidas(3), 0);
    assert.equal(notif.listarPorUsuario(3).length, 2);
  });

  await t.test('marcarLeida de otro usuario no afecta las mias', () => {
    const notif = esc.repositorios.notificaciones;
    const ajena = notif.crear({ usuarioId: 4, solicitudId: null, tipo: 'USUARIO', mensaje: 'Supervisor' });
    notif.marcarLeida(ajena.id, 3);
    assert.equal(notif.contarNoLeidas(4), 1, 'la notificacion del supervisor sigue sin leer');
  });

  await t.test('observaciones registran si son solucion final', () => {
    const creada = esc.repositorios.observaciones.agregar({
      solicitudId: 1, usuarioId: 3, texto: 'Se aplico la solucion.', esSolucion: true,
    });
    assert.equal(creada.es_solucion, 1);
    const listado = esc.repositorios.observaciones.listarPorSolicitud(1);
    assert.equal(listado[0].es_solucion, 1);
    assert.equal(listado[0].usuario_nombre, 'Luis Funcionario');
  });
});
