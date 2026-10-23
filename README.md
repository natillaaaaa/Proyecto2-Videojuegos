# Proyecto 2 — Catálogo de videojuegos

**Estudiante:** Nathali Chacón

## Enlaces

- **Sitio:** https://protectovideojuegosdos.netlify.app/juegos
- **API:** https://protectovideojuegosdos.netlify.app/api/juegos

## Qué hace

Catálogo de videojuegos con tres entidades: juegos (principal), estudios y plataformas.

- El servicio REST corre en **Netlify Functions** (carpeta `netlify/functions`).
- Los datos están en **MongoDB Atlas**.
- Tiene registro e inicio de sesión con **JWT**:
  - Ver el catálogo es público.
  - Crear y editar requiere iniciar sesión.
  - Borrar solo lo puede hacer el admin (el primer usuario registrado).

## Variables de entorno

Se configuran en Netlify, en **Environment variables**, y en local en un archivo `.env` (ver `.env.example`):

| Variable | Valor |
|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas (`mongodb+srv://...`) |
| `JWT_SECRETO` | Clave secreta para firmar los tokens |

En Atlas se debe permitir el acceso desde `0.0.0.0/0` (**Network Access**) para que Netlify pueda conectarse.

## Cómo correrlo

```bash
npm install
npm run datos     # carga los datos en MongoDB
netlify dev       # http://localhost:8888
```
