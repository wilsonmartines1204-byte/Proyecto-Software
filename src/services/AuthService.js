const bcrypt = require('bcryptjs');

class ErrorNegocio extends Error {
  constructor(mensaje, estado = 'REGLA_NEGOCIO') {
    super(mensaje);
    this.name = 'ErrorNegocio';
    this.estado = estado;
  }
}

class AuthService {
  constructor({ usuarios }) {
    this.usuarios = usuarios;
  }

  async autenticar(email, password) {
    if (!email || !password) {
      throw new ErrorNegocio('Debe ingresar correo y contrasena.', 'DATOS_INVALIDOS');
    }
    const usuario = this.usuarios.porEmail(String(email).trim().toLowerCase());
    if (!usuario) {
      throw new ErrorNegocio('Credenciales invalidas.', 'AUTENTICACION');
    }
    if (!usuario.activo) {
      throw new ErrorNegocio('La cuenta se encuentra desactivada. Contacte al administrador.', 'AUTENTICACION');
    }
    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      throw new ErrorNegocio('Credenciales invalidas.', 'AUTENTICACION');
    }
    return this._datosSesion(usuario);
  }

  async crearUsuario({ codigo, nombre, email, password, rol }) {
    if (!nombre || !email || !password || !rol) {
      throw new ErrorNegocio('Nombre, correo, contrasena y rol son obligatorios.', 'DATOS_INVALIDOS');
    }
    if (String(password).length < 6) {
      throw new ErrorNegocio('La contrasena debe tener al menos 6 caracteres.', 'DATOS_INVALIDOS');
    }
    const emailNormalizado = String(email).trim().toLowerCase();
    if (this.usuarios.porEmail(emailNormalizado)) {
      throw new ErrorNegocio('Ya existe un usuario con ese correo.', 'DUPLICADO');
    }
    const hash = await bcrypt.hash(password, 10);
    return this.usuarios.crear({
      codigo: codigo || null,
      nombre: String(nombre).trim(),
      email: emailNormalizado,
      passwordHash: hash,
      rol,
    });
  }

  async cambiarPassword(id, passwordActual, passwordNuevo) {
    const usuario = this.usuarios.porId(id);
    if (!usuario) throw new ErrorNegocio('Usuario no encontrado.', 'NO_ENCONTRADO');
    const coincide = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!coincide) throw new ErrorNegocio('La contrasena actual no es correcta.', 'AUTENTICACION');
    if (String(passwordNuevo).length < 6) {
      throw new ErrorNegocio('La nueva contrasena debe tener al menos 6 caracteres.', 'DATOS_INVALIDOS');
    }
    const hash = await bcrypt.hash(passwordNuevo, 10);
    this.usuarios.actualizar(id, { passwordHash: hash });
  }

  _datosSesion(usuario) {
    return {
      id: usuario.id,
      codigo: usuario.codigo,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }
}

module.exports = { AuthService, ErrorNegocio };
