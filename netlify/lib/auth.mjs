/**
 * Autenticación con JSON Web Tokens.
 *
 * Variables de entorno:
 *   JWT_SECRETO     clave para firmar y validar los tokens (obligatoria)
 *   JWT_EXPIRACION  duración del token, por defecto "2h" (formato de jsonwebtoken: "30m", "2h", "1d")
 *
 * Roles:
 *   admin    crear, editar y borrar
 *   editor   crear y editar (borrar responde 403)
 * El primer usuario que se registra queda como admin; los demás, como editor.
 */
import jwt from 'jsonwebtoken';
import { RespuestaError } from './http.mjs';

function secreto() {
  const clave = process.env.JWT_SECRETO;
  if (!clave) throw new RespuestaError(500, 'Falta la variable de entorno JWT_SECRETO para firmar los tokens.');
  return clave;
}

/** Datos públicos del usuario (nunca el hash de la contraseña). */
export function usuarioPublico(u) {
  return { id: String(u._id), nombre: u.nombre, correo: u.correo, rol: u.rol };
}

export function firmarToken(usuario) {
  const u = usuarioPublico(usuario);
  return jwt.sign(
    { nombre: u.nombre, correo: u.correo, rol: u.rol },
    secreto(),
    { subject: u.id, expiresIn: process.env.JWT_EXPIRACION || '2h', algorithm: 'HS256' }
  );
}

const SIN_TOKEN = { 'WWW-Authenticate': 'Bearer' };

/**
 * Valida el encabezado Authorization: Bearer <token>.
 * Devuelve { id, nombre, correo, rol } o lanza 401.
 */
export function exigirUsuario(req) {
  const cabecera = req.headers.get('Authorization') || '';
  const [tipo, token] = cabecera.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new RespuestaError(401, 'Debes iniciar sesión para realizar esta operación.', null, SIN_TOKEN);
  }

  try {
    const datos = jwt.verify(token, secreto(), { algorithms: ['HS256'] });
    return { id: datos.sub, nombre: datos.nombre, correo: datos.correo, rol: datos.rol };
  } catch (e) {
    if (e instanceof RespuestaError) throw e;
    const mensaje = e.name === 'TokenExpiredError'
      ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
      : 'El token de acceso no es válido.';
    throw new RespuestaError(401, mensaje, null, { 'WWW-Authenticate': 'Bearer error="invalid_token"' });
  }
}

/** Valida el token y además que el usuario tenga uno de los roles indicados (si no, 403). */
export function exigirRol(req, ...roles) {
  const usuario = exigirUsuario(req);
  if (!roles.includes(usuario.rol)) {
    throw new RespuestaError(403, `Tu usuario (rol "${usuario.rol}") no tiene permiso para esta operación.`);
  }
  return usuario;
}
