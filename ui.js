/* =====================================================================
   UI: conexión con el servidor, modales, avisos y formularios dinámicos
   ===================================================================== */
window.S = { token: null, perfil: null, form: null, demo: null };

var UI = (function () {
  'use strict';
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function si(v) { v = String(v || '').toUpperCase(); return v === 'SI' || v === 'SÍ' || v === 'TRUE' || v === true; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }

  /* ---------------- servidor ---------------- */
  async function api(action, payload) {
    var res;
    if (!window.APP_CONFIG.API_URL) {
      await sleep(150);
      res = S.demo.llamar(action, payload, S.token);
    } else {
      var r;
      try {
        r = await fetch(window.APP_CONFIG.API_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: action, payload: payload || {}, token: S.token })
        });
        res = await r.json();
      } catch (e) {
        var err = new Error('No fue posible conectarse con el servidor. Revise su conexión a internet e intente nuevamente.');
        err.userMsg = err.message; err.red = true; throw err;
      }
    }
    if (!res.ok) {
      if (res.auth === false && window.App) App.sesionExpirada();
      var e2 = new Error(res.error); e2.userMsg = res.error; throw e2;
    }
    return res.data;
  }

  /* ---------------- cargando / avisos ---------------- */
  var cargas = 0;
  function loading(txt) { cargas++; $('#loading-text').textContent = txt || 'Cargando…'; $('#loading').classList.remove('hidden'); }
  function done() { cargas = Math.max(0, cargas - 1); if (!cargas) $('#loading').classList.add('hidden'); }
  function toast(msg, tipo) {
    var t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.textContent = msg;
    $('#toast-root').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3800);
  }

  /* ---------------- modales ---------------- */
  var ICONOS = { success: '✓', error: '!', warning: '⚠', info: 'ℹ', question: '?' };
  function modal(o) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'overlay';
      var botones = o.buttons || [{ text: 'Entendido', value: true }];
      var icono = o.iconHtml || (o.icon ? '<div class="m-icon ' + o.icon + '">' + (ICONOS[o.icon] || '') + '</div>' : '');
      var cab = o.center ? '' : '<div class="modal-h"><h3>' + (o.title || '') + '</h3>' + (o.dismissable === false ? '' : '<button class="icon-btn" data-x aria-label="Cerrar">✕</button>') + '</div>';
      ov.innerHTML = '<div class="modal ' + (o.size || '') + (o.center ? ' center' : '') + '" role="dialog" aria-modal="true">' + cab +
        '<div class="modal-b">' + icono + (o.center && o.title ? '<h2 class="m-title">' + o.title + '</h2>' : '') + (o.html || '') + '</div>' +
        (botones.length ? '<div class="modal-f">' + botones.map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" data-i="' + i + '">' + b.text + '</button>'; }).join('') + '</div>' : '') +
        '</div>';
      $('#modal-root').appendChild(ov);
      var el = ov.querySelector('.modal');
      function cerrar(v) { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape' && o.dismissable !== false && ov === $('#modal-root').lastElementChild) cerrar(null); }
      document.addEventListener('keydown', onKey);
      ov.addEventListener('click', async function (e) {
        if (e.target === ov && o.dismissable !== false && !o.noBackdropClose) return cerrar(null);
        if (e.target.closest('[data-x]')) return cerrar(null);
        var b = e.target.closest('[data-i]');
        if (!b) return;
        var def = botones[+b.dataset.i];
        if (def.onClick) {
          b.disabled = true;
          var r;
          try { r = await def.onClick(el); } finally { b.disabled = false; }
          if (r === false) return;
          return cerrar(r === undefined ? def.value : r);
        }
        cerrar(def.value);
      });
      el.cerrar = cerrar;
      if (o.onOpen) o.onOpen(el, cerrar);
      var foco = el.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
      if (foco && !o.center) setTimeout(function () { foco.focus(); }, 60);
    });
  }
  function success(titulo, msg, extra) {
    return modal({
      center: true, title: titulo, size: extra && extra.size,
      iconHtml: '<div class="m-icon success"><svg class="checkmark" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-16"/></svg></div>',
      html: '<p class="muted" style="font-size:15.5px">' + (msg || '') + '</p>',
      buttons: [{ text: (extra && extra.boton) || 'Entendido', cls: 'ok lg', value: true }]
    });
  }
  function error(titulo, msg) {
    return modal({ center: true, icon: 'error', title: titulo || 'No se pudo completar', html: '<p class="muted" style="font-size:15px">' + esc(msg) + '</p>', buttons: [{ text: 'Entendido', cls: 'bad', value: true }] });
  }
  function info(titulo, msg) { return modal({ center: true, icon: 'info', title: titulo, html: '<p class="muted" style="font-size:15px">' + msg + '</p>' }); }
  function confirm(titulo, msg, ok, cls, icon) {
    return modal({ center: true, icon: icon || 'question', title: titulo, html: '<p class="muted" style="font-size:15px">' + msg + '</p>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: false }, { text: ok || 'Confirmar', cls: cls || '', value: true }] });
  }
  async function intentar(fn, txt) {
    loading(txt);
    try { var r = await fn(); done(); return r; }
    catch (e) { done(); await error('No se pudo completar', e.userMsg || e.message); return undefined; }
  }

  /* Popup centrado con los datos que faltan; al pinchar uno, lleva al dato. */
  function faltantes(lista, irA, titulo) {
    var html = '<p class="muted" style="font-size:15px">Para guardar la ficha debe completar o corregir <b>' + lista.length + '</b> dato' + (lista.length > 1 ? 's' : '') +
      '. Pinche cada uno para ir directamente:</p><div class="missing-list">' +
      lista.map(function (f, i) {
        return '<button class="missing-item" data-go="' + i + '"><span>⚠️</span><span>' + esc(f.etiqueta) + '<small>' + esc(f.seccion || '') + '</small></span><span class="go">Ir ›</span></button>';
      }).join('') + '</div>';
    return modal({
      center: true, icon: 'warning', title: titulo || 'Faltan datos obligatorios', html: html,
      buttons: [{ text: 'Completar ahora', cls: 'gold', value: 0 }],
      onOpen: function (el, cerrar) {
        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-go]');
          if (b) { cerrar(null); irA(lista[+b.dataset.go]); }
        });
      }
    }).then(function (v) { if (v === 0 && lista.length) irA(lista[0]); });
  }
  function resaltar(id) {
    var w = document.querySelector('[data-wrap="' + CSS.escape(id) + '"]');
    if (!w) return;
    w.scrollIntoView({ behavior: 'smooth', block: 'center' });
    w.classList.remove('focus-hint', 'shake');
    void w.offsetWidth;
    w.classList.add('focus-hint', 'shake');
    setTimeout(function () { var i = w.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'); if (i) i.focus({ preventScroll: true }); }, 450);
    setTimeout(function () { w.classList.remove('focus-hint', 'shake'); }, 2200);
  }

  /* ---------------- formularios dinámicos ---------------- */
  function aISO(v) {
    v = String(v || '').trim();
    var m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return v.slice(0, 10);
  }
  function fechaLarga(v) {
    var iso = aISO(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return v || '';
    var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
  }
  function secciones(campos) {
    var orden = [], map = {};
    campos.forEach(function (c) {
      var s = c.seccion || 'Otros antecedentes';
      if (!map[s]) { map[s] = []; orden.push(s); }
      map[s].push(c);
    });
    return orden.map(function (s) { return { nombre: s, campos: map[s] }; });
  }
  function tituloSeccion(s, i) {
    var m = s.match(/^(\d+)[.)]\s*(.*)$/);
    return m ? { num: m[1], txt: m[2] } : { num: String(i + 1), txt: s };
  }
  function campoHtml(c, v, editable) {
    var id = 'f_' + c.id, dis = editable ? '' : ' disabled', req = si(c.obligatorio) ? '<span class="req" title="Obligatorio">*</span>' : '';
    var full = c.tipo === 'parrafo' || String(c.etiqueta).length > 60 ? ' full' : '', inp;
    var base = ' id="' + id + '" data-field="' + esc(c.id) + '"' + dis;
    v = v === undefined || v === null ? '' : String(v);
    switch (c.tipo) {
      case 'parrafo': inp = '<textarea' + base + ' rows="2">' + esc(v) + '</textarea>'; break;
      case 'numero': inp = '<input type="number" inputmode="numeric"' + base + ' value="' + esc(v) + '">'; break;
      case 'fecha': inp = '<input type="date"' + base + ' value="' + esc(aISO(v)) + '">'; break;
      case 'email': inp = '<input type="email" autocomplete="email"' + base + ' value="' + esc(v) + '" placeholder="nombre@correo.cl">'; break;
      case 'telefono': inp = '<input type="tel" inputmode="tel"' + base + ' value="' + esc(v) + '" placeholder="9 1234 5678">'; break;
      case 'rut': inp = '<input type="text" data-rut' + base + ' value="' + esc(v) + '" placeholder="12345678-9" maxlength="12">'; break;
      case 'lista':
        var ops = String(c.opciones || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        if (v && ops.indexOf(v) < 0) ops.unshift(v);
        inp = '<select' + base + '><option value="">Seleccione…</option>' + ops.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
        break;
      case 'si_no':
        inp = '<div class="radios">' + ['Sí', 'No'].map(function (o) {
          return '<label><input type="radio" name="' + id + '" data-field="' + esc(c.id) + '" value="' + o + '"' + (v === o ? ' checked' : '') + dis + '> ' + o + '</label>';
        }).join('') + '</div>';
        break;
      default: inp = '<input type="text"' + base + ' value="' + esc(v) + '">';
    }
    return '<div class="field' + full + '" data-wrap="' + esc(c.id) + '"><label for="' + id + '">' + esc(c.etiqueta) + req + '</label>' + inp +
      (c.ayuda ? '<small class="help">' + esc(c.ayuda) + '</small>' : '') + '<div class="err-msg">Complete o corrija este dato</div></div>';
  }
  function formHtml(campos, datos, editable) {
    return secciones(campos).map(function (s, i) {
      var t = tituloSeccion(s.nombre, i);
      return '<section class="card form-sec"><div class="card-h"><div class="sec-num">' + esc(t.num) + '</div><h3>' + esc(t.txt) + '</h3></div><div class="grid">' +
        s.campos.map(function (c) { return campoHtml(c, datos[c.id], editable(c)); }).join('') + '</div></section>';
    }).join('');
  }
  function leer(root) {
    var o = {};
    $$('[data-field]', root).forEach(function (el) {
      var k = el.dataset.field;
      if (el.type === 'radio') { if (!(k in o)) o[k] = ''; if (el.checked) o[k] = el.value; }
      else o[k] = String(el.value || '').trim();
    });
    return o;
  }
  function enlazar(root, onChange) {
    root.addEventListener('input', function (e) {
      var el = e.target.closest('[data-field]'); if (!el) return;
      var w = el.closest('.field'); if (w) w.classList.remove('error');
      if (el.type !== 'radio' && el.tagName !== 'SELECT') onChange(el.dataset.field);
    });
    root.addEventListener('change', function (e) {
      var el = e.target.closest('[data-field]'); if (!el) return;
      if (el.hasAttribute('data-rut') && el.value.trim()) {
        el.value = CoreUtil.rutFmt(el.value);
        if (!CoreUtil.rutValido(el.value)) { el.closest('.field').classList.add('error'); toast('El RUT ingresado no es válido', 'bad'); }
      }
      onChange(el.dataset.field);
    });
  }
  function validar(campos, datos, soloFamilia) {
    var out = [];
    campos.forEach(function (c) {
      if (soloFamilia && !si(c.editableFamilia)) return;
      var v = String(datos[c.id] || '').trim();
      if (!v) { if (si(c.obligatorio)) out.push({ id: c.id, etiqueta: c.etiqueta, seccion: c.seccion }); return; }
      if (c.tipo === 'rut' && !CoreUtil.rutValido(v)) out.push({ id: c.id, etiqueta: c.etiqueta + ' (RUT no válido)', seccion: c.seccion });
      if (c.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) out.push({ id: c.id, etiqueta: c.etiqueta + ' (correo no válido)', seccion: c.seccion });
    });
    return out;
  }
  function marcarErrores(root, lista) {
    $$('.field.error', root).forEach(function (w) { w.classList.remove('error'); });
    lista.forEach(function (f) { var w = root.querySelector('[data-wrap="' + CSS.escape(f.id) + '"]'); if (w) w.classList.add('error'); });
  }

  /* ---------------- otros ---------------- */
  function iniciales(n) { return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase(); }
  function nombreEst(f) { return [f.est_apellido_paterno, f.est_apellido_materno].filter(Boolean).join(' ') + ', ' + (f.est_nombres || ''); }
  function nombreApo(f) { return [f.apo_nombres, f.apo_apellido_paterno, f.apo_apellido_materno].filter(Boolean).join(' '); }
  function badgeEstado(e) { e = e || 'pendiente'; var n = (S.form && S.form.estados && S.form.estados[e]) || e; return '<span class="badge b-' + esc(e) + '">' + esc(n) + '</span>'; }
  function archivoBase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function leerExcel(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        try { res(XLSX.read(new Uint8Array(r.result), { type: 'array' })); } catch (e) { rej(e); }
      };
      r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
  }

  return {
    esc: esc, $: $, $$: $$, si: si, sleep: sleep, debounce: debounce, api: api, loading: loading, done: done, toast: toast,
    modal: modal, success: success, error: error, info: info, confirm: confirm, intentar: intentar, faltantes: faltantes, resaltar: resaltar,
    formHtml: formHtml, leer: leer, enlazar: enlazar, validar: validar, marcarErrores: marcarErrores, secciones: secciones,
    aISO: aISO, fechaLarga: fechaLarga, iniciales: iniciales, nombreEst: nombreEst, nombreApo: nombreApo, badgeEstado: badgeEstado,
    archivoBase64: archivoBase64, leerExcel: leerExcel
  };
})();
