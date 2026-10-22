/* =====================================================================
   APLICACIÓN: inicio, ingreso (familias / funcionarios), barra superior,
   video tutorial y cambio de clave.
   ===================================================================== */
var App = (function () {
  'use strict';
  var esc = UI.esc, expirando = false;

  async function iniciar() {
    if (!window.APP_CONFIG.API_URL) S.demo = crearBackendDemo();
    try { S.token = sessionStorage.getItem('fm_token'); } catch (e) { S.token = null; }
    try { S.publico = await UI.api('infoPublica'); }
    catch (e) { S.publico = { config: { nombreColegio: 'Colegio Marina de Chile', anio: '', mensajeBienvenida: '' }, documentos: [], error: e.userMsg || e.message }; }
    if (S.token) {
      try { S.perfil = await UI.api('sesion'); return entrar(); }
      catch (e) { guardarToken(null); }
    }
    login();
  }
  function guardarToken(t) {
    S.token = t;
    try { if (t) sessionStorage.setItem('fm_token', t); else sessionStorage.removeItem('fm_token'); } catch (e) { /* privado */ }
  }

  /* ------------------------------- ingreso ------------------------------- */
  function login(tab) {
    var cfg = S.publico.config;
    var demo = S.demo ? S.demo.ejemploFamilia() : null;
    var pasos = [['🔑', 'Ingrese', 'Con el RUT del estudiante y su fecha de nacimiento.'], ['📝', 'Complete', 'Revise y actualice los datos. Se guardan solos.'],
      ['📚', 'Conozca', 'Lea los documentos institucionales del colegio.'], ['✅', 'Envíe', 'Confirme y envíe la ficha al establecimiento.']];
    UI.$('#app').innerHTML = '<div class="login"><div class="login-wrap">' +
      '<nav class="login-nav"><div class="brand"><img src="assets/insignia.jpg" alt="Insignia Colegio Marina de Chile"><div><b>' + esc(cfg.nombreColegio) + '</b><span>' + esc(cfg.ciudad || 'Concepción') + '</span></div></div>' +
      '<button class="nav-link" id="lg-video">▶ <span class="hide-sm">¿Cómo funciona?</span></button></nav>' +
      '<div class="login-grid"><section class="login-hero">' +
      '<span class="pill"><i></i>Admisión y matrículas ' + esc(cfg.anio) + '</span>' +
      '<h1 class="hero-title">Un futuro que<br>comienza <em>aquí.</em></h1>' +
      '<p class="hero-lead">' + esc(cfg.mensajeBienvenida) + '</p>' +
      '<div class="hero-cta"><button class="btn dark lg" id="lg-ir">Completar la ficha →</button><button class="btn soft lg" id="lg-video2">▶ Ver tutorial</button></div>' +
      '<div class="hero-steps">' + pasos.map(function (p) { return '<div class="hero-step"><div class="ic">' + p[0] + '</div><b>' + p[1] + '</b><span>' + p[2] + '</span></div>'; }).join('') + '</div>' +
      '</section><section class="login-side" id="lg-side"><div class="login-box">' +
      (S.publico.error ? '<div class="demo-banner" style="background:var(--bad-bg);border-color:#f3c4c4;color:var(--bad)">⚠️ ' + esc(S.publico.error) + '</div>' : '') +
      (S.demo ? '<div class="demo-banner">🧪 <b>Modo demostración</b> (los datos quedan solo en este navegador).<br>Familia: RUT <code data-fill="f">' + esc(demo && demo.rut) + '</code> clave <code data-fill="f">' + esc(demo && demo.clave) + '</code><br>' +
        'Gestión: <code data-fill="g">Equipo Gestión Demo</code> clave <code>11111111-1</code> · Docente: <code data-fill="d">Docente Demo</code> clave <code>22222222-2</code> · Asistente: <code data-fill="a">Asistente Demo</code> clave <code>33333333-3</code> · <a href="#" id="demo-reset">Reiniciar demo</a></div>' : '') +
      '<div class="card" style="margin-top:46px"><div class="crest-float"><img src="assets/insignia.jpg" alt=""></div><h2>Ingresar</h2><p class="muted" style="margin:-4px 0 16px">Seleccione su tipo de acceso.</p>' +
      '<div class="tabs" role="tablist"><button class="tab" data-t="familia">👨‍👩‍👧 Familias</button><button class="tab" data-t="staff">🧑‍🏫 Funcionarios</button></div>' +
      '<div id="lg-familia">' +
      '<form id="ff" class="stack" autocomplete="off"><div class="field"><label for="ff-rut">RUT del estudiante</label><input id="ff-rut" inputmode="text" placeholder="12345678-9" required></div>' +
      '<div class="field"><label for="ff-cl">Clave</label><input id="ff-cl" type="password" placeholder="DDMMAAAA" required></div>' +
      '<div class="hint">🔑 La clave inicial es la <b>fecha de nacimiento del estudiante</b> en formato <b>DDMMAAAA</b> (ej.: 15 de marzo de 2019 → <b>15032019</b>). Si la cambió, use su clave nueva.</div>' +
      '<button class="btn dark lg" type="submit">Ingresar</button><p class="small muted" style="margin:0;text-align:center">¿Olvidó su clave? Comuníquese con el establecimiento para restablecerla.</p></form></div>' +
      '<div class="hidden" id="lg-staff">' +
      '<form id="fs" class="stack"><div class="field"><label for="fs-us">Usuario (nombre completo)</label><input id="fs-us" placeholder="Nombre Apellido" required autocomplete="username"></div>' +
      '<div class="field"><label for="fs-cl">Clave</label><input id="fs-cl" type="password" placeholder="Su RUT o su clave personal" required autocomplete="current-password"></div>' +
      '<div class="hint">🔑 La clave inicial es su <b>RUT</b> (con o sin puntos y guion).</div>' +
      '<button class="btn dark lg" type="submit">Ingresar</button><a href="#" id="fs-olv" class="small" style="text-align:center">¿Olvidó su clave?</a></form></div>' +
      '</div><div class="login-foot">Sus datos se guardan de forma segura y solo son vistos por el establecimiento.</div></div></section></div></div></div>';
    function verTab(t) {
      UI.$$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.t === t); });
      UI.$('#lg-familia').classList.toggle('hidden', t !== 'familia');
      UI.$('#lg-staff').classList.toggle('hidden', t !== 'staff');
    }
    verTab(tab || 'familia');
    UI.$('.tabs').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) verTab(b.dataset.t); };
    UI.$('#lg-video').onclick = UI.$('#lg-video2').onclick = function () { tutorial(false); };
    UI.$('#lg-ir').onclick = function () { verTab('familia'); UI.$('#lg-side').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { UI.$('#ff-rut').focus({ preventScroll: true }); }, 400); };
    UI.$('#ff-rut').onblur = function () { if (this.value.trim()) this.value = CoreUtil.rutFmt(this.value); };
    UI.$('#ff').onsubmit = async function (e) {
      e.preventDefault();
      var r = await UI.intentar(function () { return UI.api('loginFamilia', { rut: UI.$('#ff-rut').value, clave: UI.$('#ff-cl').value }); }, 'Ingresando…');
      if (r) { guardarToken(r.token); S.perfil = r.perfil; entrar(); }
    };
    UI.$('#fs').onsubmit = async function (e) {
      e.preventDefault();
      var r = await UI.intentar(function () { return UI.api('loginFuncionario', { usuario: UI.$('#fs-us').value, clave: UI.$('#fs-cl').value }); }, 'Ingresando…');
      if (r) { guardarToken(r.token); S.perfil = r.perfil; entrar(); }
    };
    UI.$('#fs-olv').onclick = function (e) { e.preventDefault(); recuperar(); };
    if (S.demo) {
      UI.$('.demo-banner').onclick = function (e) {
        var c = e.target.closest('[data-fill]');
        if (c && c.dataset.fill === 'f') { verTab('familia'); UI.$('#ff-rut').value = demo.rut; UI.$('#ff-cl').value = demo.clave; }
        else if (c) {
          var m = { g: ['Equipo Gestión Demo', '11111111-1'], d: ['Docente Demo', '22222222-2'], a: ['Asistente Demo', '33333333-3'] }[c.dataset.fill];
          verTab('staff'); UI.$('#fs-us').value = m[0]; UI.$('#fs-cl').value = m[1];
        }
      };
      UI.$('#demo-reset').onclick = function (e) { e.preventDefault(); S.demo.reiniciar(); location.reload(); };
    }
  }

  function recuperar() {
    UI.modal({
      title: '🔑 Recuperar clave de funcionario',
      html: '<p class="muted" style="margin-top:0">Ingrese su usuario y el correo registrado. Recibirá una <b>clave temporal</b> por correo. También puede pedir al Equipo de Gestión que restablezca su clave.</p>' +
        '<div class="stack"><div class="field"><label>Usuario (nombre completo)</label><input id="rc-us"></div><div class="field"><label>Correo registrado</label><input id="rc-em" type="email"></div></div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: 'Enviar clave temporal', onClick: async function (el) {
          try { return await UI.api('recuperarClave', { usuario: el.querySelector('#rc-us').value, email: el.querySelector('#rc-em').value }); }
          catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }]
    }).then(function (msg) { if (msg) UI.success('Solicitud recibida', esc(msg)); });
  }

  async function entrar() {
    UI.loading('Cargando su información…');
    try {
      if (S.perfil.tipo === 'familia') await Familia.iniciar();
      else await Staff.iniciar();
    } catch (e) {
      UI.done();
      await UI.error('No se pudo cargar', e.userMsg || e.message);
      return salir();
    }
    UI.done();
    if (S.perfil.debeCambiarClave) await cambiarClave(true);
    if (!S.perfil.videoVisto) {
      await tutorial(true);
      S.perfil.videoVisto = true;
      UI.api('marcarVideoVisto').catch(function () { /* no crítico */ });
    }
  }

  /* --------------------------- barra superior --------------------------- */
  function topbar(nombre, sub) {
    var cfg = (S.form && S.form.config) || S.publico.config;
    return '<header class="topbar"><img src="assets/insignia.jpg" alt="Insignia"><div><div class="t1">' + esc(cfg.nombreColegio) + '</div><div class="t2">Fichas de Matrícula ' + esc(cfg.anio) + '</div></div>' +
      '<div class="user-chip"><button class="btn ghost sm" data-top="tutorial" title="Ver tutorial">🎬 <span class="hide-sm">Tutorial</span></button>' +
      '<button class="btn ghost sm" data-top="clave" title="Cambiar clave">🔑 <span class="hide-sm">Mi clave</span></button>' +
      '<div class="avatar">' + esc(UI.iniciales(nombre)) + '</div><div><div class="n">' + esc(nombre) + '</div><div class="r">' + esc(sub) + '</div></div>' +
      '<button class="btn ghost sm" data-top="salir">Salir</button></div></header>';
  }
  function enlazarTopbar() {
    UI.$('.topbar').onclick = function (e) {
      var b = e.target.closest('[data-top]'); if (!b) return;
      if (b.dataset.top === 'tutorial') tutorial(false);
      if (b.dataset.top === 'clave') cambiarClave(false);
      if (b.dataset.top === 'salir') salir();
    };
  }
  async function salir() {
    if (S.token) UI.api('logout').catch(function () { /* ya expirada */ });
    guardarToken(null); S.perfil = null; S.form = null;
    login();
  }
  async function sesionExpirada() {
    if (expirando || !S.perfil) return;
    expirando = true;
    guardarToken(null); S.perfil = null;
    await UI.error('Sesión expirada', 'Por seguridad su sesión se cerró. Ingrese nuevamente; los datos guardados se conservan.');
    expirando = false;
    login();
  }

  /* ---------------------------- video tutorial ---------------------------- */
  function embed(url) {
    url = String(url || '').trim();
    if (!url) return '';
    var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return '<div class="video-frame"><iframe src="https://www.youtube.com/embed/' + m[1] + '?rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
    m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (m) return '<div class="video-frame"><iframe src="https://drive.google.com/file/d/' + m[1] + '/preview" allow="autoplay" allowfullscreen></iframe></div>';
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return '<div class="video-frame"><video src="' + esc(url) + '" controls></video></div>';
    return '<div class="video-frame"><iframe src="' + esc(url) + '" allowfullscreen></iframe></div>';
  }
  function tutorial(primeraVez) {
    var cfg = (S.form && S.form.config) || S.publico.config, tipo = S.perfil ? S.perfil.tipo : null;
    var pasos = tipo === 'staff' ? [
      'En <b>Fichas de matrícula</b> verá los estudiantes ordenados por curso y por apellido.',
      'Pinche ✏️ para revisar o editar una ficha. Los cambios se guardan automáticamente.',
      'Presione <b>✅ Registrar matrícula</b>: su nombre y RUT quedarán en el espacio de firma.',
      'Use 🖨 para imprimir, ⬇ para descargar en PDF o 💬 para compartir por WhatsApp.',
      'Si una familia necesita corregir datos, use <b>🔓 Desbloquear para la familia</b>.',
      'En <b>Resumen estadístico</b> verá el avance por curso, nivel y ciclo.'
    ] : [
      'Ingrese con el <b>RUT del estudiante</b> y su <b>fecha de nacimiento</b> (DDMMAAAA) como clave.',
      'Revise y complete los datos de cada sección. Los marcados con <span class="req">*</span> son obligatorios.',
      'Cada cambio se <b>guarda automáticamente</b>: puede salir y volver a entrar cuando quiera.',
      'En <b>📚 Documentos del colegio</b> lea el PEI, el Reglamento Interno y el de Evaluación, y confirme su lectura.',
      'Al terminar presione <b>💾 Guardar y enviar ficha</b>. Luego ya no podrá modificarla sin autorización del colegio.',
      'Puede cambiar su clave en el botón <b>🔑 Mi clave</b>.'
    ];
    return UI.modal({
      title: '🎬 ' + (primeraVez ? '¡Bienvenido/a! Así funciona la plataforma' : 'Cómo funciona la plataforma'), size: 'wide',
      html: (embed(cfg.videoUrl) ? embed(cfg.videoUrl) + '<h4 style="margin:18px 0 10px">Pasos principales</h4>' : '') + '<ol class="steps">' + pasos.map(function (p) { return '<li><div>' + p + '</div></li>'; }).join('') + '</ol>' +
        (primeraVez ? '<p class="small muted" style="margin-bottom:0">Este tutorial se muestra solo la primera vez. Puede volver a verlo cuando quiera con el botón <b>🎬 Tutorial</b>.</p>' : ''),
      buttons: [{ text: primeraVez ? '¡Comenzar!' : 'Cerrar', cls: primeraVez ? 'gold lg' : 'ghost', value: true }],
      noBackdropClose: true
    });
  }

  /* ----------------------------- cambio de clave ----------------------------- */
  function cambiarClave(forzado) {
    var fam = S.perfil.tipo === 'familia';
    return UI.modal({
      title: '🔑 ' + (forzado ? 'Debe crear una clave nueva' : 'Cambiar mi clave'), dismissable: !forzado,
      html: (forzado ? '<div class="hint" style="background:var(--warn-bg);border-left:4px solid var(--warn);padding:10px 12px;border-radius:8px;margin-bottom:14px">El establecimiento solicitó que cree una clave nueva para continuar.</div>' : '') +
        '<div class="stack"><div class="field"><label>Clave actual</label><input id="ck-a" type="password" placeholder="' + (fam ? 'Fecha de nacimiento (DDMMAAAA) o su clave' : 'Su RUT o su clave actual') + '"></div>' +
        '<div class="field"><label>Clave nueva (mínimo 6 caracteres)</label><input id="ck-n" type="password" autocomplete="new-password"></div>' +
        '<div class="field"><label>Repita la clave nueva</label><input id="ck-r" type="password" autocomplete="new-password"></div></div>',
      buttons: (forzado ? [] : [{ text: 'Cancelar', cls: 'ghost', value: null }]).concat([{
        text: 'Guardar clave', cls: 'ok', onClick: async function (el) {
          var n = el.querySelector('#ck-n').value;
          if (n.length < 6) { UI.toast('La clave nueva debe tener al menos 6 caracteres', 'bad'); return false; }
          if (n !== el.querySelector('#ck-r').value) { UI.toast('Las claves nuevas no coinciden', 'bad'); return false; }
          try { await UI.api('cambiarClave', { actual: el.querySelector('#ck-a').value, nueva: n }); return true; }
          catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }])
    }).then(function (ok) {
      if (!ok) return;
      S.perfil.debeCambiarClave = false;
      return UI.success('Clave actualizada', 'Desde ahora ingrese con su clave nueva. Guárdela en un lugar seguro.');
    });
  }

  return { iniciar: iniciar, topbar: topbar, enlazarTopbar: enlazarTopbar, tutorial: tutorial, sesionExpirada: sesionExpirada };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
