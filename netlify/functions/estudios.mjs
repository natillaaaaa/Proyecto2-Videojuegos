// Entidad secundaria: /api/estudios, /api/estudios/:id y /api/estudios/:id/juegos
import { manejadorEntidad } from '../lib/catalogo.mjs';

export default manejadorEntidad('estudios');

export const config = {
  path: ['/api/estudios', '/api/estudios/*'],
};
