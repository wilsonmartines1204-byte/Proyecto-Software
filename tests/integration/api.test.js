const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('node:events');

const { crearApp } = require('../../src/app');

let app;
let db;
let server;
let base;
let dbRuta;

function parseCookies(respuesta) {
  const crudas = respuesta.headers.getSetCookie ? respuesta.headers.getSetCookie() : [];
  return crudas.map((c) => c.split(';')[0]).join('; ');
}

async function sesionNueva() {
  const s = { cookie: '' };
  const login = async (email, password) => {
    const r = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: s.cookie },
      body: new URLSearchParams({ email, password }),
      redirect: 'manual',
    });
    const nuevas = parseCookies(r);
    if (nuevas) s.cookie = nuevas;
    return r;
  };
  s.login = login;
  s.get = (ruta) => fetch(`${base}${ruta}`, { headers: { Cookie: s.cookie }, redirect: 'manual' });
  s.post = (ruta, cuerpo = {}) => fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: s.cookie },
    body: new URLSearchParams(cuerpo),
    redirect: 'manual',
  });
  return s;
}

const CUENTAS = {
  admin: ['admin@universidad.edu', 'Admin123!'],
  estudiante: ['ana@universidad.edu', 'Estu123!'],
  funcionario: ['luis@universidad.edu', 'Func123!'],
  supervisor: ['maria@universidad.edu', 'Super123!'],
  funcionario2: ['sofia@universidad.edu', 'Func123!'],
  estudianteAjeno: ['pedro@universidad.edu', 'Estu123!'],
};

async function entrar(rol) {
  const s = await sesionNueva();
  const r = await s.login(...CUENTAS[rol]);
  assert.equal(r.status, 302, `login de ${rol} debia ser 302`);
  return s;
}

before(async () => {
  dbRuta = path.join(os.tmpdir(), `sgsu-integracion-${process.pid}-${Date.now()}.db`);
  fs.rmSync(dbRuta, { force: true });
  ({ app, db } = crearApp({ dbPath: dbRuta, sembrar: true }));
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  try {
    db.close();
  } catch (error) {
    /* ya cerrada */
  }
  fs.rmSync(dbRuta, { force: true });
});

test('RF01: inicio de sesion y control de acceso segun rol', async (t) => {
  await t.test('la pagina de login responde y ya redirige si hay sesion', async () => {
    const s = await sesionNueva();
    const r = await s.get('/login');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /iniciar sesion|Iniciar sesion/i);
  });

  await t.test('credenciales invalidas -> 401 con mensaje', async () => {
    const s = await sesionNueva();
    const r = await s.login('ana@universidad.edu', 'incorrecta');
    assert.equal(r.status, 401);
    assert.match(await r.text(), /Credenciales invalidas/);
  });

  await t.test('sin sesion, las rutas protegidas redirigen a /login', async () => {
    const s = await sesionNueva();
    const r = await s.get('/');
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get('location'), base).pathname, '/login');
  });

  await t.test('el acceso por rol produce 403 fuera del perfil (4 roles)', async () => {
    const estudiante = await entrar('estudiante');
    for (const ruta of ['/usuarios', '/categorias', '/reportes']) {
      const r = await estudiante.get(ruta);
      assert.equal(r.status, 403, `${ruta} debia denegarse al estudiante`);
    }
    const funcionario = await entrar('funcionario');
    assert.equal((await funcionario.get('/reportes')).status, 403);
    assert.equal((await funcionario.get('/solicitudes/nueva')).status, 403);
    const supervisor = await entrar('supervisor');
    assert.equal((await supervisor.get('/usuarios')).status, 403);
    assert.equal((await supervisor.get('/reportes')).status, 200);
  });

  await t.test('cierre de sesion invalida el acceso posterior', async () => {
    const s = await entrar('admin');
    assert.equal((await s.get('/usuarios')).status, 200);
    await s.get('/logout');
    const r = await s.get('/usuarios');
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get('location'), base).pathname, '/login');
  });

  await t.test('el panel principal carga para los 4 roles', async () => {
    for (const rol of ['admin', 'estudiante', 'funcionario', 'supervisor']) {
      const s = await entrar(rol);
      const r = await s.get('/');
      assert.equal(r.status, 200, `panel de ${rol} debia cargar`);
      assert.match(await r.text(), /Panel principal/);
    }
  });
});

test('RF02: el administrador gestiona usuarios y roles', async (t) => {
  let admin;

  await t.test('prepara sesion de administrador y lista usuarios', async () => {
    admin = await entrar('admin');
    const r = await admin.get('/usuarios');
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Gestion de usuarios/);
    assert.match(html, /Carla Mendez/);
  });

  await t.test('crea un usuario con rol y contrasena encriptada', async () => {
    const r = await admin.post('/usuarios', {
      codigo: 'U-0099', nombre: 'Rocio Prueba', email: 'rocio@universidad.edu',
      password: 'Clave123', rol: 'supervisor',
    });
    assert.equal(r.status, 302);
    const creado = db.prepare("SELECT * FROM usuarios WHERE email = 'rocio@universidad.edu'").get();
    assert.ok(creado, 'el usuario debia crearse');
    assert.equal(creado.rol, 'supervisor');
    assert.ok(creado.password_hash.startsWith('$'), 'la contrasena debe guardarse encriptada');
  });

  await t.test('rechaza correo duplicado y contrasena corta', async () => {
    const corta = await admin.post('/usuarios', {
      nombre: 'X', email: 'x@universidad.edu', password: '12', rol: 'estudiante',
    });
    assert.match(decodeURIComponent(corta.headers.get('location')), /6 caracteres/);
    const dup = await admin.post('/usuarios', {
      nombre: 'X', email: 'ana@universidad.edu', password: '123456', rol: 'estudiante',
    });
    assert.match(decodeURIComponent(dup.headers.get('location')), /Ya existe/);
  });

  await t.test('edita un usuario existente (nombre y rol) usando el id de la ruta', async () => {
    const id = db.prepare("SELECT id FROM usuarios WHERE email = 'rocio@universidad.edu'").get().id;
    const r = await admin.post(`/usuarios/${id}`, {
      nombre: 'Rocio Actualizada', email: 'rocio@universidad.edu', rol: 'funcionario',
    });
    assert.equal(r.status, 302);
    const guardado = db.prepare('SELECT nombre, rol FROM usuarios WHERE id = ?').get(id);
    assert.equal(guardado.nombre, 'Rocio Actualizada');
    assert.equal(guardado.rol, 'funcionario');
  });

  await t.test('desactiva y reactiva una cuenta desde la interfaz', async () => {
    const id = db.prepare("SELECT id FROM usuarios WHERE email = 'rocio@universidad.edu'").get().id;
    await admin.post(`/usuarios/${id}`, {
      nombre: 'Rocio Actualizada', email: 'rocio@universidad.edu', rol: 'funcionario', activoEstado: '1',
    });
    assert.equal(db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(id).activo, 0);

    await admin.post(`/usuarios/${id}`, {
      nombre: 'Rocio Actualizada', email: 'rocio@universidad.edu', rol: 'funcionario',
      activoEstado: '1', activo: 'on',
    });
    assert.equal(db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(id).activo, 1);
  });

  await t.test('la cuenta desactivada no puede iniciar sesion', async () => {
    const id = db.prepare("SELECT id FROM usuarios WHERE email = 'rocio@universidad.edu'").get().id;
    await admin.post(`/usuarios/${id}`, {
      nombre: 'Rocio Actualizada', email: 'rocio@universidad.edu', rol: 'funcionario', activoEstado: '1',
    });
    const s = await sesionNueva();
    const r = await s.login('rocio@universidad.edu', 'Clave123');
    assert.equal(r.status, 401);
    assert.match(await r.text(), /desactivada/);
    await admin.post(`/usuarios/${id}`, {
      nombre: 'Rocio Actualizada', email: 'rocio@universidad.edu', rol: 'funcionario',
      activoEstado: '1', activo: 'on',
    });
  });
});

test('RF03: gestion de categorias de solicitudes', async (t) => {
  const admin = await entrar('admin');

  await t.test('lista, crea y edita categorias', async () => {
    const lista = await admin.get('/categorias');
    assert.equal(lista.status, 200);
    assert.match(await lista.text(), /Gestion de categorias/);

    await admin.post('/categorias', { nombre: 'Laboratorios', descripcion: 'Reserva de lab.' });
    const creada = db.prepare("SELECT * FROM categorias WHERE nombre = 'Laboratorios'").get();
    assert.ok(creada);

    const r = await admin.post(`/categorias/${creada.id}`, { nombre: 'Laboratorios', descripcion: 'Descripcion v2.' });
    assert.equal(r.status, 302);
    assert.equal(db.prepare('SELECT descripcion FROM categorias WHERE id = ?').get(creada.id).descripcion, 'Descripcion v2.');
  });

  await t.test('desactiva y reactiva una categoria', async () => {
    const id = db.prepare("SELECT id FROM categorias WHERE nombre = 'Laboratorios'").get().id;
    await admin.post(`/categorias/${id}`, { nombre: 'Laboratorios', descripcion: 'Descripcion v2.', activaEstado: '1' });
    assert.equal(db.prepare('SELECT activa FROM categorias WHERE id = ?').get(id).activa, 0);
    await admin.post(`/categorias/${id}`, {
      nombre: 'Laboratorios', descripcion: 'Descripcion v2.', activaEstado: '1', activa: 'on',
    });
    assert.equal(db.prepare('SELECT activa FROM categorias WHERE id = ?').get(id).activa, 1);
  });

  await t.test('una categoria inactiva no puede usarse en altas', async () => {
    const id = db.prepare("SELECT id FROM categorias WHERE nombre = 'Laboratorios'").get().id;
    await admin.post(`/categorias/${id}`, { nombre: 'Laboratorios', descripcion: 'x', activaEstado: '1' });
    const estudiante = await entrar('estudiante');
    const r = await estudiante.post('/solicitudes', {
      titulo: 'Con categoria inactiva', descripcion: 'No debe permitirse.', categoriaId: String(id), prioridad: 'baja',
    });
    assert.equal(r.status, 400);
    assert.match(await r.text(), /inactiva/);
    await admin.post(`/categorias/${id}`, {
      nombre: 'Laboratorios', descripcion: 'x', activaEstado: '1', activa: 'on',
    });
  });
});

test('RF04/RF05: registro y consulta de solicitudes del estudiante', async (t) => {
  let estudiante;
  let codigoCreado;

  await t.test('el formulario de alta muestra solo categorias activas', async () => {
    estudiante = await entrar('estudiante');
    const r = await estudiante.get('/solicitudes/nueva');
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Matricula/);
    assert.doesNotMatch(html, /Inactiva Demo/);
  });

  await t.test('registra una solicitud valida con estado inicial REGISTRADA', async () => {
    const r = await estudiante.post('/solicitudes', {
      titulo: 'Cambio de horario de laboratorio',
      descripcion: 'Solicito cambio al horario matutino por trabajo.',
      categoriaId: '1', prioridad: 'media',
    });
    assert.equal(r.status, 302);
    codigoCreado = new URL(r.headers.get('location'), base).pathname.split('/').pop();
    assert.match(codigoCreado, /^SOL-\d{4}-\d{4}$/);
    const fila = db.prepare('SELECT estado, solicitante_id FROM solicitudes WHERE codigo = ?').get(codigoCreado);
    assert.equal(fila.estado, 'REGISTRADA');
    assert.equal(fila.solicitante_id, 2);
  });

  await t.test('valida campos obligatorios en el alta', async () => {
    const r = await estudiante.post('/solicitudes', {
      titulo: '', descripcion: 'x', categoriaId: '1', prioridad: 'media',
    });
    assert.equal(r.status, 400);
    assert.match(await r.text(), /titulo es obligatorio/);
  });

  await t.test('el estudiante ve solo sus propias solicitudes en el listado', async () => {
    const r = await estudiante.get('/solicitudes');
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.ok(html.includes(codigoCreado), 'debe listar su solicitud nueva');
    assert.doesNotMatch(html, /SOL-2026-0004/, 'no debe ver solicitudes ajenas');
  });

  await t.test('no puede abrir el detalle de una solicitud ajena (403)', async () => {
    const ajena = db.prepare("SELECT codigo FROM solicitudes WHERE solicitante_id = 5 LIMIT 1").get();
    const r = await estudiante.get(`/solicitudes/${ajena.codigo}`);
    assert.equal(r.status, 403);
    assert.match(await r.text(), /permiso/);
  });

  await t.test('el funcionario solo ve las asignadas y les aplica filtros', async () => {
    const funcionario = await entrar('funcionario');
    const r = await funcionario.get('/solicitudes?estado=EN_PROCESO');
    const html = await r.text();
    assert.equal(r.status, 200);
    const asignadas = db.prepare('SELECT codigo FROM solicitudes WHERE responsable_id = 3').all();
    assert.ok(asignadas.length > 0);
    assert.doesNotMatch(html, /SOL-2026-0005/, 'REGISTRADA sin asignar no debe verse');
  });
});

test('RF07/RF08/RF09: asignacion, atencion, historial y notificaciones', async (t) => {
  let admin;
  let codigo;

  await t.test('prepara una solicitud y la asigna el administrador', async () => {
    admin = await entrar('admin');
    const estudiante = await entrar('estudiante');
    const r = await estudiante.post('/solicitudes', {
      titulo: 'Casillero de objetos perdidos', descripcion: 'Reclamo de casillero 12.',
      categoriaId: '1', prioridad: 'alta',
    });
    codigo = new URL(r.headers.get('location'), base).pathname.split('/').pop();
    const asig = await admin.post(`/solicitudes/${codigo}/asignar`, { responsableId: '3', motivo: 'A servicios generales.' });
    assert.equal(asig.status, 302);
    const fila = db.prepare('SELECT estado, responsable_id FROM solicitudes WHERE codigo = ?').get(codigo);
    assert.equal(fila.estado, 'ASIGNADA');
    assert.equal(fila.responsable_id, 3);
  });

  await t.test('el estudiante no puede asignar (403)', async () => {
    const estudiante = await entrar('estudiante');
    const r = await estudiante.post(`/solicitudes/${codigo}/asignar`, { responsableId: '6' });
    assert.equal(r.status, 403);
  });

  await t.test('el funcionario atiende: ASIGNADA -> EN_PROCESO -> RESUELTA con solucion', async () => {
    const funcionario = await entrar('funcionario');
    const inicio = await funcionario.post(`/solicitudes/${codigo}/estado`, { nuevoEstado: 'EN_PROCESO' });
    assert.equal(inicio.status, 302);

    const sinSolucion = await funcionario.post(`/solicitudes/${codigo}/estado`, { nuevoEstado: 'RESUELTA' });
    assert.match(decodeURIComponent(sinSolucion.headers.get('location')), /solucion/);

    const resuelta = await funcionario.post(`/solicitudes/${codigo}/estado`, {
      nuevoEstado: 'RESUELTA', solucion: 'Casillero recuperado y entregado.',
    });
    assert.equal(resuelta.status, 302);
    const fila = db.prepare('SELECT estado, solucion FROM solicitudes WHERE codigo = ?').get(codigo);
    assert.equal(fila.estado, 'RESUELTA');
    assert.equal(fila.solucion, 'Casillero recuperado y entregado.');
  });

  await t.test('RF08: la observacion marcada como solucion se registra', async () => {
    const funcionario = await entrar('funcionario');
    const r = await funcionario.post(`/solicitudes/${codigo}/observaciones`, {
      texto: 'Se documento la entrega en el libro de registro.', es_solucion: 'on',
    });
    assert.equal(r.status, 302);
    const obs = db.prepare(
      `SELECT o.es_solucion FROM observaciones o JOIN solicitudes s ON s.id = o.solicitud_id
        WHERE s.codigo = ? ORDER BY o.id DESC LIMIT 1`
    ).get(codigo);
    assert.equal(obs.es_solucion, 1);
  });

  await t.test('RF09: el historial conserva cada cambio con fecha, usuario y motivo', async () => {
    const estudiante = await entrar('estudiante');
    const r = await estudiante.get(`/solicitudes/${codigo}`);
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.match(html, /Historial de cambios/);
    const filas = db.prepare(
      `SELECT h.* FROM historiales h JOIN solicitudes s ON s.id = h.solicitud_id WHERE s.codigo = ?`
    ).all(codigo);
    assert.equal(filas.length, 4, 'registro, asignacion, inicio y resolucion');
    for (const f of filas) {
      assert.ok(f.fecha, 'falta fecha');
      assert.ok(f.usuario_id, 'falta usuario');
      assert.ok(f.estado_nuevo, 'falta estado');
    }
    const asignacion = filas.find((f) => f.estado_nuevo === 'ASIGNADA');
    assert.equal(asignacion.observacion, 'A servicios generales.');
  });

  await t.test('el estudiante cierra su solicitud resuelta y la CERRADA queda inmutable', async () => {
    const estudiante = await entrar('estudiante');
    const cierre = await estudiante.post(`/solicitudes/${codigo}/estado`, { nuevoEstado: 'CERRADA' });
    assert.equal(cierre.status, 302);
    assert.equal(db.prepare('SELECT estado FROM solicitudes WHERE codigo = ?').get(codigo).estado, 'CERRADA');

    const obs = await estudiante.post(`/solicitudes/${codigo}/observaciones`, { texto: 'post cierre' });
    assert.match(decodeURIComponent(obs.headers.get('location')), /Cerrada no admite/);
  });

  await t.test('la reapertura de la CERRADA es exclusiva de administrador/supervisor', async () => {
    const estudiante = await entrar('estudiante');
    const negada = await estudiante.post(`/solicitudes/${codigo}/estado`, {
      nuevoEstado: 'REABIERTA', motivo: 'No me entero.',
    });
    assert.match(decodeURIComponent(negada.headers.get('location')), /estudiante/);

    const autorizada = await admin.post(`/solicitudes/${codigo}/estado`, {
      nuevoEstado: 'REABIERTA', motivo: 'Autoriza reapertura por reclamo formal.',
    });
    assert.equal(autorizada.status, 302);
    const fila = db.prepare('SELECT estado, solucion FROM solicitudes WHERE codigo = ?').get(codigo);
    assert.equal(fila.estado, 'REABIERTA');
    assert.equal(fila.solucion, null, 'la solucion se limpia al reabrir');
  });

  await t.test('RF10: genera notificaciones internas y permite marcarlas como leidas', async () => {
    const funcionario = await entrar('funcionario');
    const lista = await funcionario.get('/notificaciones');
    assert.equal(lista.status, 200);
    const noLeidas = db.prepare('SELECT COUNT(*) t FROM notificaciones WHERE usuario_id = 3 AND leida = 0').get().t;
    assert.ok(noLeidas > 0, 'el funcionario debia tener notificaciones nuevas');

    await funcionario.post('/notificaciones/leer-todas', {});
    assert.equal(db.prepare('SELECT COUNT(*) t FROM notificaciones WHERE usuario_id = 3 AND leida = 0').get().t, 0);
  });
});

test('RF11: reportes y estadisticas para supervisor y administrador', async (t) => {
  await t.test('el supervisor consulta reportes con todos los cortes', async () => {
    const supervisor = await entrar('supervisor');
    const r = await supervisor.get('/reportes');
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Reportes y estadisticas/);
    assert.match(html, /Matricula/, 'corte por categoria');
    assert.match(html, /alta/, 'corte por prioridad');
    assert.match(html, /Luis Ramirez/, 'corte por responsable');
  });

  await t.test('el filtro por periodo responde', async () => {
    const admin = await entrar('admin');
    const r = await admin.get('/reportes?desde=2026-01-01&hasta=2026-12-31');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /2026/);
  });

  await t.test('el administrador tambien accede; el estudiante nunca', async () => {
    const admin = await entrar('admin');
    assert.equal((await admin.get('/reportes')).status, 200);
    const estudiante = await entrar('estudiante');
    assert.equal((await estudiante.get('/reportes')).status, 403);
  });
});

test('reglas transversales: 404, y solo usuarios autenticados', async (t) => {
  await t.test('ruta inexistente -> 404 personalizado', async () => {
    const s = await entrar('admin');
    const r = await s.get('/ruta-que-no-existe');
    assert.equal(r.status, 404);
    assert.match(await r.text(), /no encontrada|no existe/i);
  });

  await t.test('POST protegido sin sesion redirige a login', async () => {
    const s = await sesionNueva();
    const r = await s.post('/solicitudes', { titulo: 'x', descripcion: 'y', categoriaId: '1', prioridad: 'baja' });
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get('location'), base).pathname, '/login');
    assert.equal(db.prepare('SELECT COUNT(*) t FROM solicitudes WHERE titulo = ?').get('x').t, 0);
  });
});
