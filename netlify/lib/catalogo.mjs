/**
 * =====================================================================
 *  Catálogo de Videojuegos — lógica del servicio REST sobre MongoDB
 * =====================================================================
 *
 *  Cada entidad del Proyecto 1 es ahora una colección:
 *    juegos       (entidad principal)
 *    estudios     (entidad secundaria)
 *    plataformas  (entidad secundaria)
 *
 *  Cada documento conserva su identificador numérico propio `id`, el mismo
 *  del Proyecto 1, y las relaciones se guardan como referencias a ese id:
 *    juegos.estudio_id    -> estudios.id
 *    juegos.plataforma_id -> plataformas.id
 *  Los ids nuevos se generan con la colección `contadores`.
 *
 *  Rutas (iguales al Proyecto 1):
 *    GET    /api/<recurso>          lista (filtros + paginación)
 *    GET    /api/<recurso>/:id      consulta individual
 *    POST   /api/<recurso>          crea (201 + Location)          [requiere sesión]
 *    PUT    /api/<recurso>/:id      reemplaza                      [requiere sesión]
 *    PATCH  /api/<recurso>/:id      modifica campos                [requiere sesión]
 *    DELETE /api/<recurso>/:id      elimina (204)                  [requiere rol admin]
 *    GET    /api/estudios/:id/juegos
 *    GET    /api/plataformas/:id/juegos
 * =====================================================================
 */
import { obtenerDb } from './db.mjs';
import { exigirUsuario, exigirRol } from './auth.mjs';
import {
  RespuestaError, json, sinContenido, leerCuerpo, partesRuta, manejar, ahora,
} from './http.mjs';

/* ------------------------------------------------------------------ */
/*  Definición de las entidades                                        */
/* ------------------------------------------------------------------ */

export const ENTIDADES = {
  juegos: {
    etiqueta: 'juego',
    ordenPorDefecto: 'titulo',
    ordenables: ['id', 'titulo', 'anio', 'calificacion', 'precio', 'creado_en'],
    buscarEn: ['titulo', 'genero', 'descripcion'],
    filtros: ['estudio_id', 'plataforma_id', 'genero', 'anio'],
    campos: {
      titulo:        { tipo: 'texto',   requerido: true,  max: 160 },
      anio:          { tipo: 'entero',  requerido: true,  min: 1958, max: 2100 },
      genero:        { tipo: 'texto',   requerido: true,  max: 80 },
      calificacion:  { tipo: 'entero',  requerido: false, min: 0, max: 100 },
      precio:        { tipo: 'decimal', requerido: false, min: 0, max: 100000 },
      descripcion:   { tipo: 'texto',   requerido: false, max: 2000 },
      imagen:        { tipo: 'texto',   requerido: false, max: 500 },
      estudio_id:    { tipo: 'entero',  requerido: false, referencia: 'estudios' },
      plataforma_id: { tipo: 'entero',  requerido: false, referencia: 'plataformas' },
    },
  },
  estudios: {
    etiqueta: 'estudio',
    ordenPorDefecto: 'nombre',
    ordenables: ['id', 'nombre', 'pais', 'anio_fundacion', 'creado_en'],
    buscarEn: ['nombre', 'pais', 'fundador', 'descripcion'],
    filtros: ['pais'],
    campos: {
      nombre:         { tipo: 'texto',  requerido: true,  max: 160 },
      pais:           { tipo: 'texto',  requerido: true,  max: 80 },
      anio_fundacion: { tipo: 'entero', requerido: true,  min: 1900, max: 2100 },
      fundador:       { tipo: 'texto',  requerido: false, max: 160 },
      sitio_web:      { tipo: 'texto',  requerido: false, max: 300 },
      descripcion:    { tipo: 'texto',  requerido: false, max: 2000 },
      imagen:         { tipo: 'texto',  requerido: false, max: 500 },
    },
  },
  plataformas: {
    etiqueta: 'plataforma',
    ordenPorDefecto: 'nombre',
    ordenables: ['id', 'nombre', 'fabricante', 'anio_lanzamiento', 'unidades_vendidas', 'creado_en'],
    buscarEn: ['nombre', 'fabricante', 'generacion', 'descripcion'],
    filtros: ['fabricante'],
    campos: {
      nombre:            { tipo: 'texto',   requerido: true,  max: 160 },
      fabricante:        { tipo: 'texto',   requerido: true,  max: 120 },
      anio_lanzamiento:  { tipo: 'entero',  requerido: true,  min: 1958, max: 2100 },
      generacion:        { tipo: 'texto',   requerido: false, max: 60 },
      unidades_vendidas: { tipo: 'decimal', requerido: false, min: 0, max: 100000 },
      descripcion:       { tipo: 'texto',   requerido: false, max: 2000 },
      imagen:            { tipo: 'texto',   requerido: false, max: 500 },
    },
  },
};

/** Orden alfabético en español, sin distinguir mayúsculas ni tildes. */
const COLACION = { locale: 'es', strength: 1 };

/** Proyección que oculta el _id interno de MongoDB en las respuestas. */
const SIN_ID_INTERNO = { projection: { _id: 0 } };

/* ------------------------------------------------------------------ */
/*  Validación (misma regla que el Proyecto 1)                         */
/* ------------------------------------------------------------------ */

export function validar(entidad, datos, { parcial }) {
  const definicion = ENTIDADES[entidad].campos;
  const limpio = {};
  const fallos = [];

  for (const [campo, regla] of Object.entries(definicion)) {
    if (!Object.prototype.hasOwnProperty.call(datos, campo)) {
      if (regla.requerido && !parcial) fallos.push(`Falta el campo obligatorio "${campo}".`);
      continue;
    }

    let valor = datos[campo];

    if (valor === null || valor === '') {
      if (regla.requerido) fallos.push(`El campo "${campo}" no puede quedar vacío.`);
      else limpio[campo] = null;
      continue;
    }

    if (regla.tipo === 'texto') {
      valor = String(valor).trim();
      if (!valor && regla.requerido) { fallos.push(`El campo "${campo}" no puede quedar vacío.`); continue; }
      if (regla.max && valor.length > regla.max) {
        fallos.push(`El campo "${campo}" supera los ${regla.max} caracteres.`); continue;
      }
    }

    if (regla.tipo === 'entero' || regla.tipo === 'decimal') {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) { fallos.push(`El campo "${campo}" debe ser numérico.`); continue; }
      valor = regla.tipo === 'entero' ? Math.trunc(numero) : numero;
      if (regla.min !== undefined && valor < regla.min) {
        fallos.push(`El campo "${campo}" no puede ser menor que ${regla.min}.`); continue;
      }
      if (regla.max !== undefined && valor > regla.max) {
        fallos.push(`El campo "${campo}" no puede ser mayor que ${regla.max}.`); continue;
      }
    }

    limpio[campo] = valor;
  }

  if (fallos.length) throw new RespuestaError(422, 'Los datos enviados no son válidos.', fallos);
  if (!Object.keys(limpio).length) throw new RespuestaError(400, 'No se envió ningún campo modificable.');
  return limpio;
}

/** Comprueba que las referencias apunten a documentos existentes. */
async function verificarReferencias(db, entidad, datos) {
  const fallos = [];
  for (const [campo, regla] of Object.entries(ENTIDADES[entidad].campos)) {
    if (!regla.referencia) continue;
    const valor = datos[campo];
    if (valor === undefined || valor === null) continue;
    const existe = await db.collection(regla.referencia).findOne({ id: valor }, { projection: { _id: 1 } });
    if (!existe) fallos.push(`No existe ningún registro de "${regla.referencia}" con id ${valor}.`);
  }
  if (fallos.length) throw new RespuestaError(409, 'Hay referencias que no existen.', fallos);
}

/** Siguiente id numérico de una colección (equivalente al AUTOINCREMENT de SQLite). */
async function siguienteId(db, entidad) {
  const r = await db.collection('contadores').findOneAndUpdate(
    { _id: entidad },
    { $inc: { valor: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return r.valor; // el driver 6 devuelve directamente el documento actualizado
}

/* ------------------------------------------------------------------ */
/*  Formato de salida                                                  */
/* ------------------------------------------------------------------ */

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Agrega a cada juego su estudio y su plataforma (como el LEFT JOIN del Proyecto 1). */
async function conRelaciones(db, juegos) {
  const idsEstudio = [...new Set(juegos.map((j) => j.estudio_id).filter((v) => v != null))];
  const idsPlataforma = [...new Set(juegos.map((j) => j.plataforma_id).filter((v) => v != null))];

  const [estudios, plataformas] = await Promise.all([
    idsEstudio.length
      ? db.collection('estudios').find({ id: { $in: idsEstudio } }, { projection: { _id: 0, id: 1, nombre: 1, pais: 1, imagen: 1 } }).toArray()
      : [],
    idsPlataforma.length
      ? db.collection('plataformas').find({ id: { $in: idsPlataforma } }, { projection: { _id: 0, id: 1, nombre: 1, fabricante: 1, imagen: 1 } }).toArray()
      : [],
  ]);

  const mapaE = new Map(estudios.map((e) => [e.id, e]));
  const mapaP = new Map(plataformas.map((p) => [p.id, p]));

  return juegos.map((j) => ({
    ...j,
    estudio: j.estudio_id != null ? mapaE.get(j.estudio_id) || null : null,
    plataforma: j.plataforma_id != null ? mapaP.get(j.plataforma_id) || null : null,
    _enlaces: {
      self: `/api/juegos/${j.id}`,
      estudio: j.estudio_id != null ? `/api/estudios/${j.estudio_id}` : null,
      plataforma: j.plataforma_id != null ? `/api/plataformas/${j.plataforma_id}` : null,
    },
  }));
}

async function formatear(db, entidad, documentos) {
  if (entidad === 'juegos') return conRelaciones(db, documentos);
  return documentos.map((d) => ({
    ...d,
    _enlaces: { self: `/api/${entidad}/${d.id}`, juegos: `/api/${entidad}/${d.id}/juegos` },
  }));
}

async function formatearUno(db, entidad, documento) {
  return (await formatear(db, entidad, [documento]))[0];
}

/* ------------------------------------------------------------------ */
/*  Operaciones                                                        */
/* ------------------------------------------------------------------ */

async function listar(db, entidad, url) {
  const cfg = ENTIDADES[entidad];
  const p = url.searchParams;
  const filtro = {};

  // Búsqueda de texto libre (equivale al LIKE '%texto%' del Proyecto 1)
  const buscar = (p.get('buscar') || '').trim();
  if (buscar) {
    const patron = { $regex: escaparRegex(buscar), $options: 'i' };
    filtro.$or = cfg.buscarEn.map((c) => ({ [c]: patron }));
  }

  // Filtros por relación y por campo
  for (const campo of cfg.filtros) {
    const valor = p.get(campo);
    if (valor === null || valor === '') continue;
    filtro[campo] = cfg.campos[campo].tipo === 'texto' ? valor : Number(valor);
  }

  // Ordenamiento (solo campos de la lista blanca)
  let ordenar = p.get('ordenar') || cfg.ordenPorDefecto;
  if (!cfg.ordenables.includes(ordenar)) ordenar = cfg.ordenPorDefecto;
  const direccion = (p.get('direccion') || 'asc').toLowerCase() === 'desc' ? -1 : 1;

  // Paginación
  const limite = Math.min(Math.max(parseInt(p.get('limite') || '100', 10) || 100, 1), 200);
  const pagina = Math.max(parseInt(p.get('pagina') || '1', 10) || 1, 1);

  const coleccion = db.collection(entidad);
  const [documentos, total] = await Promise.all([
    coleccion
      .find(filtro, SIN_ID_INTERNO)
      .collation(COLACION)
      .sort({ [ordenar]: direccion, id: 1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .toArray(),
    coleccion.countDocuments(filtro),
  ]);

  return json({
    total,
    pagina,
    limite,
    paginas: Math.max(Math.ceil(total / limite), 1),
    datos: await formatear(db, entidad, documentos),
  });
}

async function obtener(db, entidad, id) {
  const doc = await db.collection(entidad).findOne({ id }, SIN_ID_INTERNO);
  if (!doc) throw new RespuestaError(404, `No existe ningún ${ENTIDADES[entidad].etiqueta} con id ${id}.`);
  return doc;
}

async function crear(db, entidad, req) {
  const cuerpo = await leerCuerpo(req);
  const datos = validar(entidad, cuerpo, { parcial: false });
  await verificarReferencias(db, entidad, datos);

  // Los campos opcionales que no vengan se guardan como null, igual que en SQL.
  for (const [campo, regla] of Object.entries(ENTIDADES[entidad].campos)) {
    if (!regla.requerido && !(campo in datos)) datos[campo] = null;
  }

  const id = await siguienteId(db, entidad);
  await db.collection(entidad).insertOne({ id, ...datos, creado_en: ahora(), actualizado_en: null });

  const doc = await obtener(db, entidad, id);
  return json(await formatearUno(db, entidad, doc), 201, { Location: `/api/${entidad}/${id}` });
}

async function actualizar(db, entidad, id, req, { parcial }) {
  await obtener(db, entidad, id); // 404 si no existe

  const cuerpo = await leerCuerpo(req);
  const datos = validar(entidad, cuerpo, { parcial });
  await verificarReferencias(db, entidad, datos);

  // PUT reemplaza: los campos opcionales que no vengan se vacían.
  if (!parcial) {
    for (const [campo, regla] of Object.entries(ENTIDADES[entidad].campos)) {
      if (!regla.requerido && !(campo in datos)) datos[campo] = null;
    }
  }

  await db.collection(entidad).updateOne({ id }, { $set: { ...datos, actualizado_en: ahora() } });

  const doc = await obtener(db, entidad, id);
  return json(await formatearUno(db, entidad, doc));
}

async function eliminar(db, entidad, id) {
  await obtener(db, entidad, id); // 404 si no existe

  // Al borrar un estudio o una plataforma, sus juegos quedan sin asignar
  // (equivale a ON DELETE SET NULL del Proyecto 1).
  if (entidad === 'estudios') {
    await db.collection('juegos').updateMany({ estudio_id: id }, { $set: { estudio_id: null } });
  }
  if (entidad === 'plataformas') {
    await db.collection('juegos').updateMany({ plataforma_id: id }, { $set: { plataforma_id: null } });
  }

  await db.collection(entidad).deleteOne({ id });
  return sinContenido();
}

async function juegosRelacionados(db, entidad, id) {
  await obtener(db, entidad, id);
  const campo = entidad === 'estudios' ? 'estudio_id' : 'plataforma_id';
  const juegos = await db.collection('juegos')
    .find({ [campo]: id }, SIN_ID_INTERNO)
    .sort({ anio: -1, id: 1 })
    .toArray();
  return json({ total: juegos.length, datos: await conRelaciones(db, juegos) });
}

export async function estadisticas(db) {
  const juegos = db.collection('juegos');
  const [resumen, nEstudios, nPlataformas, nJuegos, generos, top] = await Promise.all([
    juegos.aggregate([
      { $group: { _id: null, media: { $avg: '$calificacion' }, desde: { $min: '$anio' }, hasta: { $max: '$anio' } } },
    ]).toArray(),
    db.collection('estudios').countDocuments(),
    db.collection('plataformas').countDocuments(),
    juegos.countDocuments(),
    juegos.aggregate([
      { $group: { _id: '$genero', n: { $sum: 1 } } },
      { $sort: { n: -1, _id: 1 } },
      { $project: { _id: 0, genero: '$_id', n: 1 } },
    ]).toArray(),
    juegos.find({ calificacion: { $ne: null } }, SIN_ID_INTERNO).sort({ calificacion: -1, id: 1 }).limit(3).toArray(),
  ]);

  const r = resumen[0] || {};
  return json({
    juegos: nJuegos,
    estudios: nEstudios,
    plataformas: nPlataformas,
    calificacion_media: r.media ? Math.round(r.media * 10) / 10 : null,
    rango_anios: { desde: r.desde ?? null, hasta: r.hasta ?? null },
    generos,
    destacados: await conRelaciones(db, top),
  });
}

/* ------------------------------------------------------------------ */
/*  Manejador de una entidad (una función de Netlify por recurso)       */
/* ------------------------------------------------------------------ */

export function manejadorEntidad(entidad) {
  return manejar(async (req) => {
    const url = new URL(req.url);
    const [, idBruto, subrecurso, ...resto] = partesRuta(req);
    const metodo = req.method.toUpperCase();

    if (resto.length) throw new RespuestaError(404, `La ruta ${url.pathname} no existe.`);

    /* ---- Colección: /api/<entidad> ---- */
    if (!idBruto) {
      if (metodo === 'GET') return listar(await obtenerDb(), entidad, url);
      if (metodo === 'POST') {
        exigirUsuario(req);
        return crear(await obtenerDb(), entidad, req);
      }
      throw new RespuestaError(405, `El método ${metodo} no está permitido sobre la colección.`);
    }

    const id = Number(idBruto);
    if (!Number.isInteger(id) || id < 1) throw new RespuestaError(400, `"${idBruto}" no es un identificador válido.`);

    /* ---- Subrecurso: /api/<entidad>/:id/juegos ---- */
    if (subrecurso) {
      if (subrecurso !== 'juegos' || entidad === 'juegos') {
        throw new RespuestaError(404, `La ruta ${url.pathname} no existe.`);
      }
      if (metodo !== 'GET') throw new RespuestaError(405, `El método ${metodo} no está permitido en este recurso.`);
      return juegosRelacionados(await obtenerDb(), entidad, id);
    }

    /* ---- Registro individual ---- */
    switch (metodo) {
      case 'GET': {
        const db = await obtenerDb();
        return json(await formatearUno(db, entidad, await obtener(db, entidad, id)));
      }
      case 'PUT':
        exigirUsuario(req);
        return actualizar(await obtenerDb(), entidad, id, req, { parcial: false });
      case 'PATCH':
        exigirUsuario(req);
        return actualizar(await obtenerDb(), entidad, id, req, { parcial: true });
      case 'DELETE':
        exigirRol(req, 'admin');
        return eliminar(await obtenerDb(), entidad, id);
      default:
        throw new RespuestaError(405, `El método ${metodo} no está permitido sobre este registro.`);
    }
  });
}
