const test = require('node:test');
const assert = require('node:assert/strict');

const { prepararEscenario } = require('../utilidades-prueba');
const { ErrorNegocio } = require('../../src/services/AuthService');

test('AuthService y UsuarioService validan el alta y la edicion de usuarios (RF02)', async (t) => {
  const esc = prepararEscenario('auth');
  t.after(() => esc.cerrar());
  const { auth } = esc.servicios;

  await t.test('autenticacion correcta devuelve los datos de sesion sin password', async () => {
    const sesion = await auth.autenticar('ana@uni.edu', 'Estu123!');
    assert.equal(sesion.id, 2);
    assert.equal(sesion.rol, 'estudiante');
    assert.equal(sesion.password, undefined);
    assert.equal(sesion.password_hash, undefined);
  });

  await t.test('correo inexistente o password incorrecta -> credenciales invalidas', async () => {
    await assert.rejects(() => auth.autenticar('noexiste@uni.edu', 'Estu123!'), /Credenciales invalidas/);
    await assert.rejects(() => auth.autenticar('ana@uni.edu', 'otra'), /Credenciales invalidas/);
    await assert.rejects(() => auth.autenticar('', ''), /correo y contrasena/);
  });

  await t.test('cuenta desactivada no puede iniciar sesion', async () => {
    await assert.rejects(() => auth.autenticar('diego@uni.edu', 'Estu123!'), /desactivada/);
  });

  await t.test('el alta exige campos obligatorios y contrasena suficiente', async () => {
    await assert.rejects(() => auth.crearUsuario({ nombre: 'X' }), /obligatorios/);
    await assert.rejects(
      () => auth.crearUsuario({ nombre: 'X', email: 'x@uni.edu', password: '123', rol: 'estudiante' }),
      /al menos 6 caracteres/
    );
    await assert.rejects(
      () => auth.crearUsuario({ nombre: 'Dup', email: 'ana@uni.edu', password: '123456', rol: 'estudiante' }),
      /Ya existe un usuario/
    );
  });

  await t.test('el alta crea el usuario con hash y sin password en claro', async () => {
    const creado = await auth.crearUsuario({
      codigo: 'U-0100', nombre: 'Nuevo Estudiante', email: 'Nuevo@Uni.Edu', password: 'Clave123', rol: 'estudiante',
    });
    assert.equal(creado.email, 'nuevo@uni.edu');
    assert.ok(creado.password_hash.startsWith('$'));
    assert.ok(creado.password_hash !== 'Clave123');
    assert.equal(creado.rol, 'estudiante');
  });

  await t.test('cambio de contrasena con contrasena actual verificada', async () => {
    await assert.rejects(() => auth.cambiarPassword(2, 'mala', 'Nueva123'), /no es correcta/);
    await assert.rejects(() => auth.cambiarPassword(2, 'Estu123!', 'abc'), /al menos 6 caracteres/);
    await auth.cambiarPassword(2, 'Estu123!', 'NuevaClave1');
    const sesion = await auth.autenticar('ana@uni.edu', 'NuevaClave1');
    assert.equal(sesion.id, 2);
    await assert.rejects(() => auth.autenticar('ana@uni.edu', 'Estu123!'), /Credenciales invalidas/);
  });
});

test('UsuarioService aplica las reglas de administracion de usuarios (RF02)', async (t) => {
  const esc = prepararEscenario('usuarios-svc');
  t.after(() => esc.cerrar());
  const { usuariosService } = esc.servicios;
  const { admin, estudiante } = esc.usuarios;

  await t.test('no permite cambiar el propio rol', async () => {
    await assert.rejects(
      () => usuariosService.actualizar(admin.id, { rol: 'estudiante' }, admin),
      /No puede cambiar su propio rol/
    );
  });

  await t.test('no permite desactivarse a uno mismo', async () => {
    await assert.rejects(
      () => usuariosService.actualizar(admin.id, { activo: false }, admin),
      /No puede desactivar su propia cuenta/
    );
  });

  await t.test('debe existir al menos un administrador activo', async () => {
    await assert.rejects(
      () => usuariosService.actualizar(admin.id, { activo: false }, { id: 999, rol: 'supervisor' }),
      /al menos un administrador activo/
    );
  });

  await t.test('no admite correos duplicados ni roles invalidos', async () => {
    await assert.rejects(
      () => usuariosService.actualizar(estudiante.id, { email: 'admin@uni.edu' }, admin),
      /Ya existe un usuario/
    );
    await assert.rejects(
      () => usuariosService.actualizar(estudiante.id, { rol: 'hacker' }, admin),
      /Rol invalido/
    );
  });

  await t.test('permite editar nombre, correo y desactivar otra cuenta', async () => {
    await usuariosService.actualizar(estudiante.id, { nombre: 'Ana Editada', email: 'ana2@uni.edu' }, admin);
    const guardado = esc.repositorios.usuarios.porId(estudiante.id);
    assert.equal(guardado.nombre, 'Ana Editada');
    assert.equal(guardado.email, 'ana2@uni.edu');

    await usuariosService.actualizar(5, { activo: false }, admin);
    assert.equal(esc.repositorios.usuarios.porId(5).activo, 0);
  });
});

test('CategoriaService gestiona las categorias con unico de nombre (RF03)', async (t) => {
  const esc = prepararEscenario('categorias-svc');
  t.after(() => esc.cerrar());
  const { categoriasService } = esc.servicios;

  await t.test('crea categorias validas y rechaza vacias o duplicadas', () => {
    const creada = categoriasService.crear({ nombre: '  Deportes  ', descripcion: 'Actividades deportivas.' });
    assert.equal(creada.nombre, 'Deportes');
    assert.throws(() => categoriasService.crear({ nombre: '   ' }), /obligatorio/);
    assert.throws(() => categoriasService.crear({ nombre: 'Matricula' }), /Ya existe una categoria/);
  });

  await t.test('edita nombre, descripcion y estado activo', () => {
    const lista = categoriasService.listar(false);
    const matricula = lista.find((c) => c.nombre === 'Matricula');
    categoriasService.actualizar(matricula.id, { descripcion: 'Descripcion editada.', activa: false });
    const actualizada = esc.repositorios.categorias.porId(matricula.id);
    assert.equal(actualizada.descripcion, 'Descripcion editada.');
    assert.equal(actualizada.activa, 0);
  });

  await t.test('al listar solo activas se ocultan las deshabilitadas', () => {
    const activas = categoriasService.listar(true);
    assert.ok(activas.every((c) => c.activa === 1));
    assert.ok(!activas.some((c) => c.nombre === 'Matricula'));
    assert.ok(!activas.some((c) => c.nombre === 'Inactiva Demo'));
  });

  await t.test('no renombra a una categoria existente distinta', () => {
    assert.throws(
      () => categoriasService.actualizar(2, { nombre: 'Matricula' }),
      /Ya existe una categoria/
    );
  });
});
