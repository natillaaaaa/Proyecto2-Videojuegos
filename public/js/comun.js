/* =====================================================================
   Utilidades compartidas por los tres frontends
   ===================================================================== */

const API_BASE = '/api';

/* ---------------------------------------------------------------- */
/*  Indicador de progreso                                            */
/* ---------------------------------------------------------------- */
const Progreso = {
  activas: 0,
  barra: null,
  inicio() {
    if (!this.barra) {
      this.barra = document.createElement('div');
      this.barra.className = 'progreso';
      document.body.appendChild(this.barra);
    }
    this.activas += 1;
    this.barra.classList.remove('hecho');
    requestAnimationFrame(() => this.barra.classList.add('activo'));
  },
  fin() {
    this.activas = Math.max(0, this.activas - 1);
    if (this.activas === 0 && this.barra) {
      this.barra.classList.remove('activo');
      this.barra.classList.add('hecho');
      setTimeout(() => this.barra && this.barra.classList.remove('hecho'), 400);
    }
  },
};

/* ---------------------------------------------------------------- */
/*  Avisos emergentes                                                */
/* ---------------------------------------------------------------- */
function avisar(mensaje, tipo = 'ok') {
  let contenedor = document.querySelector('.avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'avisos';
    document.body.appendChild(contenedor);
  }

  const aviso = document.createElement('div');
  aviso.className = 'aviso' + (tipo === 'error' ? ' aviso--error' : '');
  aviso.setAttribute('role', 'status');
  aviso.innerHTML = '<span class="aviso__punto"></span><span></span>';
  aviso.lastElementChild.textContent = mensaje;
  contenedor.appendChild(aviso);

  setTimeout(() => {
    aviso.classList.add('saliendo');
    setTimeout(() => aviso.remove(), 320);
  }, 3600);
}

/* ---------------------------------------------------------------- */
/*  Sesión: el JWT se guarda en localStorage                          */
/* ---------------------------------------------------------------- */
const Sesion = {
  CLAVE_TOKEN: 'vj_token',
  CLAVE_USUARIO: 'vj_usuario',

  token() {
    try { return localStorage.getItem(this.CLAVE_TOKEN); } catch { return null; }
  },

  usuario() {
    try { return JSON.parse(localStorage.getItem(this.CLAVE_USUARIO) || 'null'); } catch { return null; }
  },

  guardar(token, usuario) {
    try {
      localStorage.setItem(this.CLAVE_TOKEN, token);
      localStorage.setItem(this.CLAVE_USUARIO, JSON.stringify(usuario));
    } catch { /* almacenamiento no disponible */ }
  },

  cerrar() {
    try {
      localStorage.removeItem(this.CLAVE_TOKEN);
      localStorage.removeItem(this.CLAVE_USUARIO);
    } catch { /* nada que borrar */ }
  },

  /** Lee el campo exp del token (sin verificar la firma; eso lo hace el servidor). */
  expirado() {
    const token = this.token();
    if (!token) return true;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(base64));
      return !exp || exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  },

  /** Estado que usan las páginas para mostrar u ocultar acciones. */
  estado() {
    const usuario = this.usuario();
    const autenticado = Boolean(usuario && this.token() && !this.expirado());
    return {
      autenticado,
      usuario: autenticado ? usuario : null,
      esAdmin: autenticado && usuario.rol === 'admin',
    };
  },

  /** Lleva al inicio de sesión y vuelve a la página actual después. */
  irAlLogin(motivo) {
    const volver = location.pathname + location.search;
    const q = new URLSearchParams({ volver });
    if (motivo) q.set('motivo', motivo);
    location.href = '/login.html?' + q.toString();
  },
};

// Un token vencido se descarta al cargar cualquier página.
if (Sesion.token() && Sesion.expirado()) Sesion.cerrar();

/* ---------------------------------------------------------------- */
/*  Cliente de la API REST                                           */
/* ---------------------------------------------------------------- */
class ErrorApi extends Error {
  constructor(mensaje, estado, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles || [];
  }
}

/**
 * @param {string} ruta
 * @param {object} opciones  method, cuerpo, y `publica: true` para login/registro
 *                           (un 401 ahí no significa sesión expirada).
 */
async function peticion(ruta, opciones = {}) {
  Progreso.inicio();
  try {
    const cabeceras = {};
    if (opciones.cuerpo) cabeceras['Content-Type'] = 'application/json';

    // El token se adjunta automáticamente a todas las peticiones.
    const token = Sesion.token();
    if (token && !opciones.publica) cabeceras.Authorization = `Bearer ${token}`;

    const respuesta = await fetch(API_BASE + ruta, {
      method: opciones.method || 'GET',
      headers: cabeceras,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });

    if (respuesta.status === 204) return null;

    const datos = await respuesta.json().catch(() => null);

    // 401: no hay sesión o el token expiró -> al inicio de sesión.
    if (respuesta.status === 401 && !opciones.publica) {
      const habiaSesion = Boolean(token);
      Sesion.cerrar();
      Sesion.irAlLogin(habiaSesion ? 'expirada' : 'requerida');
    }

    if (!respuesta.ok) {
      throw new ErrorApi(
        datos?.mensaje || `El servicio respondió con el código ${respuesta.status}.`,
        respuesta.status,
        datos?.detalles
      );
    }
    return datos;
  } catch (e) {
    if (e instanceof ErrorApi) throw e;
    throw new ErrorApi('No se pudo contactar con el servicio. Revisa tu conexión.', 0);
  } finally {
    Progreso.fin();
  }
}

const API = {
  listar: (entidad, params = {}) => {
    const q = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== '' && valor !== null && valor !== undefined) q.set(clave, valor);
    }
    const cadena = q.toString();
    return peticion(`/${entidad}${cadena ? '?' + cadena : ''}`);
  },
  obtener:    (entidad, id) => peticion(`/${entidad}/${id}`),
  juegosDe:   (entidad, id) => peticion(`/${entidad}/${id}/juegos`),
  crear:      (entidad, cuerpo) => peticion(`/${entidad}`, { method: 'POST', cuerpo }),
  reemplazar: (entidad, id, cuerpo) => peticion(`/${entidad}/${id}`, { method: 'PUT', cuerpo }),
  modificar:  (entidad, id, cuerpo) => peticion(`/${entidad}/${id}`, { method: 'PATCH', cuerpo }),
  eliminar:   (entidad, id) => peticion(`/${entidad}/${id}`, { method: 'DELETE' }),
  estadisticas: () => peticion('/estadisticas'),

  login:    (correo, contrasena) =>
    peticion('/auth/login', { method: 'POST', cuerpo: { correo, contrasena }, publica: true }),
  registro: (nombre, correo, contrasena) =>
    peticion('/auth/registro', { method: 'POST', cuerpo: { nombre, correo, contrasena }, publica: true }),
};

/* ---------------------------------------------------------------- */
/*  Ayudas de formato                                                */
/* ---------------------------------------------------------------- */
const Formato = {
  precio: (v) => (v === null || v === undefined || v === '' ? '—' : `$${Number(v).toFixed(2)}`),
  numero: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CR')),
  millones: (v) => (!v ? '—' : `${Number(v).toLocaleString('es-CR')} M`),
  fecha: (v) => {
    if (!v) return '—';
    const d = new Date(v.replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  texto: (v) => (v === null || v === undefined || v === '' ? '—' : v),
};

/** Retrasa la ejecución mientras el usuario sigue escribiendo. */
function retardar(fn, ms = 320) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
}

/** Lee un parámetro de la barra de direcciones. */
function parametroUrl(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

/* ---------------------------------------------------------------- */
/*  Cabecera: menú móvil y marcado de la sección activa              */
/* ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const boton = document.querySelector('.menu-boton');
  const nav = document.querySelector('.nav');
  if (boton && nav) {
    boton.addEventListener('click', () => nav.classList.toggle('abierto'));
  }

  const actual = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((enlace) => {
    if (enlace.getAttribute('href') === actual) enlace.classList.add('activo');
  });

  pintarSesion(nav);
});

/** Agrega al menú el usuario conectado y el botón Salir, o el enlace para entrar. */
function pintarSesion(nav) {
  if (!nav) return;
  const { autenticado, usuario } = Sesion.estado();
  const zona = document.createElement('div');
  zona.className = 'nav__sesion';

  if (autenticado) {
    const nombre = document.createElement('span');
    nombre.className = 'nav__usuario';
    nombre.textContent = usuario.nombre;
    nombre.title = `${usuario.correo} · rol ${usuario.rol}`;

    const rol = document.createElement('span');
    rol.className = 'insignia' + (usuario.rol === 'admin' ? '' : ' insignia--neutra');
    rol.textContent = usuario.rol;

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'boton boton--fantasma boton--pequeno';
    salir.textContent = 'Salir';
    salir.addEventListener('click', () => {
      Sesion.cerrar();
      location.reload();
    });

    zona.append(nombre, rol, salir);
  } else {
    const entrar = document.createElement('a');
    entrar.className = 'boton boton--pequeno';
    entrar.href = '/login.html?volver=' + encodeURIComponent(location.pathname + location.search);
    entrar.textContent = 'Iniciar sesión';
    if (/login|registro/.test(location.pathname)) return; // no hace falta en esas pantallas
    zona.append(entrar);
  }

  nav.appendChild(zona);
}

/** Sustituye una imagen rota por un panel con la inicial del título. */
function imagenAlterna(evento, titulo = '?') {
  const img = evento.target;
  if (img.dataset.alterna) return;
  img.dataset.alterna = '1';
  const inicial = String(titulo).trim().charAt(0).toUpperCase() || '?';
  img.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
         <rect width="300" height="400" fill="#0a0d0a"/>
         <text x="150" y="230" text-anchor="middle" font-family="sans-serif"
               font-size="150" font-weight="800" fill="#76b900" opacity="0.5">${inicial}</text>
       </svg>`
    );
}
