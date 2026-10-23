#!/usr/bin/env node
/**
 * =====================================================================
 *  Carga en MongoDB Atlas los datos del Proyecto 1
 *  (18 juegos, 6 estudios y 6 plataformas, con sus imágenes).
 *
 *  Uso:
 *    npm run datos
 *
 *  Lee MONGODB_URI (y opcionalmente MONGODB_DB) del archivo .env.
 *  Reemplaza el contenido de las colecciones juegos, estudios y
 *  plataformas; NO toca la colección de usuarios.
 *  También crea los índices y ajusta los contadores de ids.
 * =====================================================================
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datos = JSON.parse(readFileSync(resolve(RAIZ, 'datos/catalogo.json'), 'utf8'));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Falta MONGODB_URI. Crea el archivo .env a partir de .env.example.');
  process.exit(1);
}

const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');
const cliente = new MongoClient(uri);

try {
  await cliente.connect();
  const db = cliente.db(process.env.MONGODB_DB || 'catalogo_videojuegos');
  console.log(`Conectado a la base "${db.databaseName}".`);

  for (const entidad of ['estudios', 'plataformas', 'juegos']) {
    const coleccion = db.collection(entidad);
    await coleccion.deleteMany({});
    const documentos = datos[entidad].map((d) => ({ ...d, creado_en: ahora, actualizado_en: null }));
    await coleccion.insertMany(documentos);
    await coleccion.createIndex({ id: 1 }, { unique: true });

    const maximo = Math.max(...documentos.map((d) => d.id));
    await db.collection('contadores').updateOne({ _id: entidad }, { $set: { valor: maximo } }, { upsert: true });

    console.log(`  ${entidad}: ${documentos.length} documentos (siguiente id: ${maximo + 1})`);
  }

  await db.collection('juegos').createIndex({ estudio_id: 1 });
  await db.collection('juegos').createIndex({ plataforma_id: 1 });
  await db.collection('usuarios').createIndex({ correo: 1 }, { unique: true });

  console.log('Listo. Índices creados (id único, estudio_id, plataforma_id y correo único de usuarios).');
} catch (e) {
  console.error('No se pudieron cargar los datos:', e.message);
  process.exitCode = 1;
} finally {
  await cliente.close();
}
