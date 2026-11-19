(function () {
  'use strict';

  var CLAVE = 'sgsu-lateral-oculto';
  var html = document.documentElement;
  var ancho = function () { return window.matchMedia('(max-width: 1024px)').matches; };

  function guardar(oculto) {
    try { localStorage.setItem(CLAVE, oculto ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
  }

  function oculto() { return html.classList.contains('lateral-oculto'); }

  function alternar() {
    var ahoraOculto = html.classList.toggle('lateral-oculto');
    guardar(ahoraOculto);
    return ahoraOculto;
  }

  function cerrar() {
    if (!oculto()) { html.classList.add('lateral-oculto'); guardar(true); }
  }

  // Menu lateral (coherente con el script anti-parpadeo de head.ejs)
  var botonLateral = document.getElementById('boton-lateral');
  if (botonLateral) {
    botonLateral.addEventListener('click', function (ev) {
      ev.stopPropagation();
      alternar();
    });
  }
  if (!html.classList.contains('lateral-oculto') && ancho()) {
    html.classList.add('lateral-oculto');
    guardar(true);
  }

  // Dropdown del usuario
  var botonUsuario = document.getElementById('boton-usuario');
  var dropdown = document.getElementById('dropdown-usuario');
  if (botonUsuario && dropdown) {
    botonUsuario.addEventListener('click', function (ev) {
      ev.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });
  }

  // Clic fuera: cierra dropdown y (en pantallas chicas) el menu lateral
  document.addEventListener('click', function (ev) {
    if (dropdown && !dropdown.hidden && !dropdown.contains(ev.target)) {
      dropdown.hidden = true;
    }
    if (botonLateral && ancho() && !oculto()) {
      var lateral = document.getElementById('lateral');
      if (lateral && !lateral.contains(ev.target) && ev.target !== botonLateral) cerrar();
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (dropdown && !dropdown.hidden) dropdown.hidden = true;
    if (ancho()) cerrar();
    document.querySelectorAll('.detalle-edicion[open]').forEach(function (d) { d.open = false; });
  });

  // Modales de edicion (details con capa fija sobre la pagina)
  document.querySelectorAll('.detalle-edicion').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) {
        document.body.classList.add('edicion-abierto');
        var primero = d.querySelector('.edicion-caja input:not([type="hidden"]), .edicion-caja select');
        if (primero) setTimeout(function () { primero.focus(); }, 80);
      } else if (!document.querySelector('.detalle-edicion[open]')) {
        document.body.classList.remove('edicion-abierto');
      }
    });
    d.addEventListener('click', function (ev) {
      if (ev.target.closest('.edicion-cerrar, [data-edicion-cancelar]') || ev.target.classList.contains('edicion-capa')) {
        d.open = false;
      }
    });
  });

  // Mostrar/ocultar contrasena en el login
  var botonOjo = document.getElementById('boton-ojo');
  var clave = document.getElementById('clave');
  if (botonOjo && clave) {
    botonOjo.addEventListener('click', function () {
      var visible = clave.type === 'text';
      clave.type = visible ? 'password' : 'text';
      botonOjo.classList.toggle('activo', !visible);
    });
  }

  // Buscador de la tabla del panel principal
  var campo = document.getElementById('buscar-tabla');
  if (campo) {
    campo.addEventListener('input', function () {
      var q = campo.value.trim().toLowerCase();
      var tabla = document.querySelector('.tabla');
      if (!tabla || !tabla.tBodies.length) return;
      var filas = tabla.tBodies[0].rows;
      for (var i = 0; i < filas.length; i++) {
        var texto = filas[i].textContent.toLowerCase();
        filas[i].hidden = q !== '' && texto.indexOf(q) === -1;
      }
    });
  }
})();
