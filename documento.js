/* =====================================================================
   DOCUMENTO OFICIAL: ficha de matrícula + acta + cartas, con firmas.
   Imprimir (PDF del navegador), descargar PDF y compartir por WhatsApp.
   ===================================================================== */
var Doc = (function () {
  'use strict';
  var esc = UI.esc;

  function hoyLargo() {
    return new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function reemplazar(txt, f) {
    var cfg = S.form.config;
    var mapa = {
      apoderado: UI.nombreApo(f) || '______________________________', rut_apoderado: f.apo_rut || '______________',
      estudiante: [f.est_nombres, f.est_apellido_paterno, f.est_apellido_materno].filter(Boolean).join(' '),
      rut_estudiante: f.rut, curso: f.curso, numero_matricula: f.numeroMatricula || '______', curso_anterior: f.cursoAnterior || '', anio: cfg.anio, colegio: cfg.nombreColegio, ciudad: cfg.ciudad || 'Concepción',
      fecha: hoyLargo(), director: cfg.directorNombre || ''
    };
    return String(txt || '').replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return k in mapa ? mapa[k] : m; });
  }
  function encabezado(f, titulo) {
    var cfg = S.form.config;
    return '<div class="doc-head"><img src="assets/insignia.jpg" alt="Insignia">' +
      '<div class="dh-c"><div class="col">' + esc(cfg.nombreColegio) + '</div><div class="sub">' + esc([cfg.direccion, cfg.ciudad, cfg.rbd ? 'RBD ' + cfg.rbd : '', cfg.telefono].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="tit">' + esc(titulo) + '</div></div>' +
      '<div class="dh-r"><div><b>N° matrícula</b><span style="font-size:12px;font-weight:bold;color:#12347a">' + esc(f.numeroMatricula || '______') + '</span></div><div><b>Año escolar</b><span>' + esc(cfg.anio) + '</span></div>' +
      '<div><b>RUT</b><span>' + esc(f.rut) + '</span></div><div><b>Nivel</b><span>' + esc(f.curso) + '</span></div><div><b>Fecha</b><span>' + esc(UI.fechaLarga((f.fechaMatricula || '').slice(0, 10)) || new Date().toLocaleDateString('es-CL')) + '</span></div></div></div>';
  }
  function valor(c, f) {
    var v = f[c.id];
    if (c.tipo === 'fecha') v = UI.fechaLarga(v);
    return v ? esc(v) : '<span style="color:#999">—</span>';
  }
  function firmas(f, conDireccion) {
    var html = '<div class="signs">' +
      '<div class="sign"><div class="line"></div><b>' + esc(UI.nombreApo(f) || 'Nombre: ______________________') + '</b>RUT: ' + esc(f.apo_rut || '________________') + '<br>Firma Apoderado/a Titular</div>' +
      '<div class="sign"><div class="line"></div><b>' + esc(f.matriculadoPorNombre || 'Nombre: ______________________') + '</b>RUT: ' + esc(f.matriculadoPorRut || '________________') + '<br>Firma Funcionario/a que matricula</div>';
    if (conDireccion) html += '<div class="sign"><div class="line"></div><b>' + esc(S.form.config.directorNombre || 'Dirección') + '</b>Director/a<br>Timbre del establecimiento</div>';
    return html + '</div>';
  }
  function fichaHtml(f) {
    var cfg = S.form.config, acc = f.aceptaciones || {};
    var h = encabezado(f, 'FICHA DE MATRÍCULA ' + cfg.anio);
    h += '<table class="dt"><tr><td class="k">Estudiante</td><td class="v" colspan="3"><b>' + esc([f.est_nombres, f.est_apellido_paterno, f.est_apellido_materno].filter(Boolean).join(' ')) + '</b></td></tr>' +
      '<tr><td class="k">Nivel ' + esc(cfg.anio) + '</td><td class="v"><b>' + esc(f.curso) + '</b></td><td class="k">Curso de procedencia</td><td class="v">' + esc(f.cursoAnterior || 'Estudiante nuevo/a') + '</td></tr>' +
      '<tr><td class="k">Estado</td><td class="v">' + esc((S.form.estados || {})[f.estado] || f.estado) + '</td><td class="k">Matrícula registrada</td><td class="v">' + esc(f.fechaMatricula || '—') + '</td></tr></table>';
    UI.secciones(S.form.campos).forEach(function (s) {
      h += '<h4>' + esc(s.nombre) + '</h4><table class="dt">';
      var fila = [];
      s.campos.forEach(function (c) {
        if (c.tipo === 'parrafo' || String(c.etiqueta).length > 60) {
          if (fila.length) { h += '<tr>' + fila.join('') + '<td class="k"></td><td class="v"></td></tr>'; fila = []; }
          h += '<tr><td class="k">' + esc(c.etiqueta) + '</td><td class="v" colspan="3">' + valor(c, f) + '</td></tr>';
          return;
        }
        fila.push('<td class="k">' + esc(c.etiqueta) + '</td><td class="v">' + valor(c, f) + '</td>');
        if (fila.length === 2) { h += '<tr>' + fila.join('') + '</tr>'; fila = []; }
      });
      if (fila.length) h += '<tr>' + fila.join('') + '<td class="k"></td><td class="v"></td></tr>';
      h += '</table>';
    });
    var docs = S.form.documentos.filter(function (d) { return UI.si(d.requiereAceptacion); });
    h += '<div class="acta"><b class="t">ACTA DE TOMA DE CONOCIMIENTO Y COMPROMISO</b>' + esc(reemplazar(cfg.textoActa, f)) +
      '<ul>' + docs.map(function (d) {
        var a = acc[d.id];
        return '<li><b>' + esc(d.titulo) + ':</b> ' + (a ? '☑ Leído y en conocimiento — ' + esc(a.fecha || a) + (a.por ? ' (' + esc(a.por) + ')' : '') : '☐ Pendiente de confirmación') + '</li>';
      }).join('') + '</ul></div>';
    h += firmas(f, true);
    h += '<div class="foot">Documento generado el ' + esc(new Date().toLocaleString('es-CL')) + ' · Plataforma de Fichas de Matrícula · ' + esc(cfg.nombreColegio) + '</div>';
    S.form.documentos.filter(function (d) { return d.tipo === 'carta' && UI.si(d.imprimir); }).forEach(function (d) {
      h += '<div class="page-break"></div>' + encabezado(f, d.titulo.toUpperCase()) +
        '<div class="carta-body">' + esc(reemplazar(d.contenido, f)) + '</div>' +
        (acc[d.id] ? '<p style="font-size:10px;color:#12347a">☑ Leída y aceptada en la plataforma: ' + esc(acc[d.id].fecha || '') + '</p>' : '') + firmas(f, false);
    });
    return h;
  }
  function nombreArchivo(f) {
    return ('Ficha_Matricula_' + f.est_apellido_paterno + '_' + f.est_nombres + '_' + f.curso).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 90) + '.pdf';
  }
  function esperarImagenes(root) {
    return Promise.all(UI.$$('img', root).map(function (img) {
      return img.complete ? null : new Promise(function (r) { img.onload = img.onerror = r; });
    }));
  }

  async function imprimir(fichas) {
    var root = UI.$('#print-root');
    root.innerHTML = '<div class="doc">' + fichas.map(function (f, i) { return (i ? '<div class="page-break"></div>' : '') + fichaHtml(f); }).join('') + '</div>';
    await esperarImagenes(root);
    window.addEventListener('afterprint', function limpiar() { root.innerHTML = ''; window.removeEventListener('afterprint', limpiar); });
    window.print();
  }
  function opciones(f) {
    return {
      margin: [10, 10, 10, 10], filename: nombreArchivo(f), image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.signs', '.acta'] }
    };
  }
  function elemento(f) {
    var el = document.createElement('div');
    el.className = 'pdf-mode';
    el.innerHTML = '<div class="doc">' + fichaHtml(f) + '</div>';
    return el;
  }
  async function descargar(f) {
    UI.loading('Generando PDF…');
    try { await html2pdf().set(opciones(f)).from(elemento(f)).save(); UI.toast('PDF descargado: ' + nombreArchivo(f), 'ok'); }
    catch (e) { UI.error('No se pudo generar el PDF', e.message); }
    finally { UI.done(); }
  }
  function telefonoWa(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 8) d = '569' + d;
    else if (d.length === 9) d = '56' + d;
    return d;
  }
  async function whatsapp(f) {
    UI.loading('Preparando PDF para WhatsApp…');
    var blob;
    try { blob = await html2pdf().set(opciones(f)).from(elemento(f)).outputPdf('blob'); }
    catch (e) { UI.done(); return UI.error('No se pudo generar el PDF', e.message); }
    UI.done();
    var nombre = nombreArchivo(f), cfg = S.form.config;
    var texto = 'Estimado/a apoderado/a: adjuntamos la ficha de matrícula ' + cfg.anio + ' de ' + [f.est_nombres, f.est_apellido_paterno].join(' ') + ' (' + f.curso + '). ' + cfg.nombreColegio + '.';
    var file = new File([blob], nombre, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nombre, text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    var tel = telefonoWa(f.apo_celular);
    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    UI.info('Compartir por WhatsApp', 'Se descargó el archivo <b>' + esc(nombre) + '</b> y se abrió WhatsApp' + (tel ? ' con el número del apoderado/a' : '') +
      '.<br><br>Adjunte el PDF en el chat con el clip 📎. En teléfonos móviles el archivo se comparte directamente.');
  }

  return { imprimir: imprimir, descargar: descargar, whatsapp: whatsapp, reemplazar: reemplazar, fichaHtml: fichaHtml };
})();
