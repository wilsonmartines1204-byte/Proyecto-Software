const { ErrorNegocio } = require('./AuthService');
const { esRolValido } = require('../domain/permisos');

class UsuarioService {
  constructor({ usuarios, notificador }) {
    this.usuarios = usuarios;
    this.notificador = notificador;
  }

  listar(filtros = {}) {
    return this.usuarios.listar(filtros);
  }

  listarFuncionarios() {
    return this.usuarios.listarPorRol('funcionario');
  }

  obtener(id) {
    const usuario = this.usuarios.porId(id);
    if (!usuario) throw new ErrorNegocio('Usuario no encontrado.', 'NO_ENCONTRADO');
    return usuario;
  }

  async actualizar(id, datos, usuarioActual) {
    const existente = this.obtener(id);
    if (datos.email && datos.email.toLowerCase() !== existente.email) {
      const duplicado = this.usuarios.porEmail(datos.email.toLowerCase());
      if (duplicado) throw new ErrorNegocio('Ya existe un usuario con ese correo.', 'DUPLICADO');
    }
    if (datos.rol && !esRolValido(datos.rol)) {
      throw new ErrorNegocio('Rol invalido.', 'DATOS_INVALIDOS');
    }
    if (datos.rol && datos.rol !== existente.rol && id === usuarioActual.id) {
      throw new ErrorNegocio('No puede cambiar su propio rol.', 'REGLA_NEGOCIO');
    }
    if (datos.activo === false && id === usuarioActual.id) {
      throw new ErrorNegocio('No puede desactivar su propia cuenta.', 'REGLA_NEGOCIO');
    }
    if (datos.activo === false && existente.rol === 'administrador') {
      const admins = this.usuarios.listarPorRol('administrador');
      if (admins.length <= 1) {
        throw new ErrorNegocio('Debe existir al menos un administrador activo.', 'REGLA_NEGOCIO');
      }
    }
    return this.usuarios.actualizar(id, {
      nombre: datos.nombre,
      email: datos.email ? datos.email.toLowerCase() : undefined,
      rol: datos.rol,
      activo: datos.activo,
    });
  }

  async crear(datos) {
    if (!esRolValido(datos.rol)) throw new ErrorNegocio('Rol invalido.', 'DATOS_INVALIDOS');
    const { AuthService } = require('./AuthService');
    const auth = new AuthService({ usuarios: this.usuarios });
    const creado = await auth.crearUsuario(datos);
    this.notificador.notificar({
      destinatarios: [creado.id],
      solicitudId: null,
      tipo: 'USUARIO',
      mensaje: `Su cuenta ${creado.email} fue creada con rol ${creado.rol}.`,
    });
    return creado;
  }
}

class CategoriaService {
  constructor({ categorias }) {
    this.categorias = categorias;
  }

  listar(soloActivas = false) {
    return this.categorias.listar({ soloActivas });
  }

  crear({ nombre, descripcion }) {
    if (!nombre || !String(nombre).trim()) {
      throw new ErrorNegocio('El nombre de la categoria es obligatorio.', 'DATOS_INVALIDOS');
    }
    if (this.categorias.porNombre(String(nombre).trim())) {
      throw new ErrorNegocio('Ya existe una categoria con ese nombre.', 'DUPLICADO');
    }
    return this.categorias.crear({ nombre: String(nombre).trim(), descripcion });
  }

  actualizar(id, datos) {
    const existente = this.categorias.porId(id);
    if (!existente) throw new ErrorNegocio('Categoria no encontrada.', 'NO_ENCONTRADO');
    if (datos.nombre && datos.nombre.trim() !== existente.nombre) {
      const duplicada = this.categorias.porNombre(datos.nombre.trim());
      if (duplicada && duplicada.id !== id) {
        throw new ErrorNegocio('Ya existe una categoria con ese nombre.', 'DUPLICADO');
      }
    }
    return this.categorias.actualizar(id, {
      nombre: datos.nombre ? datos.nombre.trim() : undefined,
      descripcion: datos.descripcion,
      activa: datos.activa,
    });
  }
}

module.exports = { UsuarioService, CategoriaService, ErrorNegocio };
