// Entidad principal: /api/juegos y /api/juegos/:id
import { manejadorEntidad } from '../lib/catalogo.mjs';

export default manejadorEntidad('juegos');

export const config = {
  path: ['/api/juegos', '/api/juegos/*'],
};
