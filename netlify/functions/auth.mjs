/**
 * Autenticación:
 *   POST /api/auth/registro   { nombre, correo, contrasena }  -> 201 { token, usuario }
 *   POST /api/auth/login      { correo, contrasena }          -> 200 { token, usuario }
 *   GET  /api/auth/yo         Authorization: Bearer <token>   -> 200 { usuario }
 *
 * Las contraseñas se guardan con bcrypt (nunca en texto plano).
 */
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { obtenerDb } from '../lib/db.mjs';
import { firmarToken, usuarioPublico, exigirUsuario } from '../lib/auth.mjs';
import { json, leerCuerpo, manejar, partesRuta, RespuestaError, ahora } from '../lib/http.mjs';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RONDAS_BCRYPT = 10;

async function registro(req) {
  const cuerpo = await leerCuerpo(req);
  const nombre = String(cuerpo.nombre ?? '').trim();
  const correo = String(cuerpo.correo ?? '').trim().toLowerCase();
  const contrasena = String(cuerpo.contrasena ?? '');

  const fallos = [];
  if (nombre.length < 2 || nombre.length > 80) fallos.push('El nombre debe tener entre 2 y 80 caracteres.');
  if (!CORREO_VALIDO.test(correo) || correo.length > 160) fallos.push('El correo no es válido.');
  if (contrasena.length < 8) fallos.push('La contraseña debe tener al menos 8 caracteres.');
  if (contrasena.length > 72) fallos.push('La contraseña no puede superar los 72 caracteres.');
  if (fallos.length) throw new RespuestaError(422, 'Los datos de registro no son válidos.', fallos);

  const db = await obtenerDb();
  const usuarios = db.collection('usuarios');

  if (await usuarios.findOne({ correo }, { projection: { _id: 1 } })) {
    throw new RespuestaError(409, 'Ya existe una cuenta con ese correo.');
  }

  // El primer usuario del sistema queda como administrador.
  const rol = (await usuarios.countDocuments()) === 0 ? 'admin' : 'editor';

  const usuario = {
    nombre,
    correo,
    contrasena_hash: await bcrypt.hash(contrasena, RONDAS_BCRYPT),
    rol,
    creado_en: ahora(),
  };

  try {
    const { insertedId } = await usuarios.insertOne(usuario);
    usuario._id = insertedId;
  } catch (e) {
    if (e?.code === 11000) throw new RespuestaError(409, 'Ya existe una cuenta con ese correo.');
    throw e;
  }

  return json({ token: firmarToken(usuario), usuario: usuarioPublico(usuario) }, 201);
}

async function login(req) {
  const cuerpo = await leerCuerpo(req);
  const correo = String(cuerpo.correo ?? '').trim().toLowerCase();
  const contrasena = String(cuerpo.contrasena ?? '');

  if (!correo || !contrasena) throw new RespuestaError(400, 'Escribe tu correo y tu contraseña.');

  const db = await obtenerDb();
  const usuario = await db.collection('usuarios').findOne({ correo });
  const valida = usuario && (await bcrypt.compare(contrasena, usuario.contrasena_hash));

  // Mismo mensaje si el correo no existe o la contraseña está mal.
  if (!valida) throw new RespuestaError(401, 'Correo o contraseña incorrectos.');

  return json({ token: firmarToken(usuario), usuario: usuarioPublico(usuario) });
}

async function yo(req) {
  const datos = exigirUsuario(req);
  const db = await obtenerDb();
  const usuario = ObjectId.isValid(datos.id)
    ? await db.collection('usuarios').findOne({ _id: new ObjectId(datos.id) })
    : null;
  if (!usuario) throw new RespuestaError(401, 'La cuenta de este token ya no existe.');
  return json({ usuario: usuarioPublico(usuario) });
}

export default manejar(async (req) => {
  const [, accion, ...resto] = partesRuta(req); // ['auth', 'login']
  const metodo = req.method.toUpperCase();

  if (!resto.length) {
    if (accion === 'registro' && metodo === 'POST') return registro(req);
    if (accion === 'login' && metodo === 'POST') return login(req);
    if (accion === 'yo' && metodo === 'GET') return yo(req);
    if (['registro', 'login', 'yo'].includes(accion)) {
      throw new RespuestaError(405, `El método ${metodo} no está permitido en este recurso.`);
    }
  }
  throw new RespuestaError(404, 'La ruta de autenticación no existe. Disponibles: registro, login, yo.');
});

export const config = {
  path: ['/api/auth', '/api/auth/*'],
};
