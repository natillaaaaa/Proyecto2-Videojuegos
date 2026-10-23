// Índice de la API: GET /api
import { json, manejar } from '../lib/http.mjs';

export default manejar(async () => json({
  servicio: 'Catálogo de Videojuegos',
  version: '2.0.0',
  descripcion: 'API REST sobre Netlify Functions y MongoDB Atlas, con autenticación JWT.',
  autenticacion: {
    registro: 'POST /api/auth/registro  { nombre, correo, contrasena }',
    login: 'POST /api/auth/login  { correo, contrasena }  -> { token, usuario }',
    perfil: 'GET /api/auth/yo  (Authorization: Bearer <token>)',
    reglas: [
      'Listar y consultar: públicos.',
      'Crear y editar (POST, PUT, PATCH): requieren token (401 si falta o expiró).',
      'Borrar (DELETE): requiere rol admin (403 para otros usuarios).',
      'El primer usuario registrado es admin; los siguientes son editor.',
    ],
  },
  recursos: {
    juegos: {
      listar: 'GET /api/juegos?buscar=&genero=&estudio_id=&plataforma_id=&ordenar=&direccion=&pagina=&limite=',
      consultar: 'GET /api/juegos/:id',
      crear: 'POST /api/juegos',
      reemplazar: 'PUT /api/juegos/:id',
      modificar: 'PATCH /api/juegos/:id',
      eliminar: 'DELETE /api/juegos/:id',
    },
    estudios: {
      listar: 'GET /api/estudios',
      consultar: 'GET /api/estudios/:id',
      juegosDelEstudio: 'GET /api/estudios/:id/juegos',
      crear: 'POST /api/estudios',
      reemplazar: 'PUT /api/estudios/:id',
      modificar: 'PATCH /api/estudios/:id',
      eliminar: 'DELETE /api/estudios/:id',
    },
    plataformas: {
      listar: 'GET /api/plataformas',
      consultar: 'GET /api/plataformas/:id',
      juegosDeLaPlataforma: 'GET /api/plataformas/:id/juegos',
      crear: 'POST /api/plataformas',
      reemplazar: 'PUT /api/plataformas/:id',
      modificar: 'PATCH /api/plataformas/:id',
      eliminar: 'DELETE /api/plataformas/:id',
    },
    estadisticas: 'GET /api/estadisticas',
  },
}));

export const config = {
  path: ['/api', '/api/'],
};
