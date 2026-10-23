/* =====================================================================
   Pantallas de inicio de sesión y registro
   ===================================================================== */

/** Solo se permite volver a una ruta del propio sitio. */
function rutaDeVuelta() {
  const volver = parametroUrl('volver') || '/juegos.html';
  return volver.startsWith('/') && !volver.startsWith('//') ? volver : '/juegos.html';
}

function montarAcceso(modo) {
  Vue.createApp({
    data() {
      return {
        nombre: '',
        correo: '',
        contrasena: '',
        confirmacion: '',
        errores: [],
        enviando: false,
        motivo: parametroUrl('motivo'),
        volver: rutaDeVuelta(),
      };
    },

    computed: {
      sufijo() {
        return '?volver=' + encodeURIComponent(this.volver);
      },
    },

    methods: {
      validar() {
        const fallos = [];
        if (modo === 'registro' && this.nombre.trim().length < 2) fallos.push('Escribe tu nombre.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo.trim())) fallos.push('Escribe un correo válido.');
        if (modo === 'registro') {
          if (this.contrasena.length < 8) fallos.push('La contraseña debe tener al menos 8 caracteres.');
          if (this.contrasena !== this.confirmacion) fallos.push('Las contraseñas no coinciden.');
        } else if (!this.contrasena) {
          fallos.push('Escribe tu contraseña.');
        }
        return fallos;
      },

      async enviar() {
        this.errores = this.validar();
        if (this.errores.length) return;

        this.enviando = true;
        try {
          const { token, usuario } = modo === 'registro'
            ? await API.registro(this.nombre.trim(), this.correo.trim(), this.contrasena)
            : await API.login(this.correo.trim(), this.contrasena);

          Sesion.guardar(token, usuario);
          location.href = this.volver;
        } catch (e) {
          this.errores = e.detalles?.length ? e.detalles : [e.message];
        } finally {
          this.enviando = false;
        }
      },
    },

    mounted() {
      // Si ya hay una sesión válida, no tiene sentido mostrar el formulario.
      if (Sesion.estado().autenticado) location.replace(this.volver);
    },
  }).mount('#app');
}
