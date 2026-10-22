/* =====================================================================
   ACCESO FAMILIAS: completar/modificar datos, leer documentos, enviar.
   Guarda automáticamente cada cambio; al enviar, la ficha queda bloqueada.
   ===================================================================== */
var Familia = (function () {
  'use strict';
  var esc = UI.esc, F = null, pend = {}, pendAcc = {}, guardando = false, tab = 'ficha';

  function actualizando() { return !!String(F.editFamilia || '').trim() && (F.estado === 'enviada' || F.estado === 'matriculada'); }
  function pedidos() { var e = actualizando() ? String(F.editFamilia).trim() : ''; return e && e !== 'TODOS' ? e.split(',') : null; }
  function bloqueada() {
    if (F.estado === 'retirado') return true;
    if (actualizando()) return false;
    return ['enviada', 'matriculada'].indexOf(F.estado) >= 0;
  }
  function editable(c) { var p = pedidos(); return UI.si(c.editableFamilia) && !bloqueada() && (!p || p.indexOf(c.id) >= 0); }
  function camposFam() { return S.form.campos.filter(function (c) { return UI.si(c.editableFamilia); }); }
  function docsReq() { return S.form.documentos.filter(function (d) { return UI.si(d.requiereAceptacion); }); }
  function nombre() { return [F.est_nombres, F.est_apellido_paterno, F.est_apellido_materno].filter(Boolean).join(' '); }

  async function iniciar() {
    var r = await Promise.all([UI.api('formulario'), UI.api('miFicha')]);
    S.form = r[0]; F = r[1]; pend = {}; pendAcc = {};
    render();
  }

  function progreso() {
    var req = camposFam().filter(function (c) { return UI.si(c.obligatorio); }), docs = docsReq();
    var total = req.length + docs.length, ok = 0;
    req.forEach(function (c) { if (String(F[c.id] || '').trim()) ok++; });
    docs.forEach(function (d) { if ((F.aceptaciones || {})[d.id]) ok++; });
    return total ? Math.round(ok * 100 / total) : 100;
  }
  function pintarProgreso() {
    var p = progreso(), ring = UI.$('#ring');
    if (ring) { ring.style.setProperty('--p', p); ring.querySelector('span').textContent = p + '%'; }
    var leidos = docsReq().filter(function (d) { return (F.aceptaciones || {})[d.id]; }).length;
    var t = UI.$('#cnt-docs'); if (t) t.textContent = leidos + '/' + docsReq().length;
  }

  function render() {
    var cfg = S.form.config, lock = bloqueada(), act = actualizando(), ped = pedidos();
    var nombresPedidos = ped ? S.form.campos.filter(function (c) { return ped.indexOf(c.id) >= 0; }).map(function (c) {
      var repetida = S.form.campos.filter(function (x) { return x.etiqueta === c.etiqueta; }).length > 1;
      return c.etiqueta + (repetida ? ' (' + c.seccion.replace(/^\d+[.)]\s*/, '') + ')' : '');
    }) : null;
    var html = App.topbar(nombre(), 'Apoderado/a · ' + F.curso) +
      '<div class="wrap">' +
      '<section class="card welcome"><div class="ring" id="ring" style="--p:0"><span>0%</span></div><div class="grow" style="position:relative;z-index:1">' +
      '<div class="eyebrow">Ficha de matrícula ' + esc(cfg.anio) + '</div>' +
      '<h2>' + esc(nombre()) + '</h2><div class="row small"><span class="badge b-blue">RUT ' + esc(F.rut) + '</span><span class="badge b-gold">Nivel ' + esc(cfg.anio) + ': ' + esc(F.curso) + '</span>' +
      (F.numeroMatricula ? '<span class="badge b-gold">N° matrícula ' + esc(F.numeroMatricula) + '</span>' : '') + '<span id="est-badge">' + UI.badgeEstado(F.estado) + '</span></div>' +
      '<p style="margin:12px 0 0">' + esc(cfg.mensajeBienvenida) + '</p></div></section>' +
      (act ? '<div class="update-banner"><div class="ico">✏️</div><div><b class="t">El establecimiento solicita actualizar ' + (ped ? 'estos datos' : 'los datos de la ficha') + '</b><br>' +
        '<span class="muted">Los datos ya registrados se mantienen: solo modifique lo que haya cambiado (dirección, teléfono, correo, apoderado/a suplente, etc.) y presione «Enviar datos actualizados».</span>' +
        (nombresPedidos ? '<div class="chips">' + nombresPedidos.map(function (n) { return '<span class="badge b-gold">' + esc(n) + '</span>'; }).join('') + '</div>' : '') + '</div></div>' : '') +
      (lock ? '<div class="lock-banner"><div class="ico">🔒</div><div><b>' + (F.estado === 'matriculada' ? 'Estudiante matriculado/a' + (F.numeroMatricula ? ' · N° ' + esc(F.numeroMatricula) : '') : 'Ficha enviada' + (F.fechaEnvio ? ' el ' + esc(F.fechaEnvio) : '')) + '</b><br>' +
        '<span class="muted">Los datos ya fueron registrados y <b>no pueden modificarse</b>. Si necesita corregir algo, comuníquese con el establecimiento: solo el equipo puede autorizar la reapertura de la ficha.</span></div></div>' : '') +
      '<div class="subtabs"><button class="subtab" data-tab="ficha">📋 Ficha de matrícula</button><button class="subtab" data-tab="docs">📚 Documentos del colegio <span class="badge b-blue" id="cnt-docs"></span></button></div>' +
      '<div id="tab-ficha"><p class="muted small" style="margin:-4px 0 12px">Los datos marcados con <span class="req">*</span> son obligatorios. Los campos en gris solo pueden ser modificados por el establecimiento.</p>' +
      UI.formHtml(S.form.campos.filter(function (c) { return !/uso interno/i.test(c.seccion); }), F, editable) + '</div>' +
      '<div id="tab-docs" class="hidden">' + docsHtml(lock) + '</div>' +
      '</div>' +
      '<div class="savebar"><span class="autosave" id="autosave"><span class="dot"></span><span class="txt">' + (lock ? 'Ficha enviada' : 'Los cambios se guardan automáticamente') + '</span></span>' +
      '<span class="grow"></span>' +
      (lock ? '<span class="badge b-matriculada" style="font-size:14px;padding:8px 14px">✓ ' + (F.estado === 'matriculada' ? 'Matriculado/a' : 'Ficha enviada') + '</span>' :
        '<button class="btn ok lg" id="btn-enviar">' + (act && F.estado !== 'pendiente' && F.estado !== 'en_proceso' ? '📤 Enviar datos actualizados' : '💾 Guardar y enviar ficha') + '</button>') + '</div>';
    UI.$('#app').innerHTML = html;
    if (ped) ped.forEach(function (id) { var w = document.querySelector('#tab-ficha [data-wrap="' + CSS.escape(id) + '"]'); if (w) w.classList.add('pedido'); });
    App.enlazarTopbar();
    cambiarTab(tab);
    pintarProgreso();
    var root = UI.$('#tab-ficha');
    UI.enlazar(root, alCambiar);
    UI.$('.subtabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) cambiarTab(b.dataset.tab); });
    UI.$('#tab-docs').addEventListener('change', function (e) {
      var c = e.target.closest('[data-acepta]'); if (!c) return;
      var id = c.dataset.acepta;
      F.aceptaciones = F.aceptaciones || {};
      if (c.checked) F.aceptaciones[id] = { fecha: 'recién', por: 'Familia' }; else delete F.aceptaciones[id];
      c.closest('.doc-card').classList.toggle('ok', c.checked);
      pendAcc[id] = c.checked;
      pintarProgreso(); marcar('pendiente'); programar();
    });
    UI.$('#tab-docs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-carta]'); if (!b) return;
      var d = S.form.documentos.filter(function (x) { return x.id === b.dataset.carta; })[0];
      UI.modal({ title: esc(d.titulo), size: 'wide', html: '<div class="carta-text">' + esc(Doc.reemplazar(d.contenido, F)) + '</div>', buttons: [{ text: 'Cerrar', cls: 'ghost', value: true }] });
    });
    var be = UI.$('#btn-enviar'); if (be) be.addEventListener('click', enviar);
  }

  function docsHtml(lock) {
    var cfg = S.form.config, acc = F.aceptaciones || {};
    var h = '<p class="muted" style="margin-top:-4px">Lea cada documento y confirme que está en conocimiento. Su confirmación quedará registrada en el <b>acta de la ficha de matrícula</b>.</p>';
    S.form.documentos.forEach(function (d) {
      var ok = !!acc[d.id];
      h += '<section class="card doc-card' + (ok ? ' ok' : '') + '" data-wrap="doc:' + esc(d.id) + '"><div class="doc-ico">' + (d.tipo === 'carta' ? '✉️' : '📘') + '</div><div class="grow">' +
        '<h3 style="font-size:17px">' + esc(d.titulo) + '</h3><p class="muted" style="margin:0 0 10px">' + esc(d.resumen) + '</p><div class="row">' +
        (d.url ? '<a class="btn sm" href="' + esc(d.url) + '" target="_blank" rel="noopener">📄 Abrir documento completo</a>' : (d.tipo !== 'carta' ? '<span class="small muted">El documento completo está disponible en el establecimiento.</span>' : '')) +
        (d.contenido ? '<button class="btn sm ghost" data-carta="' + esc(d.id) + '">✉️ Leer carta</button>' : '') + '</div>' +
        (UI.si(d.requiereAceptacion) ? '<div class="doc-accept"><label class="check"><input type="checkbox" data-acepta="' + esc(d.id) + '"' + (ok ? ' checked' : '') + (lock ? ' disabled' : '') + '>' +
          '<span>Declaro que he leído y estoy en conocimiento de este documento, y me comprometo a respetarlo.' + (ok && acc[d.id].fecha && acc[d.id].fecha !== 'recién' ? ' <span class="small muted">(' + esc(acc[d.id].fecha) + ')</span>' : '') + '</span></label></div>' : '') +
        '</div></section>';
    });
    h += '<section class="acta-box" style="margin-top:18px"><h3>📝 Acta de toma de conocimiento</h3><p style="margin:0;text-align:justify">' + esc(Doc.reemplazar(cfg.textoActa, F)) + '</p></section>';
    return h;
  }

  function cambiarTab(t) {
    tab = t;
    UI.$('#tab-ficha').classList.toggle('hidden', t !== 'ficha');
    UI.$('#tab-docs').classList.toggle('hidden', t !== 'docs');
    UI.$$('.subtab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
  }

  /* ----------- guardado automático ----------- */
  var programar = UI.debounce(guardarAhora, 1200);
  function marcar(estado, txt) {
    var el = UI.$('#autosave'); if (!el) return;
    el.className = 'autosave ' + (estado === 'pendiente' ? 'saving' : estado);
    el.querySelector('.txt').textContent = txt || (estado === 'saving' || estado === 'pendiente' ? 'Guardando…' : estado === 'saved' ? '✓ Guardado automáticamente' : '');
  }
  function alCambiar(id) {
    var d = UI.leer(UI.$('#tab-ficha'));
    pend[id] = d[id]; F[id] = d[id];
    marcar('pendiente'); pintarProgreso(); programar();
  }
  async function guardarAhora() {
    if (guardando) { programar(); return; }
    var datos = pend, acc = pendAcc;
    if (!Object.keys(datos).length && !Object.keys(acc).length) return;
    pend = {}; pendAcc = {}; guardando = true; marcar('saving');
    try {
      var r = await UI.api('guardarBorrador', { datos: datos, aceptaciones: Object.keys(acc).length ? acc : null });
      if (F.estado === 'pendiente') { F.estado = 'en_proceso'; UI.$('#est-badge').innerHTML = UI.badgeEstado(F.estado); }
      marcar('saved', '✓ Guardado automáticamente · ' + String(r.guardado).slice(11));
    } catch (e) {
      pend = Object.assign({}, datos, pend); pendAcc = Object.assign({}, acc, pendAcc);
      marcar('error', '⚠ ' + (e.red ? 'Sin conexión. Reintentando…' : e.userMsg));
      if (e.red) setTimeout(programar, 5000); else UI.error('No se pudo guardar', e.userMsg);
    } finally { guardando = false; }
  }
  async function vaciar() {
    for (var i = 0; i < 40 && guardando; i++) await UI.sleep(150);
    await guardarAhora();
  }
  window.addEventListener('beforeunload', function (e) {
    if (F && (Object.keys(pend).length || Object.keys(pendAcc).length)) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ----------- envío final ----------- */
  function irA(item) {
    if (item.doc) { cambiarTab('docs'); UI.resaltar(item.id); }
    else { cambiarTab('ficha'); UI.resaltar(item.id); }
  }
  async function enviar() {
    var root = UI.$('#tab-ficha'), datos = UI.leer(root);
    var acc = {}; UI.$$('[data-acepta]').forEach(function (c) { acc[c.dataset.acepta] = c.checked; });
    var falta = UI.validar(S.form.campos.filter(editable), datos, false).concat(docsReq().filter(function (d) { return !acc[d.id]; })
      .map(function (d) { return { id: 'doc:' + d.id, etiqueta: 'Confirmar lectura de: ' + d.titulo, seccion: 'Documentos del colegio', doc: true }; }));
    UI.marcarErrores(root, falta);
    if (falta.length) return UI.faltantes(falta, irA);
    var ok = await UI.confirm(actualizando() ? '¿Enviar los datos actualizados?' : '¿Guardar y enviar la ficha?', 'Revise que los datos estén correctos. Una vez enviada, <b>la ficha no podrá modificarse</b>, salvo autorización del equipo del establecimiento.', 'Sí, enviar', 'ok');
    if (!ok) return;
    await vaciar();
    var r = await UI.intentar(function () { return UI.api('enviarFicha', { datos: datos, aceptaciones: acc }); }, 'Guardando la ficha…');
    if (!r) return;
    if (!r.enviado) { UI.marcarErrores(root, r.faltantes); return UI.faltantes(r.faltantes, irA); }
    F = await UI.api('miFicha');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (r.actualizacion) return UI.success('¡Datos actualizados!', 'Los cambios en la ficha de <b>' + esc(nombre()) + '</b> quedaron registrados el ' + esc(r.fecha) + '.<br><br>🔒 La ficha vuelve a quedar cerrada. ¡Gracias por mantener sus datos al día!', { boton: 'Perfecto' });
    UI.success('¡Ficha guardada y enviada!', 'Los datos de <b>' + esc(nombre()) + '</b> quedaron registrados correctamente el ' + esc(r.fecha) + '.<br><br>🔒 Desde ahora la ficha <b>no puede modificarse</b>. Si necesita realizar un cambio, comuníquese con el establecimiento: solo el equipo puede autorizar su reapertura.', { boton: 'Perfecto' });
  }

  return { iniciar: iniciar };
})();
