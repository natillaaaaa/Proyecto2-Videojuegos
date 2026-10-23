/**
 * Conexión a MongoDB Atlas.
 *
 * El cliente se guarda fuera del manejador, a nivel de módulo, para que se
 * reutilice entre invocaciones mientras Netlify mantenga caliente la función.
 * Así no se abre una conexión nueva en cada petición.
 *
 * Variables de entorno:
 *   MONGODB_URI  cadena de conexión de Atlas (obligatoria)
 *   MONGODB_DB   nombre de la base de datos (opcional, por defecto "catalogo_videojuegos")
 */
import { MongoClient } from 'mongodb';
import { RespuestaError } from './http.mjs';

let clientePromesa = null;
let dbInyectada = null;

export async function obtenerDb() {
  if (dbInyectada) return dbInyectada;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new RespuestaError(500, 'Falta la variable de entorno MONGODB_URI con la conexión a MongoDB Atlas.');
  }

  if (!clientePromesa) {
    const cliente = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    });
    clientePromesa = cliente.connect().catch((e) => {
      clientePromesa = null; // permite reintentar en la siguiente invocación
      throw e;
    });
  }

  const cliente = await clientePromesa;
  return cliente.db(process.env.MONGODB_DB || 'catalogo_videojuegos');
}

/** Solo para pruebas automáticas: usa otra base de datos en lugar de Atlas. */
export function usarDbDePrueba(db) {
  dbInyectada = db;
}
