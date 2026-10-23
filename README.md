# Proyecto 2 — Catálogo de videojuegos con MongoDB, Netlify Functions y JWT

**Estudiante:** Nathali Abigail Chacón Murillo

**Sistema publicado:** https://protectovideojuegosdos.netlify.app/juegos

Continuación del Proyecto 1 (mismo tema, mismas entidades y mismos frontends en Vue.js):

- **Juegos** (entidad principal) — 18 documentos
- **Estudios** y **Plataformas** (entidades secundarias) — 6 documentos cada una, con sus imágenes

## Qué cambió respecto al Proyecto 1

| Requisito | Cómo se resolvió |
|---|---|
| FaaS en Netlify | El servicio REST pasó de Cloudflare Workers a funciones de Netlify en `netlify/functions/`, con las mismas rutas `/api/*`. |
| Base de datos MongoDB | Cada entidad es una colección en MongoDB Atlas. Las relaciones se guardan con el id de cada documento (`estudio_id`, `plataforma_id`). Se conserva todo el CRUD. |
| Conexión reutilizada | El cliente de MongoDB se crea una sola vez fuera del manejador (`netlify/lib/db.mjs`). |
| Usuarios | Colección `usuarios` con nombre, correo, contraseña con hash (bcrypt) y rol. |
| JWT | Registro y login devuelven un token firmado con `JWT_SECRETO`, con la identidad del usuario y fecha de expiración. |
| Permisos | Listar y consultar son públicos. Crear y editar requieren sesión (**401** si no hay token o expiró). Borrar requiere rol admin (**403** para los demás). |
| Frontend | Pantallas de login y registro, token en `localStorage` enviado como `Authorization: Bearer`, botones según la sesión, cierre de sesión y redirección al login ante un 401. |

**Roles:** el primer usuario que se registra queda como **admin** (puede crear, editar y borrar). Los siguientes quedan como **editor** (pueden crear y editar, pero no borrar).

## Endpoints

| Método y ruta | Acceso |
|---|---|
| `POST /api/auth/registro` `{ nombre, correo, contrasena }` | Público |
| `POST /api/auth/login` `{ correo, contrasena }` | Público |
| `GET /api/auth/yo` | Con token |
| `GET /api/juegos`, `/api/estudios`, `/api/plataformas` | Público |
| `GET /api/<recurso>/:id`, `/api/estudios/:id/juegos`, `/api/plataformas/:id/juegos`, `/api/estadisticas` | Público |
| `POST /api/<recurso>`, `PUT` y `PATCH /api/<recurso>/:id` | Con token |
| `DELETE /api/<recurso>/:id` | Con token de admin |

---

## Variables de entorno

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas | Sí |
| `JWT_SECRETO` | Clave secreta para firmar y validar los tokens | Sí |
| `MONGODB_DB` | Nombre de la base de datos (por defecto `catalogo_videojuegos`) | No |
| `JWT_EXPIRACION` | Duración del token (por defecto `2h`) | No |

Estas variables **no** están en el código. Se configuran así:

### 1. MongoDB Atlas

1. En https://cloud.mongodb.com crear un clúster gratuito (M0).
2. **Database Access** → *Add New Database User*: crear un usuario y contraseña.
3. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`). Es necesario porque Netlify no tiene una IP fija.
4. **Connect** → *Drivers*: copiar la cadena `mongodb+srv://...` y poner la contraseña del usuario. Esa es `MONGODB_URI`.

### 2. Clave JWT

Generar una clave larga y aleatoria, por ejemplo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ese texto es `JWT_SECRETO`.

### 3. En la computadora (archivo `.env`)

Copiar `.env.example` como `.env` y completar los valores. El archivo `.env` está en `.gitignore` y no se sube a GitHub.

### 4. En Netlify

*Site configuration → Environment variables → Add a variable*: agregar `MONGODB_URI` y `JWT_SECRETO` (y opcionalmente `MONGODB_DB` y `JWT_EXPIRACION`). Luego *Deploys → Trigger deploy*.

---

## Cómo correrlo

Requiere Node.js 20.6 o superior.

```bash
npm install
npm run datos                  # carga en Atlas los 18 juegos, 6 estudios y 6 plataformas
npm install -g netlify-cli     # solo la primera vez
netlify dev                    # http://localhost:8888
```

## Publicar en Netlify

1. Subir el proyecto a un repositorio de GitHub.
2. En Netlify: *Add new site → Import an existing project → GitHub* y elegir el repositorio. La configuración se toma de `netlify.toml` (publica la carpeta `public` y las funciones de `netlify/functions`).
3. Agregar las variables de entorno (paso 4 de arriba) y volver a desplegar.
4. Entrar al sitio, ir a **Iniciar sesión → Regístrate** y crear la primera cuenta (queda como admin).

## Estructura

```
├── netlify/
│   ├── functions/           # una función por recurso
│   │   ├── api.mjs          # GET /api
│   │   ├── auth.mjs         # registro, login, yo
│   │   ├── juegos.mjs
│   │   ├── estudios.mjs
│   │   ├── plataformas.mjs
│   │   └── estadisticas.mjs
│   └── lib/
│       ├── db.mjs           # conexión a Atlas reutilizada
│       ├── auth.mjs         # firma y validación de JWT, roles
│       ├── catalogo.mjs     # CRUD, validación y relaciones
│       └── http.mjs         # respuestas JSON y errores
├── public/                  # frontend en Vue.js
│   ├── login.html, registro.html, js/acceso.js   # nuevas pantallas
│   └── js/comun.js          # sesión, token en cada petición, manejo del 401
├── datos/catalogo.json      # datos del Proyecto 1
├── scripts/cargar-datos.mjs # carga los datos en MongoDB
├── netlify.toml
└── .env.example
```
