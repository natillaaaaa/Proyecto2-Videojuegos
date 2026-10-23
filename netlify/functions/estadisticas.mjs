// Resumen del catálogo: GET /api/estadisticas
import { estadisticas } from '../lib/catalogo.mjs';
import { obtenerDb } from '../lib/db.mjs';
import { manejar, RespuestaError } from '../lib/http.mjs';

export default manejar(async (req) => {
  if (req.method !== 'GET') throw new RespuestaError(405, `El método ${req.method} no está permitido en este recurso.`);
  return estadisticas(await obtenerDb());
});

export const config = {
  path: '/api/estadisticas',
};
