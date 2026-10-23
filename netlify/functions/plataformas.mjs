// Entidad secundaria: /api/plataformas, /api/plataformas/:id y /api/plataformas/:id/juegos
import { manejadorEntidad } from '../lib/catalogo.mjs';

export default manejadorEntidad('plataformas');

export const config = {
  path: ['/api/plataformas', '/api/plataformas/*'],
};
