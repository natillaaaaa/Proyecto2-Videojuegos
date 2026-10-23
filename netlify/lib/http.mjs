/**
 * Utilidades HTTP compartidas por todas las funciones de Netlify.
 */

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/** Error con código HTTP que el envoltorio `manejar` convierte en respuesta JSON. */
export class RespuestaError extends Error {
  constructor(estado, mensaje, detalles, cabeceras = {}) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    this.cabeceras = cabeceras;
  }
}

export function json(datos, estado = 200, cabeceras = {}) {
  return new Response(JSON.stringify(datos, null, 2), {
    status: estado,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
      ...cabeceras,
    },
  });
}

export function sinContenido() {
  return new Response(null, { status: 204, headers: CORS });
}

export function error(estado, mensaje, detalles, cabeceras = {}) {
  const cuerpo = { error: true, estado, mensaje };
  if (detalles) cuerpo.detalles = detalles;
  return json(cuerpo, estado, cabeceras);
}

export async function leerCuerpo(req) {
  const tipo = req.headers.get('Content-Type') || '';
  if (!tipo.includes('application/json')) {
    throw new RespuestaError(415, 'El cuerpo debe enviarse como application/json.');
  }
  try {
    const cuerpo = await req.json();
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new Error();
    return cuerpo;
  } catch {
    throw new RespuestaError(400, 'El cuerpo de la petición no es un objeto JSON válido.');
  }
}

/**
 * Partes de la ruta después de /api.
 * '/api/juegos/3/x' -> ['juegos', '3', 'x']
 */
export function partesRuta(req) {
  const partes = new URL(req.url).pathname.split('/').filter(Boolean);
  if (partes[0] === 'api') partes.shift();
  return partes;
}

/** Envuelve un manejador: responde OPTIONS y convierte errores en JSON. */
export function manejar(fn) {
  return async (req, context) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await fn(req, context);
    } catch (e) {
      if (e instanceof RespuestaError) return error(e.estado, e.message, e.detalles, e.cabeceras);
      console.error(e);
      return error(500, 'Error interno del servicio.', [String(e?.message || e)]);
    }
  };
}

/** Fecha en el mismo formato que usaba SQLite en el Proyecto 1: 'AAAA-MM-DD HH:MM:SS' (UTC). */
export function ahora() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
