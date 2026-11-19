const bcrypt = require('bcryptjs');

function sembrarDatos(db) {
  const usuarios = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
  if (usuarios > 0) return false;

  const hash = (p) => bcrypt.hashSync(p, 10);

  const insertarUsuario = db.prepare(
    `INSERT INTO usuarios (codigo, nombre, email, password_hash, rol, activo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertarUsuario.run('U-0001', 'Carla Mendez (Administradora)', 'admin@universidad.edu', hash('Admin123!'), 'administrador', 1);
  insertarUsuario.run('U-0002', 'Ana Torres (Estudiante)', 'ana@universidad.edu', hash('Estu123!'), 'estudiante', 1);
  insertarUsuario.run('U-0003', 'Luis Ramirez (Funcionario)', 'luis@universidad.edu', hash('Func123!'), 'funcionario', 1);
  insertarUsuario.run('U-0004', 'Maria Lopez (Supervisora)', 'maria@universidad.edu', hash('Super123!'), 'supervisor', 1);
  insertarUsuario.run('U-0005', 'Pedro Gomez (Estudiante)', 'pedro@universidad.edu', hash('Estu123!'), 'estudiante', 1);
  insertarUsuario.run('U-0006', 'Sofia Herrera (Funcionario)', 'sofia@universidad.edu', hash('Func123!'), 'funcionario', 1);
  insertarUsuario.run('U-0007', 'Diego Vargas (Estudiante)', 'diego@universidad.edu', hash('Estu123!'), 'estudiante', 1);
  insertarUsuario.run('U-0008', 'Valeria Cruz (Estudiante)', 'valeria@universidad.edu', hash('Estu123!'), 'estudiante', 1);

  const insertarCategoria = db.prepare(
    'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)'
  );
  insertarCategoria.run('Matricula', 'Procesos de matricula, homologacion y cambios de seccion.');
  insertarCategoria.run('Becas', 'Solicitudes de becas, subsidios y apoyos economicos.');
  insertarCategoria.run('Certificados', 'Emision de certificados de notas, estudio y constancias.');
  insertarCategoria.run('Infraestructura', 'Reportes de aulas, laboratorios y espacios fisicos.');
  insertarCategoria.run('Biblioteca', 'Prestamos, reservas y recursos bibliograficos.');
  insertarCategoria.run('Tutorias', 'Solicitudes de tutoria y acompanamiento academico.');

  const insertarSolicitud = db.prepare(
    `INSERT INTO solicitudes (codigo, solicitante_id, categoria_id, titulo, descripcion, prioridad, estado, responsable_id, solucion, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))`
  );
  const insertarHistorial = db.prepare(
    `INSERT INTO historiales (solicitud_id, estado_anterior, estado_nuevo, usuario_id, observacion, fecha)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
  );
  const insertarObservacion = db.prepare(
    `INSERT INTO observaciones (solicitud_id, usuario_id, texto, es_solucion, fecha)
     VALUES (?, ?, ?, ?, datetime('now', ?))`
  );
  const insertarNotificacion = db.prepare(
    `INSERT INTO notificaciones (usuario_id, solicitud_id, tipo, mensaje, leida, fecha)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
  );

  const solicitudes = [
    { codigo: 'SOL-2026-0001', sol: 2, cat: 1, titulo: 'Cambio de seccion de Calculo I', desc: 'Solicito cambio a la seccion vespertina por conflicto de horario laboral.', prio: 'media', est: 'CERRADA', resp: 3, creada: '-12 days', solucion: 'Cambio realizado a la seccion 02. Registrado en el sistema academico.' },
    { codigo: 'SOL-2026-0002', sol: 5, cat: 2, titulo: 'Beca de excelencia academica', desc: 'Solicito evaluacion para la beca de excelencia del semestre actual.', prio: 'alta', est: 'EN_PROCESO', resp: 6, creada: '-8 days', solucion: null },
    { codigo: 'SOL-2026-0003', sol: 2, cat: 3, titulo: 'Certificado de notas para practica', desc: 'Requiero certificado de notas con promedio para postular a practica profesional.', prio: 'alta', est: 'RESUELTA', resp: 3, creada: '-5 days', solucion: 'Certificado emitido y enviado al correo institucional.' },
    { codigo: 'SOL-2026-0004', sol: 7, cat: 4, titulo: 'Proyector dañado en aula 305', desc: 'El proyector del aula 305 no enciende, afecta las clases de la tarde.', prio: 'critica', est: 'ASIGNADA', resp: 6, creada: '-3 days', solucion: null },
    { codigo: 'SOL-2026-0005', sol: 5, cat: 5, titulo: 'Reserva de sala de estudio', desc: 'Reserva de sala de estudio grupal para la semana de examenes.', prio: 'baja', est: 'REGISTRADA', resp: null, creada: '-2 days', solucion: null },
    { codigo: 'SOL-2026-0006', sol: 2, cat: 6, titulo: 'Tutoria de Fisica II', desc: 'Solicito tutoria grupal los martes por la tarde.', prio: 'media', est: 'REGISTRADA', resp: null, creada: '-1 days', solucion: null },
    { codigo: 'SOL-2026-0007', sol: 7, cat: 1, titulo: 'Homologacion de asignatura', desc: 'Solicito homologar la asignatura de Programacion I cursada en otra institucion.', prio: 'alta', est: 'REABIERTA', resp: 3, creada: '-10 days', solucion: null },
    { codigo: 'SOL-2026-0008', sol: 5, cat: 4, titulo: 'Fuga de agua en laboratorio 2', desc: 'Se presento fuga de agua cerca de los lavados del laboratorio 2.', prio: 'critica', est: 'EN_PROCESO', resp: 6, creada: '-4 days', solucion: null },
    { codigo: 'SOL-2026-0009', sol: 2, cat: 2, titulo: 'Beca de transporte', desc: 'Solicito apoyo de transporte por cambio de residencia.', prio: 'media', est: 'RECHAZADA', resp: 6, creada: '-15 days', solucion: null },
    { codigo: 'SOL-2026-0010', sol: 7, cat: 3, titulo: 'Constancia de estudio', desc: 'Requiero constancia de estudio para tramiite de beca externa.', prio: 'baja', est: 'CERRADA', resp: 3, creada: '-20 days', solucion: 'Constancia generada y entregada en secretaria.' },
  ];

  function construirCamino(s) {
    const dias = parseInt(s.creada, 10) || 0;
    const fecha = (k) => `${Math.min(0, dias + k)} days`;
    const registro = { de: null, a: 'REGISTRADA', quien: s.sol, obs: 'Registro inicial de la solicitud.' };
    const asignar = { de: 'REGISTRADA', a: 'ASIGNADA', quien: 4, obs: 'Asignada a funcionario competente.' };
    const atender = { de: 'ASIGNADA', a: 'EN_PROCESO', quien: s.resp, obs: 'Atencion iniciada por el responsable asignado.' };
    const resolver = { de: 'EN_PROCESO', a: 'RESUELTA', quien: s.resp, obs: `Solucion aplicada: ${s.solucion || 'Atencion completada.'}` };
    const cerrar = { de: 'RESUELTA', a: 'CERRADA', quien: s.sol, obs: 'Solucion verificada y aceptada por el solicitante.' };
    const rechazar = { de: 'EN_PROCESO', a: 'RECHAZADA', quien: s.resp, obs: 'Rechazo registrado: la solicitud no aplica a la politica institucional vigente.' };
    const reabrir = { de: 'RECHAZADA', a: 'REABIERTA', quien: s.sol, obs: 'Reapertura autorizada: el caso requiere una nueva evaluacion.' };
    const caminos = {
      REGISTRADA: [registro],
      ASIGNADA: [registro, asignar],
      EN_PROCESO: [registro, asignar, atender],
      RESUELTA: [registro, asignar, atender, resolver],
      CERRADA: [registro, asignar, atender, resolver, cerrar],
      RECHAZADA: [registro, asignar, atender, rechazar],
      REABIERTA: [registro, asignar, atender, rechazar, reabrir],
    };
    return (caminos[s.est] || [registro]).map((paso, k) => ({ ...paso, fecha: fecha(k) }));
  }

  for (const s of solicitudes) {
    const camino = construirCamino(s);
    const ultimo = camino[camino.length - 1];
    const r = insertarSolicitud.run(
      s.codigo, s.sol, s.cat, s.titulo, s.desc, s.prio, s.est, s.resp, s.solucion, s.creada, ultimo.fecha
    );
    const id = Number(r.lastInsertRowid);
    for (const paso of camino) {
      insertarHistorial.run(id, paso.de, paso.a, paso.quien, paso.obs, paso.fecha);
    }
    const pasoResolucion = camino.find((p) => p.a === 'RESUELTA');
    if (pasoResolucion && (s.est === 'RESUELTA' || s.est === 'CERRADA')) {
      insertarObservacion.run(id, s.resp || 3, s.solucion || 'Atencion completada.', 1, pasoResolucion.fecha);
    }
    if (s.resp) {
      insertarNotificacion.run(s.resp, id, 'ASIGNACION', `Se le ha asignado la solicitud ${s.codigo}.`, 1, s.creada);
    }
    insertarNotificacion.run(s.sol, id, 'ACTUALIZACION', `Su solicitud ${s.codigo} se encuentra en estado ${s.est}.`, 0, ultimo.fecha);
  }

  return true;
}

module.exports = { sembrarDatos };
