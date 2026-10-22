/* =====================================================================
   ACCESO FUNCIONARIOS: Docente · Asistente de Educación · Equipo de Gestión
   ===================================================================== */
var Staff = (function () {
  'use strict';
  var esc = UI.esc, P = null, fichas = [], filtro = { curso: '', estado: '', q: '' }, vista = 'fichas', ed = null, admin = null;
  var TIPOS = { texto: 'Texto corto', parrafo: 'Texto largo', numero: 'Número', fecha: 'Fecha', email: 'Correo electrónico', telefono: 'Teléfono', rut: 'RUT', lista: 'Lista de opciones', si_no: 'Sí / No' };
  var COLOR_CICLO = { 'Preescolar': '#e07a2f', 'Primer Ciclo': '#1f5fbf', 'Segundo Ciclo': '#18915a', 'Enseñanza Media': '#7a3fc0', 'Otro': '#7d8aa3' };

  function gestion() { return P.rol === 'gestion'; }
  function norm(s) { return CoreUtil.norm(s); }
  function opciones(lista, actual, vacio) {
    if (actual && lista.indexOf(actual) < 0) lista = [actual].concat(lista);
    return (vacio !== undefined ? '<option value="">' + esc(vacio) + '</option>' : '') + lista.map(function (c) { return '<option' + (c === actual ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  }
  function selNivel(id, actual, dis) { return '<select id="' + id + '"' + (dis ? ' disabled' : '') + '>' + opciones(S.form.niveles || [], actual, 'Seleccione el nivel…') + '</select>'; }
  function selAnterior(id, actual, dis) { return '<select id="' + id + '"' + (dis ? ' disabled' : '') + '>' + opciones(S.form.cursos, actual, 'Estudiante nuevo (sin curso anterior)') + '</select>'; }
  function puedoEditar(f) { return gestion() || f.estado !== 'matriculada' || f.editFuncionario; }
  function main() { return UI.$('#main'); }
  function nombreCompleto(f) { return [f.est_nombres, f.est_apellido_paterno, f.est_apellido_materno].filter(Boolean).join(' '); }

  /* ------------------------------ estructura ------------------------------ */
  async function iniciar() {
    P = S.perfil;
    S.form = await UI.api('formulario');
    var nav = [['fichas', '📋', 'Fichas de matrícula'], ['estadisticas', '📊', 'Resumen estadístico']];
    var navG = [['usuarios', '👥', 'Usuarios'], ['formulario', '🧩', 'Datos de la ficha'], ['documentos', '📚', 'Reglamentos y cartas'], ['config', '⚙️', 'Configuración'], ['bitacora', '🕘', 'Bitácora']];
    function item(n) { return '<button class="nav-item" data-nav="' + n[0] + '"><span class="ni">' + n[1] + '</span>' + n[2] + '</button>'; }
    UI.$('#app').innerHTML = App.topbar(P.nombre, P.rolNombre + (gestion() ? '' : ' · ' + (P.cursos.join(', ') || 'sin cursos asignados'))) +
      '<div class="layout"><nav class="sidebar">' + nav.map(item).join('') + (gestion() ? '<div class="nav-sep">Equipo de Gestión</div>' + navG.map(item).join('') : '') +
      '<div class="nav-sep">Ayuda</div><button class="nav-item" data-nav="tutorial"><span class="ni">🎬</span>Video tutorial</button></nav><main class="main" id="main"></main></div>';
    App.enlazarTopbar();
    UI.$('.sidebar').addEventListener('click', function (e) { var b = e.target.closest('[data-nav]'); if (b) ir(b.dataset.nav); });
    await ir('fichas');
  }

  async function ir(v, arg) {
    if (v === 'tutorial') return App.tutorial();
    if (ed && ed.pend && Object.keys(ed.pend).length) await guardarAuto();
    vista = v; ed = v === 'editor' ? ed : null;
    UI.$$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.nav === (v === 'editor' ? 'fichas' : v)); });
    main().innerHTML = '<div class="empty"><div class="spinner" style="margin:auto"></div></div>';
    try {
      if (v === 'fichas') await vFichas(arg);
      else if (v === 'editor') await vEditor(arg);
      else if (v === 'estadisticas') await vStats();
      else if (v === 'usuarios') await vUsuarios();
      else if (v === 'formulario') await vFormulario();
      else if (v === 'documentos') await vDocumentos();
      else if (v === 'config') await vConfig();
      else if (v === 'bitacora') await vBitacora();
    } catch (e) {
      main().innerHTML = '<div class="empty"><div class="e-ico">⚠️</div><p>' + esc(e.userMsg || e.message) + '</p></div>';
    }
    window.scrollTo(0, 0);
  }

  /* ================================ FICHAS ================================ */
  function grupoDe(f) { return filtro.agrupar === 'anterior' ? (f.cursoAnterior || 'Estudiantes nuevos') : (f.curso || 'Sin nivel'); }
  async function vFichas(recargar) {
    if (recargar !== false) fichas = await UI.api('listarFichas');
    filtro.agrupar = filtro.agrupar || 'nivel';
    var cursos = [], anio = S.form.config.anio;
    ordenarPorGrupo().forEach(function (f) { var g = grupoDe(f); if (cursos.indexOf(g) < 0) cursos.push(g); });
    if (cursos.indexOf(filtro.curso) < 0) filtro.curso = '';
    main().innerHTML = '<div class="page-h"><div><div class="eyebrow">Proceso de matrícula ' + esc(anio) + '</div><h2>Fichas de matrícula</h2></div><span class="badge b-blue">' + fichas.length + ' estudiantes</span><span class="grow"></span>' +
      '<button class="btn gold" data-a="nueva">➕ Nuevo estudiante</button>' +
      (gestion() ? '<button class="btn ghost" data-a="habilitar">🔓 Habilitar edición</button><button class="btn ghost" data-a="importar">📥 Cargar / actualizar base</button><button class="btn ghost" data-a="descargar">⬇ Descargar base de datos</button>' :
        '<button class="btn ghost" data-a="exportar">⬇ Exportar Excel</button>') + '</div>' +
      '<div class="toolbar"><div class="seg" id="fl-agr"><button data-g="nivel" class="' + (filtro.agrupar === 'nivel' ? 'active' : '') + '">Por nivel ' + esc(anio) + '</button><button data-g="anterior" class="' + (filtro.agrupar === 'anterior' ? 'active' : '') + '">Por curso de procedencia</button></div>' +
      '<select id="fl-curso"><option value="">' + (filtro.agrupar === 'anterior' ? 'Todos los cursos' : 'Todos los niveles') + '</option>' + cursos.map(function (c) { return '<option' + (c === filtro.curso ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="fl-estado"><option value="">Todos los estados</option>' + Object.keys(S.form.estados).map(function (k) { return '<option value="' + k + '"' + (k === filtro.estado ? ' selected' : '') + '>' + esc(S.form.estados[k]) + '</option>'; }).join('') + '</select>' +
      '<input class="search" id="fl-q" type="text" placeholder="🔎 Buscar por nombre, RUT o apoderado…" value="' + esc(filtro.q) + '"></div><div id="lista"></div>';
    UI.$('#fl-curso').onchange = function () { filtro.curso = this.value; pintarLista(); };
    UI.$('#fl-agr').onclick = function (e) { var b = e.target.closest('[data-g]'); if (b && b.dataset.g !== filtro.agrupar) { filtro.agrupar = b.dataset.g; filtro.curso = ''; vFichas(false); } };
    UI.$('#fl-estado').onchange = function () { filtro.estado = this.value; pintarLista(); };
    UI.$('#fl-q').oninput = UI.debounce(function () { filtro.q = UI.$('#fl-q').value; pintarLista(); }, 200);
    main().onclick = clickFichas;
    pintarLista();
  }
  function ordenarPorGrupo() {
    if (filtro.agrupar !== 'anterior') return fichas.slice();
    var orden = {}; S.form.cursos.forEach(function (c, i) { orden[norm(c)] = i; });
    function nom(f) { return norm(f.est_apellido_paterno + ' ' + f.est_apellido_materno + ' ' + f.est_nombres); }
    return fichas.slice().sort(function (a, b) {
      var oa = a.cursoAnterior ? (orden[norm(a.cursoAnterior)] !== undefined ? orden[norm(a.cursoAnterior)] : 900) : 999;
      var ob = b.cursoAnterior ? (orden[norm(b.cursoAnterior)] !== undefined ? orden[norm(b.cursoAnterior)] : 900) : 999;
      return oa - ob || (norm(a.cursoAnterior) < norm(b.cursoAnterior) ? -1 : norm(a.cursoAnterior) > norm(b.cursoAnterior) ? 1 : 0) || (nom(a) < nom(b) ? -1 : 1);
    });
  }
  function filtradas() {
    var q = norm(filtro.q);
    return ordenarPorGrupo().filter(function (f) {
      if (filtro.curso && grupoDe(f) !== filtro.curso) return false;
      if (filtro.estado && f.estado !== filtro.estado) return false;
      return !q || norm(nombreCompleto(f) + ' ' + f.rut + ' ' + UI.nombreApo(f) + ' ' + CoreUtil.rutKey(f.rut) + ' ' + (f.numeroMatricula || '')).indexOf(q) >= 0;
    });
  }
  function marcasEdicion(f) {
    return (f.editFamilia ? ' <span class="badge b-gold" title="La familia puede actualizar datos">✏️ familia</span>' : '') +
      (f.editFuncionario ? ' <span class="badge b-desbloqueada" title="Funcionarios pueden editar">✏️ funcionarios</span>' : '');
  }
  function pintarLista() {
    var lista = filtradas(), grupos = [], actual = null, anterior = filtro.agrupar === 'anterior';
    lista.forEach(function (f) {
      if (!actual || actual.curso !== grupoDe(f)) { actual = { curso: grupoDe(f), items: [] }; grupos.push(actual); }
      actual.items.push(f);
    });
    if (!grupos.length) { UI.$('#lista').innerHTML = '<div class="card empty"><div class="e-ico">🗂️</div><p>No hay fichas que coincidan con el filtro.</p></div>'; return; }
    UI.$('#lista').innerHTML = grupos.map(function (g) {
      var c = { enviada: 0, matriculada: 0 };
      g.items.forEach(function (f) { c[f.estado] = (c[f.estado] || 0) + 1; });
      return '<section class="card curso-group"><div class="curso-h"><h3>🎓 ' + (anterior ? '' : 'Nivel ' + esc(S.form.config.anio) + ': ') + esc(g.curso) + '</h3><span class="muted small">' + esc(CoreUtil.cicloDe(g.curso)) + '</span>' +
        '<div class="chip-stats"><span class="badge b-blue">' + g.items.length + ' estudiantes</span><span class="badge b-enviada">' + c.enviada + ' enviadas</span><span class="badge b-matriculada">' + c.matriculada + ' matriculados</span></div>' +
        '<span class="grow"></span><button class="btn sm ghost" data-a="imprimir-curso" data-curso="' + esc(g.curso) + '">🖨 Imprimir grupo</button></div>' +
        '<div class="table-wrap"><table class="t"><thead><tr><th>N°</th><th>N° matr.</th><th>Estudiante</th><th>RUT</th><th>' + (anterior ? 'Nivel ' + esc(S.form.config.anio) : 'Curso procedencia') + '</th><th class="hide-sm">Apoderado/a</th><th>Estado</th><th class="hide-sm hide-md">Actualización</th><th></th></tr></thead><tbody>' +
        g.items.map(function (f, i) {
          return '<tr><td class="muted">' + (i + 1) + '</td><td class="num-mat">' + esc(f.numeroMatricula || '—') + '</td><td><a href="#" class="name" data-a="editar" data-rut="' + esc(f.rut) + '">' + esc(UI.nombreEst(f)) + '</a></td><td class="nowrap">' + esc(f.rut) + '</td>' +
            '<td class="small nowrap">' + esc(anterior ? f.curso : (f.cursoAnterior || 'Nuevo/a')) + '</td>' +
            '<td class="hide-sm small">' + esc(UI.nombreApo(f) || '—') + (f.apo_celular ? '<br><span class="muted">📱 ' + esc(f.apo_celular) + '</span>' : '') + '</td><td>' + UI.badgeEstado(f.estado) + marcasEdicion(f) + '</td>' +
            '<td class="hide-sm hide-md small muted">' + esc(f.ultimaModificacion || '') + '<br>' + esc(f.modificadoPor || '') + '</td>' +
            '<td><div class="acts"><button class="icon-btn" title="Ver / editar" data-a="editar" data-rut="' + esc(f.rut) + '">✏️</button>' +
            '<button class="icon-btn" title="Imprimir" data-a="imprimir" data-rut="' + esc(f.rut) + '">🖨</button>' +
            '<button class="icon-btn" title="Descargar PDF" data-a="pdf" data-rut="' + esc(f.rut) + '">⬇</button>' +
            '<button class="icon-btn wa" title="Compartir por WhatsApp" data-a="wa" data-rut="' + esc(f.rut) + '">💬</button></div></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }).join('');
  }
  function porRut(rut) { return fichas.filter(function (f) { return f.rut === rut; })[0]; }
  function clickFichas(e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    e.preventDefault();
    var a = b.dataset.a, f = b.dataset.rut && porRut(b.dataset.rut);
    if (a === 'editar') ir('editor', b.dataset.rut);
    else if (a === 'imprimir') Doc.imprimir([f]);
    else if (a === 'pdf') Doc.descargar(f);
    else if (a === 'wa') Doc.whatsapp(f);
    else if (a === 'imprimir-curso') Doc.imprimir(filtradas().filter(function (x) { return grupoDe(x) === b.dataset.curso; }));
    else if (a === 'nueva') nuevaFicha();
    else if (a === 'importar') importarEstudiantes();
    else if (a === 'exportar') exportarExcel(filtradas(), 'una');
    else if (a === 'descargar') descargarBase();
    else if (a === 'habilitar') modalHabilitar(null);
  }

  function nuevaFicha() {
    var anio = S.form.config.anio;
    UI.modal({
      title: '➕ Nuevo estudiante', size: 'wide',
      html: '<p class="muted" style="margin-top:0">Registre a un estudiante nuevo. Luego podrá completar la ficha usted mismo/a o la familia podrá ingresar con el <b>RUT del estudiante</b> y su <b>fecha de nacimiento</b> (DDMMAAAA) como clave.</p>' +
        '<div class="grid"><div class="field"><label>RUT del estudiante<span class="req">*</span></label><input id="n-rut" placeholder="12345678-9"></div>' +
        '<div class="field"><label>Nivel al que se matricula (' + esc(anio) + ')<span class="req">*</span></label>' + selNivel('n-curso', '') + '</div>' +
        '<div class="field"><label>Curso de procedencia</label>' + selAnterior('n-ant', '') + '</div>' +
        '<div class="field"><label>Nombres<span class="req">*</span></label><input id="n-nom"></div>' +
        '<div class="field"><label>Apellido paterno<span class="req">*</span></label><input id="n-pat"></div>' +
        '<div class="field"><label>Apellido materno</label><input id="n-mat"></div>' +
        '<div class="field"><label>Fecha de nacimiento<span class="req">*</span></label><input id="n-nac" type="date"></div>' +
        '<div class="field"><label>Sexo</label><select id="n-sexo"><option value="">Seleccione…</option><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div></div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: 'Crear ficha', cls: 'ok', onClick: async function (el) {
          var v = function (id) { return el.querySelector(id).value.trim(); };
          if (!CoreUtil.rutValido(v('#n-rut'))) { UI.toast('El RUT no es válido', 'bad'); return false; }
          try {
            var f = await UI.api('crearFicha', { rut: v('#n-rut'), curso: v('#n-curso'), cursoAnterior: v('#n-ant'), datos: { est_nombres: v('#n-nom').toUpperCase(), est_apellido_paterno: v('#n-pat').toUpperCase(), est_apellido_materno: v('#n-mat').toUpperCase(), est_fecha_nacimiento: v('#n-nac'), est_sexo: v('#n-sexo') } });
            return f;
          } catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }]
    }).then(async function (f) {
      if (!f) return;
      fichas.push(f);
      await UI.success('Estudiante registrado', '<b>' + esc(nombreCompleto(f)) + '</b> fue agregado/a a <b>' + esc(f.curso) + '</b>.<br>Clave inicial de la familia: <b>' + esc(f.est_fecha_nacimiento.split('-').reverse().join('')) + '</b>');
      ir('editor', f.rut);
    });
  }

  /* Cargar o actualizar la base de datos desde Excel (registro del colegio o Excel descargado de la plataforma). */
  function importarEstudiantes() {
    var lotes = [];
    UI.modal({
      title: '📥 Cargar o actualizar la base de datos', size: 'wide',
      html: '<ol class="steps"><li><div>Puede subir <b>su registro de estudiantes</b> (columnas Rut, DV, AL Paterno, AL Nombre, Curso, Apod …; <a href="#" id="pl-est">descargar plantilla</a>) ' +
        'o el <b>Excel descargado desde la plataforma</b> («⬇ Descargar base de datos») después de corregirlo.</div></li>' +
        '<li><div>Los estudiantes se identifican por su <b>RUT</b>. Se leen todas las hojas del archivo. <b>Una celda vacía nunca borra un dato ya registrado.</b></div></li></ol>' +
        '<label style="margin-top:16px">¿Qué hacer con los estudiantes que ya existen?</label><div class="opt-cards">' +
        '<label class="opt-card"><input type="radio" name="im-m" value="nuevos"><span>Solo agregar nuevos<small>Los existentes no se tocan</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="im-m" value="completar" checked><span>Completar datos vacíos<small>Agrega nuevos y llena solo lo que falta</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="im-m" value="sobrescribir"><span>Actualizar con el Excel<small>Reemplaza con los valores del archivo</small></span></label></div>' +
        '<div class="dropzone" id="dz" style="margin-top:14px">📂 <b>Pinche aquí o arrastre el archivo Excel</b><br><span class="small muted">.xlsx, .xls o .csv</span><input type="file" id="fx" accept=".xlsx,.xls,.csv" hidden></div>' +
        '<div id="prev" style="margin-top:14px"></div><label class="check" style="margin-top:12px"><input type="checkbox" id="promo" checked> <span>Si el archivo trae la columna «Curso» del registro actual: calcular el nivel ' + esc(S.form.config.anio) + ' como el siguiente (1° Básico A → 2° Básico).</span></label>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: '📥 Cargar', cls: 'ok', onClick: async function (el) {
          if (!lotes.length) { UI.toast('Primero seleccione un archivo', 'bad'); return false; }
          var modo = el.querySelector('[name=im-m]:checked').value;
          if (modo === 'sobrescribir' && !await UI.confirm('¿Actualizar con los datos del Excel?', 'Los datos de las fichas existentes se reemplazarán por los valores del archivo (las celdas vacías no borran nada).', 'Sí, actualizar', 'gold', 'warning')) return false;
          var tot = { creadas: 0, actualizadas: 0, sinCambios: 0, omitidas: 0, conflictos: 0, ignoradas: [] };
          try {
            for (var i = 0; i < lotes.length; i++) {
              var cab = lotes[i].filas[0], cuerpo = lotes[i].filas.slice(1);
              for (var j = 0; j < cuerpo.length; j += 150) { // por partes, para no exceder el tiempo de Apps Script
                UI.loading('Cargando… ' + Math.min(j + 150, cuerpo.length) + ' de ' + cuerpo.length + ' (hoja ' + lotes[i].hoja + ')');
                var r = await UI.api('importarEstudiantes', { filas: [cab].concat(cuerpo.slice(j, j + 150)), promover: el.querySelector('#promo').checked, modo: modo });
                UI.done();
                ['creadas', 'actualizadas', 'sinCambios', 'omitidas', 'conflictos'].forEach(function (k) { tot[k] += r[k] || 0; });
                (r.ignoradas || []).forEach(function (x) { if (tot.ignoradas.indexOf(x) < 0) tot.ignoradas.push(x); });
              }
            }
          } catch (e) { UI.done(); UI.toast(e.userMsg || e.message, 'bad'); return false; }
          return tot;
        }
      }],
      onOpen: function (el) {
        var dz = el.querySelector('#dz'), fx = el.querySelector('#fx');
        el.querySelector('#pl-est').onclick = function (e) {
          e.preventDefault();
          var ws = XLSX.utils.aoa_to_sheet([['No', 'Rut', 'DV', 'AL Paterno', 'AP Materno', 'AL Nombre', 'Sexo', 'Nacimiento', 'Curso', 'Matrícula', 'Direccion', 'Apod Comuna', 'Apod Nombre', 'Apod Paterno', 'Apod Materno', 'Apod Celular', 'Apod Email', 'Fecha de retiro'],
            [1, 12345678, 5, 'PÉREZ', 'SOTO', 'JUAN ANDRÉS', 'M', '15/03/2019', '1° Básico A', '01/03/2027', 'CALLE EJEMPLO 123', 'CONCEPCIÓN', 'MARÍA JOSÉ', 'SOTO', 'ROJAS', '912345678', 'correo@ejemplo.cl', '']]);
          ws['!cols'] = [6, 11, 4, 14, 14, 22, 6, 12, 14, 12, 28, 16, 18, 14, 14, 13, 26, 14].map(function (w) { return { wch: w }; });
          var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registro');
          XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx');
        };
        dz.onclick = function () { fx.click(); };
        dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('over'); };
        dz.ondragleave = function () { dz.classList.remove('over'); };
        dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) leer(e.dataTransfer.files[0]); };
        fx.onchange = function () { if (fx.files[0]) leer(fx.files[0]); };
        async function leer(file) {
          try {
            var wb = await UI.leerExcel(file);
            lotes = [];
            wb.SheetNames.forEach(function (n) {
              var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
              var idx = rows.findIndex(function (r) { var h = r.map(norm); return h.indexOf('rut') >= 0 || h.indexOf('rut estudiante') >= 0; });
              if (idx < 0) return;
              var h = rows[idx].map(norm), cr = h.indexOf('rut') >= 0 ? h.indexOf('rut') : h.indexOf('rut estudiante');
              var filas = rows.slice(idx).filter(function (r, i) { return i === 0 || String(r[cr]).trim(); });
              if (filas.length > 1) lotes.push({ hoja: n, filas: filas, columnas: rows[idx].filter(function (x) { return String(x).trim(); }).length });
            });
            el.querySelector('#prev').innerHTML = lotes.length ? '<div class="card" style="padding:14px"><b>📄 ' + esc(file.name) + '</b><ul style="margin:6px 0 0">' +
              lotes.map(function (l) { return '<li>Hoja «' + esc(l.hoja) + '»: <b>' + (l.filas.length - 1) + '</b> estudiantes · ' + l.columnas + ' columnas</li>'; }).join('') + '</ul></div>' :
              '<div class="badge b-red">No se encontró una hoja con la columna «Rut» o «RUT estudiante».</div>';
          } catch (e) { UI.toast('No se pudo leer el archivo: ' + e.message, 'bad'); }
        }
      }
    }).then(async function (r) {
      if (!r) return;
      await UI.success('Base de datos cargada',
        '<b>' + r.creadas + '</b> estudiantes nuevos · <b>' + r.actualizadas + '</b> fichas actualizadas<br>' + r.sinCambios + ' sin cambios · ' + r.omitidas + ' omitidas (ya existían)' +
        (r.conflictos ? '<br>⚠️ ' + r.conflictos + ' N° de matrícula repetidos no se aplicaron.' : '') +
        (r.ignoradas.length ? '<br><span class="small">Columnas no reconocidas (no se cargaron): ' + esc(r.ignoradas.join(', ')) + '</span>' : ''));
      ir('fichas');
    });
  }
  /* modo: 'una' (una hoja) · 'ciclo' (una hoja por ciclo) · 'nivel' · 'anterior' (una hoja por curso de procedencia) */
  function exportarExcel(lista, modo, campos, nombre) {
    campos = campos || S.form.campos;
    var anio = S.form.config.anio;
    var head = ['N° matrícula', 'Nivel ' + anio, 'Ciclo', 'Curso de procedencia', 'RUT estudiante', 'Estado'].concat(campos.map(function (c) { return CoreUtil.etiquetaExport(c, campos); }),
      ['Fecha envío familia', 'Última actualización familia', 'Matriculado por', 'RUT funcionario', 'Fecha matrícula', 'Última modificación', 'Modificado por']);
    function fila(f) {
      return [f.numeroMatricula || '', f.curso, CoreUtil.cicloDe(f.curso), f.cursoAnterior || '', f.rut, S.form.estados[f.estado] || f.estado].concat(campos.map(function (c) { return f[c.id] || ''; }),
        [f.fechaEnvio || '', f.fechaActualizacion || '', f.matriculadoPorNombre || '', f.matriculadoPorRut || '', f.fechaMatricula || '', f.ultimaModificacion || '', f.modificadoPor || '']);
    }
    var grupos = {}, orden = [];
    lista.forEach(function (f) {
      var g = modo === 'ciclo' ? CoreUtil.cicloDe(f.curso) : modo === 'nivel' ? f.curso : modo === 'anterior' ? (f.cursoAnterior || 'Nuevos') : 'Fichas';
      if (!grupos[g]) { grupos[g] = []; orden.push(g); }
      grupos[g].push(f);
    });
    var wb = XLSX.utils.book_new(), usados = {};
    orden.forEach(function (g) {
      var ws = XLSX.utils.aoa_to_sheet([head].concat(grupos[g].map(fila)));
      ws['!cols'] = head.map(function (h, i) { return { wch: i < 6 ? 16 : Math.min(Math.max(String(h).length, 12), 30) }; });
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: grupos[g].length, c: head.length - 1 } }) };
      var n = String(g).replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 28), k = n, i = 2;
      while (usados[k]) k = n + ' ' + (i++);
      usados[k] = 1;
      XLSX.utils.book_append_sheet(wb, ws, k);
    });
    if (!orden.length) return UI.toast('No hay fichas para exportar', 'bad');
    XLSX.writeFile(wb, (nombre || 'Fichas_Matricula_' + anio) + '.xlsx');
    UI.toast('⬇ Archivo descargado: ' + lista.length + ' fichas', 'ok');
  }

  async function descargarBase() {
    var adm = await UI.intentar(function () { return UI.api('datosAdmin'); }, 'Preparando…');
    if (!adm) return;
    var ciclos = [], niveles = S.form.niveles, anteriores = [];
    fichas.forEach(function (f) {
      var c = CoreUtil.cicloDe(f.curso); if (ciclos.indexOf(c) < 0) ciclos.push(c);
      if (f.cursoAnterior && anteriores.indexOf(f.cursoAnterior) < 0) anteriores.push(f.cursoAnterior);
    });
    anteriores.sort(function (a, b) { return S.form.cursos.indexOf(a) - S.form.cursos.indexOf(b); });
    function checks(name, lista) { return '<div class="grid-3" style="gap:6px 14px;background:var(--sky-2);padding:12px;border-radius:12px">' + lista.map(function (x) { return '<label class="check" style="font-weight:600"><input type="checkbox" data-' + name + ' value="' + esc(x) + '" checked>' + esc(x) + '</label>'; }).join('') + '</div>'; }
    UI.modal({
      title: '⬇ Descargar base de datos', size: 'wide',
      html: '<p class="muted" style="margin-top:0">Descargue todas las fichas con todos sus datos en Excel. Elija qué incluir y cómo separarlas.</p>' +
        '<label>¿Qué fichas incluir?</label><div class="opt-cards" style="margin-bottom:14px">' +
        '<label class="opt-card"><input type="radio" name="dl-a" value="todo" checked><span>Toda la base<small>' + fichas.length + ' fichas</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="dl-a" value="ciclo"><span>Por ciclo<small>Elija los ciclos</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="dl-a" value="nivel"><span>Por nivel / curso<small>Elija niveles o cursos</small></span></label></div>' +
        '<div id="dl-ciclo" class="hidden" style="margin-bottom:14px"><label>Ciclos</label>' + checks('ci', ciclos) + '</div>' +
        '<div id="dl-nivel" class="hidden" style="margin-bottom:14px"><label>Niveles ' + esc(S.form.config.anio) + '</label>' + checks('ni', niveles) +
        (anteriores.length ? '<label style="margin-top:10px">…o cursos de procedencia</label>' + checks('an', anteriores).replace(/ checked/g, '') : '') + '</div>' +
        '<label>¿Cómo separar el archivo?</label><div class="opt-cards">' +
        '<label class="opt-card"><input type="radio" name="dl-m" value="una" checked><span>Una sola hoja<small>Todo en una tabla</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="dl-m" value="ciclo"><span>Una hoja por ciclo<small>Preescolar, 1° y 2° ciclo, Media</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="dl-m" value="nivel"><span>Una hoja por nivel<small>Un curso por pestaña</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="dl-m" value="anterior"><span>Una hoja por curso de procedencia<small>Ej.: 1° Básico A, 1° Básico B</small></span></label></div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" id="dl-inact"> <span>Incluir también datos ocultos o eliminados del formulario</span></label>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: '⬇ Descargar Excel', cls: 'ok', onClick: function (el) {
          var a = el.querySelector('[name=dl-a]:checked').value, m = el.querySelector('[name=dl-m]:checked').value;
          var val = function (n) { return UI.$$('[data-' + n + ']:checked', el).map(function (x) { return x.value; }); };
          var lista = fichas.slice(), sufijo = '';
          if (a === 'ciclo') { var cs = val('ci'); lista = lista.filter(function (f) { return cs.indexOf(CoreUtil.cicloDe(f.curso)) >= 0; }); sufijo = '_' + cs.join('_'); }
          if (a === 'nivel') {
            var ns = val('ni'), as = val('an');
            lista = lista.filter(function (f) { return ns.indexOf(f.curso) >= 0 || as.indexOf(f.cursoAnterior) >= 0; });
            sufijo = '_seleccion';
          }
          if (!lista.length) { UI.toast('No hay fichas con esa selección', 'bad'); return false; }
          var campos = el.querySelector('#dl-inact').checked ? adm.campos : S.form.campos;
          exportarExcel(lista, m, campos, ('Base_Matricula_' + S.form.config.anio + sufijo).replace(/[^\wÁÉÍÓÚáéíóúÑñ]+/g, '_').slice(0, 80));
          return true;
        }
      }],
      onOpen: function (el) {
        el.addEventListener('change', function () {
          var a = el.querySelector('[name=dl-a]:checked').value;
          el.querySelector('#dl-ciclo').classList.toggle('hidden', a !== 'ciclo');
          el.querySelector('#dl-nivel').classList.toggle('hidden', a !== 'nivel');
        });
      }
    });
  }

  /* El Equipo de Gestión habilita la edición (familia / funcionarios) sin borrar lo ya registrado. */
  function modalHabilitar(f) {
    var anio = S.form.config.anio, secs = UI.secciones(S.form.campos), ciclos = [], anteriores = [];
    fichas.forEach(function (x) {
      var c = CoreUtil.cicloDe(x.curso); if (ciclos.indexOf(c) < 0) ciclos.push(c);
      if (x.cursoAnterior && anteriores.indexOf(x.cursoAnterior) < 0) anteriores.push(x.cursoAnterior);
    });
    anteriores.sort(function (a, b) { return S.form.cursos.indexOf(a) - S.form.cursos.indexOf(b); });
    var CONTACTO = ['est_direccion', 'est_comuna', 'apo_celular', 'apo_email', 'apo_direccion', 'apo_comuna', 'sup_nombre', 'sup_rut', 'sup_parentesco', 'sup_celular', 'sal_emergencia_nombre', 'sal_emergencia_telefono'];
    UI.modal({
      title: '🔓 Habilitar edición de datos' + (f ? ' · ' + esc(nombreCompleto(f)) : ''), size: 'wide',
      html: '<p class="muted" style="margin-top:0">Los datos ya registrados <b>se conservan</b>: solo se permite modificarlos. Útil cuando las familias cambian de dirección, teléfono, correo o apoderado/a suplente.</p>' +
        '<label>¿Quién podrá editar?</label><div class="opt-cards" style="margin-bottom:16px">' +
        '<label class="opt-card"><input type="radio" name="hb-p" value="familia" checked><span>👨‍👩‍👧 Familia<small>Edita desde su acceso</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="hb-p" value="funcionarios"><span>🧑‍🏫 Funcionarios<small>Docentes y asistentes asignados</small></span></label>' +
        '<label class="opt-card"><input type="radio" name="hb-p" value="ambos"><span>👥 Ambos<small>Familia y funcionarios</small></span></label></div>' +
        (f ? '' : '<label>¿A qué fichas?</label><div class="grid" style="margin-bottom:16px"><div class="field"><select id="hb-al"><option value="todos">Todo el establecimiento (' + fichas.length + ' fichas)</option><option value="ciclo">Un ciclo</option><option value="nivel">Un nivel ' + esc(anio) + '</option><option value="cursoAnterior">Un curso de procedencia</option></select></div>' +
          '<div class="field"><select id="hb-v" class="hidden"></select></div></div>') +
        '<div id="hb-datos"><label>¿Qué datos se pueden actualizar? <span class="small muted">(solo aplica a la familia)</span></label><div class="row" style="margin-bottom:10px">' +
        '<div class="seg" id="hb-modo"><button data-m="sel" class="active">Datos seleccionados</button><button data-m="todos">Todos los datos</button></div>' +
        '<button class="btn sm ghost" id="hb-contacto">📍 Marcar datos de contacto y domicilio</button><button class="btn sm ghost" id="hb-ninguno">Desmarcar todo</button></div>' +
        '<div class="campo-picks" id="hb-picks">' + secs.map(function (s) {
          var cs = s.campos.filter(function (c) { return UI.si(c.editableFamilia); });
          if (!cs.length) return '';
          return '<div class="sec">' + esc(s.nombre) + '</div>' + cs.map(function (c) { return '<label class="check" style="font-weight:600"><input type="checkbox" data-cp value="' + esc(c.id) + '"' + (CONTACTO.indexOf(c.id) >= 0 ? ' checked' : '') + '>' + esc(c.etiqueta) + '</label>'; }).join('');
        }).join('') + '</div></div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: '🔓 Habilitar edición', cls: 'gold', onClick: async function (el) {
          var para = el.querySelector('[name=hb-p]:checked').value, modo = el.querySelector('#hb-modo .active').dataset.m;
          var campos = modo === 'todos' ? 'TODOS' : UI.$$('[data-cp]:checked', el).map(function (x) { return x.value; });
          if (para !== 'funcionarios' && campos !== 'TODOS' && !campos.length) { UI.toast('Marque al menos un dato o elija «Todos los datos»', 'bad'); return false; }
          var p = f ? { alcance: 'ficha', valor: f.rut } : { alcance: el.querySelector('#hb-al').value, valor: el.querySelector('#hb-v').value };
          p.para = para; p.campos = campos;
          if (!f && p.alcance === 'todos' && !await UI.confirm('¿Habilitar en todo el establecimiento?', 'Se habilitará la edición en <b>' + fichas.length + '</b> fichas.', 'Sí, habilitar')) return false;
          try { return await UI.api('habilitarEdicion', p); } catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }],
      onOpen: function (el) {
        var modo = el.querySelector('#hb-modo');
        modo.onclick = function (e) {
          var b = e.target.closest('[data-m]'); if (!b) return;
          UI.$$('button', modo).forEach(function (x) { x.classList.toggle('active', x === b); });
          el.querySelector('#hb-picks').style.opacity = b.dataset.m === 'todos' ? .4 : 1;
          el.querySelector('#hb-picks').style.pointerEvents = b.dataset.m === 'todos' ? 'none' : '';
        };
        el.querySelector('#hb-contacto').onclick = function () { UI.$$('[data-cp]', el).forEach(function (x) { if (CONTACTO.indexOf(x.value) >= 0) x.checked = true; }); };
        el.querySelector('#hb-ninguno').onclick = function () { UI.$$('[data-cp]', el).forEach(function (x) { x.checked = false; }); };
        el.addEventListener('change', function (e) {
          if (e.target.name === 'hb-p') el.querySelector('#hb-datos').classList.toggle('hidden', e.target.value === 'funcionarios');
        });
        var al = el.querySelector('#hb-al');
        if (al) al.onchange = function () {
          var v = el.querySelector('#hb-v'), l = al.value === 'ciclo' ? ciclos : al.value === 'nivel' ? S.form.niveles : al.value === 'cursoAnterior' ? anteriores : [];
          v.classList.toggle('hidden', !l.length);
          v.innerHTML = l.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
        };
      }
    }).then(async function (r) {
      if (!r) return;
      await UI.success('Edición habilitada', 'Se habilitó la edición en <b>' + r.fichas + '</b> ficha' + (r.fichas === 1 ? '' : 's') + '. Las familias verán un aviso con los datos que deben actualizar; al enviarlos, la ficha vuelve a cerrarse automáticamente.');
      if (f && r.ficha) { ed.f = r.ficha; actualizarLista(r.ficha); pintarEditor(); } else ir('fichas');
    });
  }

  /* ================================ EDITOR ================================ */
  async function vEditor(rut) {
    var f = await UI.api('obtenerFicha', { rut: rut });
    ed = { f: f, pend: {}, guardando: false };
    pintarEditor();
  }
  function pintarEditor() {
    var f = ed.f, anio = S.form.config.anio, puede = puedoEditar(f), mat = f.estado === 'matriculada';
    var estados = Object.keys(S.form.estados).filter(function (k) { return k !== 'desbloqueada' && (k !== 'matriculada' || mat); });
    var docs = S.form.documentos.filter(function (d) { return UI.si(d.requiereAceptacion); }), acc = f.aceptaciones || {};
    var abierta = f.editFamilia || f.editFuncionario;
    main().innerHTML = '<div class="page-h"><button class="btn ghost sm" data-e="volver">← Volver</button><div><div class="eyebrow">Ficha de matrícula ' + esc(anio) + (f.numeroMatricula ? ' · N° ' + esc(f.numeroMatricula) : '') + '</div><h2>' + esc(nombreCompleto(f)) + '</h2></div>' + UI.badgeEstado(f.estado) + marcasEdicion(f) + '</div>' +
      (mat && !puede ? '<div class="lock-banner" style="margin:0 0 18px"><div class="ico">🔒</div><div><b>Estudiante matriculado/a · N° ' + esc(f.numeroMatricula) + '</b><br><span class="muted">La ficha está cerrada. Puede verla, imprimirla y compartirla. Para modificar datos, el Equipo de Gestión debe habilitar la edición.</span></div></div>' : '') +
      (f.editFamilia ? '<div class="update-banner" style="margin:0 0 18px"><div class="ico">✏️</div><div><b class="t">Edición habilitada para la familia</b><br><span class="muted">' + (f.editFamilia === 'TODOS' ? 'Puede actualizar todos sus datos.' : 'Datos solicitados: ' + esc(S.form.campos.filter(function (c) { return f.editFamilia.split(',').indexOf(c.id) >= 0; }).map(function (c) { return c.etiqueta; }).join(', '))) + '</span></div></div>' : '') +
      '<section class="card"><div class="editor-meta">' +
      '<div><label for="m-num">N° de matrícula</label>' + (gestion() && mat ? '<input id="m-num" value="' + esc(f.numeroMatricula || '') + '">' : '<div class="meta-v num-mat" style="font-size:20px">' + esc(f.numeroMatricula || '— (se asigna al matricular)') + '</div>') + '</div>' +
      '<div><label>RUT estudiante</label><div class="meta-v">' + esc(f.rut) + '</div></div>' +
      '<div><label for="m-ant">Curso de procedencia</label>' + selAnterior('m-ant', f.cursoAnterior || '', !puede) + '</div>' +
      '<div><label for="m-curso">Nivel al que se matricula (' + esc(anio) + ')</label>' + selNivel('m-curso', f.curso, !puede) + '</div>' +
      '<div><label for="m-estado">Estado</label><select id="m-estado"' + (puede && (!mat || gestion()) ? '' : ' disabled') + '>' + estados.map(function (k) { return '<option value="' + k + '"' + (k === f.estado ? ' selected' : '') + '>' + esc(S.form.estados[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Clave de la familia</label><div class="meta-v">' + (f.claveCambiada ? 'Personalizada' : 'Inicial (fecha de nacimiento)') + (UI.si(f.debeCambiarClave) ? ' · <span class="badge b-gold">cambio solicitado</span>' : '') + '</div></div>' +
      '<div><label>Enviada por la familia</label><div class="meta-v">' + esc(f.fechaEnvio || '—') + (f.fechaActualizacion ? '<div class="small muted">Actualizada: ' + esc(f.fechaActualizacion) + '</div>' : '') + '</div></div>' +
      '<div><label>Última modificación</label><div class="meta-v">' + esc(f.ultimaModificacion || '—') + '<div class="small muted">' + esc(f.modificadoPor || '') + '</div></div></div>' +
      '<div style="grid-column:1/-1"><label>Matrícula registrada por</label><div class="meta-v">' + (f.matriculadoPorNombre ? esc(f.matriculadoPorNombre) + ' · RUT ' + esc(f.matriculadoPorRut) + ' · ' + esc(f.fechaMatricula) : '— (pendiente)') + '</div></div>' +
      '</div></section><div id="ed-form" style="margin-top:18px">' + UI.formHtml(S.form.campos, f, function () { return puede; }) + '</div>' +
      '<section class="card" style="margin-top:18px"><div class="card-h"><div class="sec-num">📚</div><h3>Toma de conocimiento de documentos</h3></div>' +
      '<p class="muted small" style="margin-top:-6px">Si la familia firma de forma presencial, puede marcar aquí la toma de conocimiento (quedará registrada con su nombre).</p>' +
      docs.map(function (d) {
        var a = acc[d.id];
        return '<label class="check" style="margin-bottom:10px" data-wrap="doc:' + esc(d.id) + '"><input type="checkbox" data-acc="' + esc(d.id) + '"' + (a ? ' checked' : '') + (puede ? '' : ' disabled') + '><span>' + esc(d.titulo) +
          (a ? ' <span class="small muted">— ' + esc(a.fecha || '') + ' · ' + esc(a.por || '') + '</span>' : '') + '</span></label>';
      }).join('') + '</section>' +
      '<div class="actionbar"><span class="autosave" id="autosave"><span class="dot"></span><span class="txt">' + (puede ? 'Guardado automático activado' : 'Solo lectura') + '</span></span><span class="grow"></span>' +
      (puede ? '<button class="btn" data-e="guardar">💾 Guardar cambios</button>' : '') +
      (!mat ? '<button class="btn ok" data-e="matricular">✅ Cerrar matrícula</button>' : '') +
      '<button class="btn ghost" data-e="imprimir">🖨 Imprimir</button><button class="btn ghost" data-e="pdf">⬇ PDF</button><button class="btn wa" data-e="wa">💬 WhatsApp</button>' +
      (gestion() ? '<button class="btn gold" data-e="habilitar">🔓 Habilitar edición</button>' + (abierta ? '<button class="btn ghost" data-e="cerrar-edicion">🔒 Cerrar edición</button>' : '') : '') +
      '<button class="btn ghost" data-e="clave">🔑 Clave familia</button>' +
      (gestion() ? '<button class="btn bad" data-e="eliminar" title="Eliminar ficha">🗑</button>' : '') + '</div>';
    UI.enlazar(UI.$('#ed-form'), function (id) {
      var d = UI.leer(UI.$('#ed-form'));
      ed.pend[id] = d[id]; ed.f[id] = d[id];
      marcar('saving', 'Guardando…'); programar();
    });
    UI.$('#m-curso').onchange = function () { guardarMeta({ curso: this.value }, 'Nivel ' + anio + ' actualizado'); };
    UI.$('#m-ant').onchange = function () { guardarMeta({ cursoAnterior: this.value }, 'Curso de procedencia actualizado'); };
    UI.$('#m-estado').onchange = function () { guardarMeta({ estado: this.value }, 'Estado actualizado'); };
    var num = UI.$('#m-num'); if (num) num.onchange = function () { guardarMeta({ numeroMatricula: this.value }, 'N° de matrícula actualizado'); };
    main().onclick = clickEditor;
    main().onchange = function (e) {
      var c = e.target.closest('[data-acc]'); if (!c) return;
      var a = {}; a[c.dataset.acc] = c.checked;
      guardarMeta({ aceptaciones: a }, c.checked ? 'Toma de conocimiento registrada' : 'Toma de conocimiento quitada');
    };
  }  function marcar(estado, txt) {
    var el = UI.$('#autosave'); if (!el) return;
    el.className = 'autosave ' + estado; el.querySelector('.txt').textContent = txt;
  }
  var programar = UI.debounce(function () { guardarAuto(); }, 1200);
  async function guardarAuto() {
    if (!ed) return;
    if (ed.guardando) { programar(); return; }
    var datos = ed.pend;
    if (!Object.keys(datos).length) return;
    ed.pend = {}; ed.guardando = true;
    try {
      var f = await UI.api('guardarFicha', { rut: ed.f.rut, datos: datos, auto: true });
      actualizarLista(f);
      if (ed) { ed.f.ultimaModificacion = f.ultimaModificacion; marcar('saved', '✓ Guardado automáticamente · ' + String(f.ultimaModificacion).slice(11)); }
    } catch (e) {
      if (ed) { ed.pend = Object.assign({}, datos, ed.pend); marcar('error', '⚠ ' + (e.userMsg || e.message)); }
      if (e.red) setTimeout(programar, 5000);
    } finally { if (ed) ed.guardando = false; }
  }
  async function vaciar() { for (var i = 0; i < 40 && ed && ed.guardando; i++) await UI.sleep(150); await guardarAuto(); }
  function actualizarLista(f) {
    var i = fichas.findIndex(function (x) { return x.rut === f.rut; });
    if (i >= 0) fichas[i] = f; else fichas.push(f);
  }
  async function guardarMeta(extra, msg) {
    await vaciar();
    var p = Object.assign({ rut: ed.f.rut, datos: {} }, extra);
    var f = await UI.intentar(function () { return UI.api('guardarFicha', p); }, 'Guardando…');
    if (!f) { pintarEditor(); return; }
    ed.f = f; actualizarLista(f); pintarEditor(); UI.toast('✓ ' + msg, 'ok');
  }
  async function clickEditor(e) {
    var b = e.target.closest('[data-e]'); if (!b) return;
    var a = b.dataset.e, f = ed.f;
    if (a === 'volver') return ir('fichas', false);
    if (['imprimir', 'pdf', 'wa', 'guardar', 'matricular'].indexOf(a) >= 0) await vaciar();
    f = ed.f;
    if (a === 'imprimir') return Doc.imprimir([f]);
    if (a === 'pdf') return Doc.descargar(f);
    if (a === 'wa') return Doc.whatsapp(f);
    var root = UI.$('#ed-form');
    if (a === 'guardar') {
      var falta = UI.validar(S.form.campos, UI.leer(root), false);
      UI.marcarErrores(root, falta);
      if (falta.length) return UI.faltantes(falta, function (it) { UI.resaltar(it.id); }, 'Cambios guardados, pero faltan datos obligatorios');
      return UI.success('¡Cambios guardados!', 'La ficha de <b>' + esc(nombreCompleto(f)) + '</b> quedó actualizada correctamente.');
    }
    if (a === 'matricular') {
      var falta2 = UI.validar(S.form.campos, UI.leer(root), false);
      UI.marcarErrores(root, falta2);
      if (falta2.length) return UI.faltantes(falta2, function (it) { UI.resaltar(it.id); }, 'No se puede cerrar la matrícula');
      var sug = await UI.intentar(function () { return UI.api('siguienteNumero'); }, 'Preparando…');
      if (sug === undefined) return;
      var anio = S.form.config.anio;
      var r = await UI.modal({
        title: '✅ Cerrar proceso de matrícula', size: 'wide',
        html: '<div class="grid"><div class="field"><label>N° de matrícula<span class="req">*</span></label><input id="mt-num" value="' + esc(sug) + '" style="font-size:22px;font-family:var(--font-d);font-weight:700">' +
          '<small class="help">Sugerido automáticamente (el siguiente disponible). Puede cambiarlo.</small></div>' +
          '<div class="field"><label>Estudiante</label><div class="meta-v" style="padding-top:8px">' + esc(nombreCompleto(f)) + '<div class="small muted">RUT ' + esc(f.rut) + '</div></div></div>' +
          '<div class="field"><label>Curso de procedencia</label><div class="meta-v">' + esc(f.cursoAnterior || 'Estudiante nuevo') + '</div></div>' +
          '<div class="field"><label>Se matricula en (' + esc(anio) + ')</label><div class="meta-v">' + esc(f.curso || '—') + '</div></div></div>' +
          '<div class="hint" style="margin-top:16px;background:var(--ok-bg);border-left:4px solid var(--ok);padding:10px 12px;border-radius:8px">Quedará registrado que <b>' + esc(P.nombre) + '</b> (RUT ' + esc(P.rut) + ') realizó la matrícula. Su nombre y RUT aparecerán en el espacio de firma del documento oficial, y la ficha quedará cerrada.</div>',
        buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
          text: '✅ Matricular', cls: 'ok', onClick: async function (el) {
            var n = el.querySelector('#mt-num').value.trim();
            if (!n) { UI.toast('Ingrese el N° de matrícula', 'bad'); return false; }
            if (!f.curso) { UI.toast('Primero seleccione el nivel al que se matricula', 'bad'); return false; }
            try { return await UI.api('registrarMatricula', { rut: f.rut, numero: n }); } catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
          }
        }]
      });
      if (!r) return;
      if (!r.matriculado) { UI.marcarErrores(root, r.faltantes); return UI.faltantes(r.faltantes, function (it) { UI.resaltar(it.id); }, 'No se puede cerrar la matrícula'); }
      ed.f = r.ficha; actualizarLista(r.ficha); pintarEditor();
      var imp = await UI.modal({
        center: true, title: '¡Matrícula N° ' + esc(r.ficha.numeroMatricula) + ' registrada!',
        iconHtml: '<div class="m-icon success"><svg class="checkmark" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-16"/></svg></div>',
        html: '<p class="muted" style="font-size:15.5px"><b>' + esc(nombreCompleto(f)) + '</b> quedó matriculado/a en <b>' + esc(r.ficha.curso) + '</b>.<br>¿Desea imprimir la ficha para las firmas?</p>',
        buttons: [{ text: 'Más tarde', cls: 'ghost', value: false }, { text: '🖨 Imprimir ficha', cls: 'ok', value: true }]
      });
      if (imp) Doc.imprimir([ed.f]);
      return;
    }
    if (a === 'habilitar') return modalHabilitar(f);
    if (a === 'cerrar-edicion') {
      if (!await UI.confirm('¿Cerrar la edición?', 'La familia y los funcionarios ya no podrán modificar la ficha. Los datos se conservan.', 'Cerrar edición')) return;
      var rc = await UI.intentar(function () { return UI.api('cerrarEdicion', { alcance: 'ficha', valor: f.rut }); }, 'Cerrando…');
      if (!rc) return;
      ed.f = rc.ficha; actualizarLista(rc.ficha); pintarEditor();
      return UI.toast('🔒 Edición cerrada', 'ok');
    }    if (a === 'clave') {
      var r2 = await UI.modal({
        title: '🔑 Clave de acceso de la familia',
        html: '<p class="muted" style="margin-top:0">La familia ingresa con el RUT del estudiante (<b>' + esc(f.rut) + '</b>). La clave inicial es la fecha de nacimiento: <b>' + esc(UI.fechaLarga(f.est_fecha_nacimiento).replace(/\//g, '')) + '</b>.</p>' +
          '<label class="check"><input type="checkbox" id="k-rest"' + (f.claveCambiada ? '' : ' disabled') + '><span>Restablecer la clave a la fecha de nacimiento' + (f.claveCambiada ? '' : ' <span class="small muted">(ya usa la clave inicial)</span>') + '</span></label>' +
          '<label class="check" style="margin-top:10px"><input type="checkbox" id="k-forzar"' + (UI.si(f.debeCambiarClave) ? ' checked' : '') + '><span>Solicitar que la familia cree una clave nueva al ingresar</span></label>',
        buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, { text: 'Aplicar', cls: '', onClick: function (el) { return { restablecer: el.querySelector('#k-rest').checked, forzarCambio: el.querySelector('#k-forzar').checked }; } }]
      });
      if (!r2) return;
      var f3 = await UI.intentar(function () { return UI.api('claveFamilia', Object.assign({ rut: f.rut }, r2)); }, 'Actualizando…');
      if (!f3) return;
      ed.f = f3; actualizarLista(f3); pintarEditor();
      return UI.success('Clave actualizada', r2.restablecer ? 'La clave volvió a ser la fecha de nacimiento del estudiante.' : 'Configuración de clave actualizada.');
    }
    if (a === 'eliminar') {
      var ok3 = await UI.confirm('¿Eliminar esta ficha?', 'Se eliminará definitivamente la ficha de <b>' + esc(nombreCompleto(f)) + '</b>. Si el estudiante se retiró, se recomienda cambiar el estado a «Retirado/a» en lugar de eliminar.', 'Eliminar', 'bad', 'warning');
      if (!ok3) return;
      var r3 = await UI.intentar(function () { return UI.api('eliminarFicha', { rut: f.rut }); }, 'Eliminando…');
      if (!r3) return;
      fichas = fichas.filter(function (x) { return x.rut !== f.rut; });
      ed = null; UI.toast('Ficha eliminada', 'ok'); ir('fichas', false);
    }
  }

  /* ============================== ESTADÍSTICAS ============================== */
  async function vStats() {
    var st = await UI.api('estadisticas'), T = sumar(st.cursos);
    function pct(c) { var act = c.total - c.retirado; return act ? Math.round(c.matriculada * 100 / act) : 0; }
    function barra(c) {
      var act = c.total - c.retirado || 1;
      return '<div class="bar" title="' + pct(c) + '% matriculado"><i class="m" style="width:' + (c.matriculada * 100 / act) + '%"></i><i class="e" style="width:' + ((c.enviada + c.desbloqueada) * 100 / act) + '%"></i><i class="p" style="width:' + (c.en_proceso * 100 / act) + '%"></i></div>';
    }
    function fila(c, cls, nombre) {
      return '<tr class="' + (cls || '') + '"><td>' + esc(nombre || c.curso) + '</td><td><b>' + (c.total - c.retirado) + '</b></td><td>' + c.pendiente + '</td><td>' + c.en_proceso + '</td><td>' + (c.enviada + c.desbloqueada) + '</td><td>' + c.matriculada +
        '</td><td>' + c.retirado + '</td><td class="hide-sm">' + c.mujeres + '</td><td class="hide-sm">' + c.hombres + '</td><td><div class="row" style="flex-wrap:nowrap;gap:8px">' + barra(c) + '<span class="small">' + pct(c) + '%</span></div></td></tr>';
    }
    var head = '<thead><tr><th>Curso</th><th>Estudiantes</th><th>Sin iniciar</th><th>En proceso</th><th>Enviadas</th><th>Matriculados</th><th>Retirados</th><th class="hide-sm">Mujeres</th><th class="hide-sm">Hombres</th><th>Avance</th></tr></thead>';
    var resumen = st.ciclos.map(function (ci) { var cs = st.cursos.filter(function (c) { return c.ciclo === ci; }); return cs.length ? fila(sumar(cs), '', ci) : ''; }).join('');
    var h = '<div class="page-h"><h2>Resumen estadístico de matrícula ' + esc(S.form.config.anio) + '</h2><span class="grow"></span><button class="btn ghost" id="st-xls">⬇ Exportar resumen</button></div>' +
      '<div class="kpis"><div class="kpi k1"><span class="i">🎒</span><div class="v">' + (T.total - T.retirado) + '</div><div class="l">Estudiantes vigentes</div></div>' +
      '<div class="kpi k2"><span class="i">✅</span><div class="v">' + T.matriculada + '</div><div class="l">Matriculados (' + pct(T) + '%)</div></div>' +
      '<div class="kpi k3"><span class="i">📨</span><div class="v">' + (T.enviada + T.desbloqueada) + '</div><div class="l">Fichas enviadas por familias</div></div>' +
      '<div class="kpi k4"><span class="i">⏳</span><div class="v">' + (T.pendiente + T.en_proceso) + '</div><div class="l">Pendientes / en proceso</div></div></div>' +
      '<div class="legend" style="margin-bottom:14px"><span><i style="background:var(--ok)"></i>Matriculados</span><span><i style="background:var(--blue-2)"></i>Enviadas por familia</span><span><i style="background:#f0b429"></i>En proceso</span><span><i style="background:#e9eef7"></i>Sin iniciar</span></div>' +
      '<section class="card ciclo-card" style="padding:0;overflow:hidden"><div class="curso-h"><h3>Resumen por ciclo</h3></div><div class="table-wrap"><table class="t">' + head.replace('Curso', 'Ciclo') + '<tbody>' + resumen + fila(T, 'total', 'TOTAL ESTABLECIMIENTO') + '</tbody></table></div></section>';
    st.ciclos.forEach(function (ci) {
      var cs = st.cursos.filter(function (c) { return c.ciclo === ci; });
      if (!cs.length) return;
      var niveles = [];
      cs.forEach(function (c) { var n = niveles.filter(function (x) { return x.nivel === c.nivel; })[0]; if (!n) { n = { nivel: c.nivel, cursos: [] }; niveles.push(n); } n.cursos.push(c); });
      var cuerpo = niveles.map(function (n) {
        return n.cursos.map(function (c) { return fila(c); }).join('') + (n.cursos.length > 1 ? fila(sumar(n.cursos), 'subtotal', 'Subtotal ' + n.nivel) : '');
      }).join('');
      h += '<section class="card ciclo-card" style="padding:0;overflow:hidden"><div class="curso-h"><span class="tag" style="background:' + COLOR_CICLO[ci] + ';padding:4px 12px;border-radius:999px;color:#fff;font-weight:800">' + esc(ci) + '</span>' +
        '<span class="muted small">' + cs.length + ' cursos · ' + niveles.length + ' niveles</span></div><div class="table-wrap"><table class="t">' + head + '<tbody>' + cuerpo + fila(sumar(cs), 'total', 'Total ' + ci) + '</tbody></table></div></section>';
    });
    main().innerHTML = h;
    UI.$('#st-xls').onclick = function () {
      var rows = [['Ciclo', 'Nivel', 'Curso', 'Estudiantes vigentes', 'Sin iniciar', 'En proceso', 'Enviadas', 'Matriculados', 'Retirados', 'Mujeres', 'Hombres', '% avance']];
      st.cursos.forEach(function (c) { rows.push([c.ciclo, c.nivel, c.curso, c.total - c.retirado, c.pendiente, c.en_proceso, c.enviada + c.desbloqueada, c.matriculada, c.retirado, c.mujeres, c.hombres, pct(c)]); });
      rows.push(['TOTAL', '', '', T.total - T.retirado, T.pendiente, T.en_proceso, T.enviada + T.desbloqueada, T.matriculada, T.retirado, T.mujeres, T.hombres, pct(T)]);
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Resumen');
      XLSX.writeFile(wb, 'Resumen_Matricula_' + S.form.config.anio + '.xlsx');
    };
  }
  function sumar(lista) {
    var t = { total: 0, pendiente: 0, en_proceso: 0, enviada: 0, desbloqueada: 0, matriculada: 0, retirado: 0, mujeres: 0, hombres: 0 };
    lista.forEach(function (c) { for (var k in t) t[k] += c[k] || 0; });
    return t;
  }

  /* ================================ USUARIOS ================================ */
  var usuarios = [];
  // Tarjeta con usuario y clave para mostrar al Equipo de Gestión cuando el correo no se envió.
  function tarjetaClave(usuario, clave) {
    return '<div style="text-align:left;background:#fbf7ec;border:2px dashed var(--sand);border-radius:14px;padding:16px 18px;margin-top:14px">' +
      '<div class="eyebrow" style="color:#8a6a1f">🔑 Datos de acceso para entregar</div>' +
      '<div class="small muted" style="margin-top:10px">Usuario</div><div class="meta-v" style="word-break:break-all">' + esc(usuario) + '</div>' +
      '<div class="small muted" style="margin-top:10px">Clave</div><div class="row"><code style="font-size:22px;letter-spacing:3px;background:var(--ink);color:#fff;padding:8px 16px;border-radius:10px">' + esc(clave) + '</code>' +
      '<button class="btn sm ghost" onclick="navigator.clipboard && navigator.clipboard.writeText(\'' + esc(clave) + '\');this.textContent=\'✓ Copiada\'">Copiar</button></div>' +
      '<div class="small muted" style="margin-top:8px">Al ingresar, el sistema le pedirá crear una clave personal.</div></div>';
  }
  async function vUsuarios() {
    usuarios = await UI.api('listarUsuarios');
    var color = { gestion: 'b-gold', docente: 'b-blue', asistente: 'b-desbloqueada' };
    main().innerHTML = '<div class="page-h"><h2>Usuarios funcionarios</h2><span class="badge b-blue">' + usuarios.length + '</span><span class="grow"></span>' +
      '<button class="btn gold" data-u="nuevo">➕ Nuevo funcionario</button><button class="btn ghost" data-u="masivo">📥 Carga masiva (Excel)</button><button class="btn ghost" data-u="plantilla">⬇ Plantilla Excel</button></div>' +
      '<div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--sky)"><span class="small">📧 El <b>usuario</b> de cada funcionario es su <b>correo institucional</b>. La <b>clave se genera automáticamente y se envía a ese correo</b>; al ingresar por primera vez se le pide crear una clave personal. Docentes y asistentes solo ven, editan e imprimen las fichas asignadas.</span></div>' +
      '<section class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="t"><thead><tr><th>Nombre</th><th>Usuario (correo)</th><th class="hide-sm">RUT</th><th>Perfil</th><th>Asignación</th><th class="hide-sm hide-md">Último acceso</th><th></th></tr></thead><tbody>' +
      usuarios.map(function (u) {
        return '<tr' + (u.activo ? '' : ' style="opacity:.55"') + '><td class="name">' + esc(u.nombre) + (u.activo ? '' : ' <span class="badge b-gray">inactivo</span>') + '</td><td class="small" style="word-break:break-all">' + esc(u.email || '— sin correo —') + '</td><td class="hide-sm nowrap">' + esc(u.rut) + '</td>' +
          '<td><span class="badge ' + (color[u.rol] || 'b-gray') + '">' + esc(u.rolNombre) + '</span>' + (u.debeCambiarClave ? '<br><span class="small muted">clave inicial pendiente</span>' : '') + '</td><td class="small">' + (u.rol === 'gestion' ? '<span class="muted">Todas las fichas</span>' : esc(u.cursos.join(', ') || '—') + (u.fichas.length ? '<br><span class="muted">+ ' + u.fichas.length + ' fichas individuales</span>' : '')) + '</td>' +
          '<td class="hide-sm hide-md small muted">' + esc(u.ultimoAcceso || 'Nunca') + '</td><td><div class="acts"><button class="icon-btn" title="Editar" data-u="editar" data-id="' + esc(u.id) + '">✏️</button>' +
          '<button class="icon-btn" title="Enviar nueva clave" data-u="clave" data-id="' + esc(u.id) + '">🔑</button>' + (u.id !== P.id ? '<button class="icon-btn" title="Eliminar" data-u="eliminar" data-id="' + esc(u.id) + '">🗑</button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div></section>';
    main().onclick = clickUsuarios;
  }
  async function clickUsuarios(e) {
    var b = e.target.closest('[data-u]'); if (!b) return;
    var a = b.dataset.u, u = usuarios.filter(function (x) { return x.id === b.dataset.id; })[0];
    if (a === 'nuevo' || a === 'editar') return modalUsuario(u);
    if (a === 'plantilla') return plantillaFuncionarios();
    if (a === 'masivo') return cargaMasiva();
    if (a === 'clave') {
      if (!await UI.confirm('¿Enviar una nueva clave?', 'Se generará una clave nueva para <b>' + esc(u.nombre) + '</b> y se enviará a <b>' + esc(u.email || 'su correo') + '</b>. La clave anterior dejará de funcionar.', '📧 Generar y enviar')) return;
      var r = await UI.intentar(function () { return UI.api('restablecerClaveUsuario', { id: u.id }); }, 'Generando clave…');
      if (r) {
        await UI.success('Clave restablecida', r.correoEnviado ? '📧 La nueva clave fue enviada a <b>' + esc(r.usuario) + '</b>.' : 'No se pudo enviar el correo. Entregue estos datos personalmente:' + tarjetaClave(r.usuario, r.clave));
        vUsuarios();
      }
    }
    if (a === 'eliminar') {
      if (!await UI.confirm('¿Eliminar usuario?', 'Se eliminará la cuenta de <b>' + esc(u.nombre) + '</b>.', 'Eliminar', 'bad', 'warning')) return;
      if (await UI.intentar(function () { return UI.api('eliminarUsuario', { id: u.id }); }, 'Eliminando…')) { UI.toast('Usuario eliminado', 'ok'); vUsuarios(); }
    }
  }
  function modalUsuario(u) {
    u = u || { nombre: '', rut: '', email: '', rol: 'docente', cursos: [], fichas: [], activo: true };
    var cs = S.form.cursos;
    UI.modal({
      title: u.id ? '✏️ Editar funcionario' : '➕ Nuevo funcionario', size: 'wide',
      html: '<div class="grid"><div class="field"><label>Correo institucional (será su usuario)<span class="req">*</span></label><input id="u-mail" type="email" value="' + esc(u.email) + '" placeholder="nombre@colegio.cl"></div>' +
        '<div class="field"><label>Nombre completo<span class="req">*</span></label><input id="u-nom" value="' + esc(u.nombre) + '" placeholder="Nombre Apellido Apellido"></div>' +
        '<div class="field"><label>RUT (aparece en la firma de matrícula)<span class="req">*</span></label><input id="u-rut" value="' + esc(u.rut) + '" placeholder="12345678-9"></div>' +
        '<div class="field"><label>Perfil<span class="req">*</span></label><select id="u-rol"><option value="docente">Docente</option><option value="asistente">Asistente de Educación</option><option value="gestion">Equipo de Gestión</option></select></div>' +
        '<div class="field full" id="u-asig"><label>Cursos de procedencia asignados (ej.: su jefatura actual)</label><div class="grid-3" style="gap:6px 14px;background:var(--sky-2);padding:12px;border-radius:10px">' +
        cs.map(function (c) { return '<label class="check" style="font-weight:600"><input type="checkbox" data-c value="' + esc(c) + '"' + (u.cursos.indexOf(c) >= 0 ? ' checked' : '') + '>' + esc(c) + '</label>'; }).join('') + '</div>' +
        '<label style="margin-top:12px">…o niveles ' + esc(S.form.config.anio) + ' asignados (ve todas las fichas que se matriculan en ese nivel)</label><div class="grid-3" style="gap:6px 14px;background:#fffaf0;padding:12px;border-radius:10px">' +
        S.form.niveles.filter(function (n) { return cs.indexOf(n) < 0; }).map(function (c) { return '<label class="check" style="font-weight:600"><input type="checkbox" data-c value="' + esc(c) + '"' + (u.cursos.indexOf(c) >= 0 ? ' checked' : '') + '>' + esc(c) + '</label>'; }).join('') + '</div></div>' +
        '<div class="field full" id="u-fich"><label>Fichas asignadas individualmente (RUT de estudiantes, separados por coma)</label><textarea id="u-fichas" rows="2" placeholder="Opcional. Ej.: 27123456-7, 27234567-8">' + esc(u.fichas.join(', ')) + '</textarea><small class="help">Útil para asignar un grupo específico de fichas a un/a asistente de la educación.</small></div>' +
        (u.id ? '<div class="field"><label class="check"><input type="checkbox" id="u-act"' + (u.activo ? ' checked' : '') + '> Usuario activo</label></div>' :
          '<div class="field full"><label class="check"><input type="checkbox" id="u-mailsend" checked> <span>📧 Generar una clave y enviarla al correo institucional (recomendado)</span></label></div>') + '</div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: u.id ? 'Guardar' : 'Crear cuenta', cls: 'ok', onClick: async function (el) {
          var d = { id: u.id, nombre: el.querySelector('#u-nom').value, rut: el.querySelector('#u-rut').value, email: el.querySelector('#u-mail').value, rol: el.querySelector('#u-rol').value,
            cursos: UI.$$('[data-c]:checked', el).map(function (x) { return x.value; }), fichas: el.querySelector('#u-fichas').value, activo: u.id ? el.querySelector('#u-act').checked : true };
          try { return await UI.api('guardarUsuario', { usuario: d, enviarCorreo: !u.id && el.querySelector('#u-mailsend').checked }); }
          catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }],
      onOpen: function (el) {
        var rol = el.querySelector('#u-rol'); rol.value = u.rol;
        function vis() { var g = rol.value === 'gestion'; el.querySelector('#u-asig').classList.toggle('hidden', g); el.querySelector('#u-fich').classList.toggle('hidden', g); }
        rol.onchange = vis; vis();
      }
    }).then(async function (r) {
      if (!r) return;
      if (u.id) await UI.success('Funcionario actualizado', 'Los cambios fueron guardados.');
      else await UI.success('Cuenta creada', r.correoEnviado ? '📧 Se envió un correo a <b>' + esc(r.usuario) + '</b> con su usuario y su clave.' : 'Entregue estos datos personalmente:' + tarjetaClave(r.usuario, r.clave));
      vUsuarios();
    });
  }
  function plantillaFuncionarios() {
    var ws = XLSX.utils.aoa_to_sheet([
      ['CORREO INSTITUCIONAL', 'NOMBRE COMPLETO', 'RUT', 'PERFIL', 'CURSOS ASIGNADOS', 'FICHAS ASIGNADAS (RUT ESTUDIANTES)'],
      ['maria.perez@colegio.cl', 'María José Pérez Soto', '12345678-5', 'Docente', '1° Básico A', ''],
      ['juan.rojas@colegio.cl', 'Juan Carlos Rojas Muñoz', '9876543-3', 'Asistente de Educación', 'Kinder A, PreKinder A', ''],
      ['ana.fuentes@colegio.cl', 'Ana Luisa Fuentes Díaz', '15111222-6', 'Equipo de Gestión', '', '']
    ]);
    ws['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 14 }, { wch: 24 }, { wch: 30 }, { wch: 36 }];
    var ins = XLSX.utils.aoa_to_sheet([['INSTRUCCIONES'], [''], ['1. Complete una fila por funcionario en la hoja «Funcionarios» (borre las filas de ejemplo).'],
      ['2. CORREO INSTITUCIONAL será el usuario de ingreso. La clave se genera automáticamente y se envía a ese correo.'], ['3. NOMBRE COMPLETO y RUT (con guion, ej. 12345678-9) aparecen en la firma de las fichas que matricule.'],
      ['4. PERFIL: escriba Docente, Asistente de Educación o Equipo de Gestión.'], ['5. CURSOS ASIGNADOS: separados por coma, escritos igual que en la lista de abajo (curso de procedencia o nivel).'],
      ['6. FICHAS ASIGNADAS: opcional, RUT de estudiantes separados por coma.'], ['7. Si el correo o el RUT ya existen, los datos se actualizan (la clave no cambia).'], [''], ['CURSOS DISPONIBLES']]
      .concat(S.form.cursos.map(function (c) { return [c]; })).concat([[''], ['NIVELES ' + S.form.config.anio]]).concat(S.form.niveles.map(function (c) { return [c]; })));
    ins['!cols'] = [{ wch: 100 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
    XLSX.utils.book_append_sheet(wb, ins, 'Instrucciones');
    XLSX.writeFile(wb, 'plantilla_funcionarios.xlsx');
  }
  function cargaMasiva() {
    var filas = [];
    UI.modal({
      title: '📥 Carga masiva de funcionarios', size: 'xwide',
      html: '<ol class="steps"><li><div>Descargue la <a href="#" id="pl-f">plantilla Excel</a> y complétela (una fila por funcionario, con su <b>correo institucional</b>).</div></li>' +
        '<li><div>Súbala aquí. El sistema crea las cuentas automáticamente y <b>envía a cada funcionario un correo con su usuario y su clave</b>.</div></li></ol>' +
        '<div class="dropzone" id="dz" style="margin-top:14px">📂 <b>Pinche aquí o arrastre el archivo Excel</b><input type="file" id="fx" accept=".xlsx,.xls,.csv" hidden></div><div id="prev" style="margin-top:14px"></div>' +
        '<label class="check" style="margin-top:12px"><input type="checkbox" id="mail" checked><span>📧 Enviar a cada funcionario un correo con su usuario y su clave</span></label>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: 'Crear cuentas', cls: 'ok', onClick: async function (el) {
          if (!filas.length) { UI.toast('Primero seleccione el archivo', 'bad'); return false; }
          try { return await UI.api('importarUsuarios', { filas: filas, enviarCorreo: el.querySelector('#mail').checked }); }
          catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }],
      onOpen: function (el) {
        var dz = el.querySelector('#dz'), fx = el.querySelector('#fx');
        el.querySelector('#pl-f').onclick = function (e) { e.preventDefault(); plantillaFuncionarios(); };
        dz.onclick = function () { fx.click(); };
        dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('over'); };
        dz.ondragleave = function () { dz.classList.remove('over'); };
        dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) leer(e.dataTransfer.files[0]); };
        fx.onchange = function () { if (fx.files[0]) leer(fx.files[0]); };
        async function leer(file) {
          try {
            var wb = await UI.leerExcel(file), ws = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
            var hi = rows.findIndex(function (r) { return r.some(function (c) { return /correo|mail|nombre/.test(norm(c)); }); });
            if (hi < 0) throw new Error('No se encontró la columna «CORREO INSTITUCIONAL».');
            var map = {};
            rows[hi].forEach(function (c, i) {
              var n = norm(c);
              if (/ficha/.test(n)) map.fichas = i; else if (/correo|mail/.test(n)) map.email = i; else if (/nombre/.test(n)) map.nombre = i;
              else if (/rut/.test(n)) map.rut = i; else if (/perfil|rol|cargo/.test(n)) map.rol = i; else if (/curso/.test(n)) map.cursos = i;
            });
            filas = rows.slice(hi + 1).filter(function (r) { return String(r[map.nombre] || '').trim() || String(r[map.email] || '').trim(); }).map(function (r) {
              var o = {}; for (var k in map) o[k] = String(r[map[k]] || '').trim(); return o;
            });
            el.querySelector('#prev').innerHTML = '<div class="table-wrap card" style="padding:0;max-height:300px;overflow:auto"><table class="t"><thead><tr><th>Correo (usuario)</th><th>Nombre</th><th>RUT</th><th>Perfil</th><th>Cursos</th><th>Revisión</th></tr></thead><tbody>' +
              filas.map(function (f) {
                var prob = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email || '') ? 'Falta correo válido' : !CoreUtil.rutValido(f.rut) ? 'RUT no válido' : !f.rol ? 'Falta perfil' : '';
                return '<tr><td class="small">' + esc(f.email) + '</td><td>' + esc(f.nombre) + '</td><td>' + esc(f.rut) + '</td><td>' + esc(f.rol) + '</td><td class="small">' + esc(f.cursos) + '</td><td>' + (prob ? '<span class="badge b-red">' + prob + '</span>' : '<span class="badge b-matriculada">OK</span>') + '</td></tr>';
              }).join('') + '</tbody></table></div><p class="small muted">' + filas.length + ' funcionarios encontrados en «' + esc(file.name) + '».</p>';
          } catch (e) { UI.toast('No se pudo leer el archivo: ' + e.message, 'bad'); }
        }
      }
    }).then(function (res) {
      if (!res) return;
      var c = res.filter(function (r) { return r.estado === 'creado'; }).length, a = res.filter(function (r) { return r.estado === 'actualizado'; }).length, er = res.filter(function (r) { return r.estado === 'error'; });
      var pendientes = res.filter(function (r) { return r.clave; });
      UI.modal({
        center: true, icon: er.length ? 'warning' : 'success', title: 'Carga masiva finalizada', size: 'wide',
        html: '<p style="font-size:15.5px"><b>' + c + '</b> cuentas creadas · <b>' + a + '</b> actualizadas · <b>' + er.length + '</b> con errores</p>' +
          (pendientes.length ? '<p class="small" style="color:#8a6a1f">⚠️ ' + pendientes.length + ' clave(s) no se enviaron por correo. Descárguelas para entregarlas personalmente.</p>' : '') +
          '<div class="table-wrap" style="max-height:300px;overflow:auto;text-align:left"><table class="t"><thead><tr><th>Fila</th><th>Usuario (correo)</th><th>Nombre</th><th>Resultado</th></tr></thead><tbody>' +
          res.map(function (r) { return '<tr><td>' + r.fila + '</td><td class="small">' + esc(r.usuario || '') + '</td><td>' + esc(r.nombre) + '</td><td><span class="badge ' + (r.estado === 'error' ? 'b-red' : r.clave ? 'b-gold' : 'b-matriculada') + '">' + esc(r.mensaje) + '</span></td></tr>'; }).join('') + '</tbody></table></div>',
        buttons: (pendientes.length ? [{ text: '⬇ Descargar claves no enviadas', cls: 'gold', value: false, onClick: function () {
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nombre', 'Usuario (correo)', 'Clave']].concat(pendientes.map(function (r) { return [r.nombre, r.usuario, r.clave]; }))), 'Claves');
          XLSX.writeFile(wb, 'claves_funcionarios_CONFIDENCIAL.xlsx');
          return false;
        } }] : []).concat([{ text: 'Entendido', value: true }])
      }).then(vUsuarios);
    });
  }
  /* ========================= DATOS DE LA FICHA (campos) ========================= */
  async function vFormulario() {
    admin = await UI.api('datosAdmin');
    var secs = UI.secciones(admin.campos);
    main().innerHTML = '<div class="page-h"><h2>Datos de la ficha de matrícula</h2><span class="grow"></span><button class="btn gold" data-c="nuevo">➕ Nuevo dato</button></div>' +
      '<div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--sky)"><span class="small">ℹ️ Agregue, modifique o elimine los datos que se solicitan. Defina si son <b>obligatorios</b> y si la <b>familia puede completarlos</b>. Los cambios se reflejan de inmediato en el formulario de las familias. Al eliminar un dato, la información ya ingresada se conserva en la planilla.</span></div>' +
      secs.map(function (s) {
        return '<section class="card" style="padding:0;overflow:hidden;margin-bottom:16px"><div class="curso-h"><h3>' + esc(s.nombre) + '</h3><span class="badge b-blue">' + s.campos.length + ' datos</span></div>' +
          s.campos.map(function (c) {
            function tg(k, cls, txt, on, dis) { return '<button class="toggle ' + cls + (on ? ' on' : '') + '" data-c="toggle" data-k="' + k + '" data-id="' + esc(c.id) + '"' + (dis ? ' disabled title="Dato esencial"' : '') + '><i></i>' + txt + '</button>'; }
            return '<div class="field-row"' + (UI.si(c.activo) ? '' : ' style="opacity:.6"') + '><span class="muted small" style="width:34px">' + esc(c.orden) + '</span><div class="fl"><b>' + esc(c.etiqueta) + '</b>' +
              ' <span class="badge b-gray">' + esc(TIPOS[c.tipo] || c.tipo) + '</span>' + (UI.si(c.sistema) ? ' <span class="badge b-blue">Esencial</span>' : '') +
              '<div class="toggles" style="margin-top:8px">' + tg('obligatorio', 't-ob', 'Obligatorio', UI.si(c.obligatorio)) + tg('editableFamilia', 't-fa', 'La familia completa', UI.si(c.editableFamilia)) +
              tg('activo', 't-vi', 'Visible', UI.si(c.activo), UI.si(c.sistema)) + '</div></div>' +
              '<button class="icon-btn" data-c="editar" data-id="' + esc(c.id) + '" title="Editar">✏️</button>' + (UI.si(c.sistema) ? '' : '<button class="icon-btn" data-c="eliminar" data-id="' + esc(c.id) + '" title="Eliminar">🗑</button>') + '</div>';
          }).join('') + '</section>';
      }).join('');
    main().onclick = async function (e) {
      var b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
      var c = admin.campos.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (b.dataset.c === 'toggle') { // un clic: se guarda de inmediato
        var k = b.dataset.k, nuevo = !b.classList.contains('on'), d = {};
        ['id', 'etiqueta', 'seccion', 'tipo', 'opciones', 'ayuda', 'orden'].forEach(function (x) { d[x] = c[x]; });
        ['obligatorio', 'editableFamilia', 'activo'].forEach(function (x) { d[x] = UI.si(c[x]); });
        d[k] = nuevo;
        b.classList.toggle('on', nuevo); b.disabled = true;
        try {
          admin.campos = await UI.api('guardarCampo', { campo: d });
          c[k] = nuevo ? 'SI' : 'NO';
          S.form.campos = admin.campos.filter(function (x) { return UI.si(x.activo); });
          b.closest('.field-row').style.opacity = UI.si(c.activo) ? '' : .6;
          UI.toast('✓ «' + c.etiqueta + '»: ' + b.textContent + (nuevo ? ' activado' : ' desactivado'), 'ok');
        } catch (er) { b.classList.toggle('on', !nuevo); UI.toast(er.userMsg || er.message, 'bad'); }
        b.disabled = false;
        return;
      }
      if (b.dataset.c === 'eliminar') {
        if (!await UI.confirm('¿Eliminar este dato?', 'Se quitará «<b>' + esc(c.etiqueta) + '</b>» de la ficha. La información ya ingresada se conserva en la planilla.', 'Eliminar', 'bad', 'warning')) return;
        var r = await UI.intentar(function () { return UI.api('eliminarCampo', { id: c.id }); }, 'Eliminando…');
        if (r) { await refrescarForm(); UI.toast('Dato eliminado', 'ok'); vFormulario(); }
        return;
      }
      modalCampo(c);
    };
  }
  async function refrescarForm() { S.form = await UI.api('formulario'); }
  function modalCampo(c) {
    var nuevo = !c, secs = UI.secciones(admin.campos).map(function (s) { return s.nombre; });
    c = c || { etiqueta: '', seccion: secs[secs.length - 2] || '', tipo: 'texto', opciones: '', ayuda: '', orden: String((admin.campos.length + 1) * 10), obligatorio: 'NO', editableFamilia: 'SI', activo: 'SI' };
    UI.modal({
      title: nuevo ? '➕ Nuevo dato para la ficha' : '✏️ Editar dato', size: 'wide',
      html: '<div class="grid"><div class="field full"><label>Nombre del dato (pregunta)<span class="req">*</span></label><input id="c-et" value="' + esc(c.etiqueta) + '" placeholder="Ej.: ¿El estudiante usa lentes?"></div>' +
        '<div class="field"><label>Sección</label><input id="c-sec" list="dl-sec" value="' + esc(c.seccion) + '"><datalist id="dl-sec">' + secs.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist><small class="help">Elija una existente o escriba una nueva</small></div>' +
        '<div class="field"><label>Tipo de respuesta</label><select id="c-tipo"' + (UI.si(c.sistema) ? ' disabled' : '') + '>' + Object.keys(TIPOS).map(function (t) { return '<option value="' + t + '"' + (t === c.tipo ? ' selected' : '') + '>' + TIPOS[t] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field full" id="c-opw"><label>Opciones de la lista (separadas por coma)</label><input id="c-op" value="' + esc(c.opciones) + '" placeholder="Opción 1, Opción 2, Opción 3"></div>' +
        '<div class="field"><label>Texto de ayuda</label><input id="c-ay" value="' + esc(c.ayuda) + '"></div>' +
        '<div class="field"><label>Orden</label><input id="c-or" type="number" value="' + esc(c.orden) + '"><small class="help">Número menor aparece primero</small></div>' +
        '<div class="field full row" style="gap:22px"><label class="check"><input type="checkbox" id="c-ob"' + (UI.si(c.obligatorio) ? ' checked' : '') + '> Obligatorio</label>' +
        '<label class="check"><input type="checkbox" id="c-fa"' + (UI.si(c.editableFamilia) ? ' checked' : '') + '> La familia puede completarlo/modificarlo</label>' +
        '<label class="check"><input type="checkbox" id="c-ac"' + (UI.si(c.activo) ? ' checked' : '') + (UI.si(c.sistema) ? ' disabled' : '') + '> Visible en la ficha</label></div></div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: 'Guardar', cls: 'ok', onClick: async function (el) {
          var q = function (s) { return el.querySelector(s); };
          var d = { id: c.id, etiqueta: q('#c-et').value, seccion: q('#c-sec').value, tipo: q('#c-tipo').value, opciones: q('#c-op').value, ayuda: q('#c-ay').value, orden: q('#c-or').value,
            obligatorio: q('#c-ob').checked, editableFamilia: q('#c-fa').checked, activo: q('#c-ac').checked };
          try { return await UI.api('guardarCampo', { campo: d }); } catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }],
      onOpen: function (el) {
        var t = el.querySelector('#c-tipo');
        function vis() { el.querySelector('#c-opw').classList.toggle('hidden', t.value !== 'lista'); }
        t.onchange = vis; vis();
      }
    }).then(async function (r) {
      if (!r) return;
      await refrescarForm();
      UI.success('Formulario actualizado', 'El dato fue ' + (nuevo ? 'agregado' : 'actualizado') + ' y ya aparece en las fichas.');
      vFormulario();
    });
  }

  /* ========================== REGLAMENTOS Y CARTAS ========================== */
  async function vDocumentos() {
    admin = await UI.api('datosAdmin');
    main().innerHTML = '<div class="page-h"><h2>Reglamentos, documentos y cartas</h2><span class="grow"></span><button class="btn gold" data-d="nuevo">➕ Nuevo documento o carta</button></div>' +
      '<div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--sky)"><span class="small">ℹ️ Suba los reglamentos (PDF) y sus resúmenes. Las <b>cartas</b> se imprimen junto a la ficha con espacio para firmas. Si marca «requiere confirmación», la familia debe declarar que lo leyó y quedará en el <b>acta</b> de la ficha.</span></div>' +
      admin.documentos.map(function (d) {
        return '<section class="card doc-card"' + (UI.si(d.activo) ? '' : ' style="opacity:.55"') + '><div class="doc-ico">' + (d.tipo === 'carta' ? '✉️' : '📘') + '</div><div class="grow"><h3 style="font-size:17px">' + esc(d.titulo) + '</h3>' +
          '<p class="muted" style="margin:0 0 8px">' + esc(d.resumen) + '</p><div class="row small" style="gap:6px">' + '<span class="badge b-gray">' + (d.tipo === 'carta' ? 'Carta' : 'Documento institucional') + '</span>' +
          (UI.si(d.requiereAceptacion) ? '<span class="badge b-red">Requiere confirmación</span>' : '') + (UI.si(d.imprimir) ? '<span class="badge b-gold">Se imprime con la ficha</span>' : '') +
          (d.url ? '<a class="badge b-blue" href="' + esc(d.url) + '" target="_blank" rel="noopener">📄 Ver archivo</a>' : '<span class="badge b-gray">Sin archivo</span>') + (UI.si(d.activo) ? '' : '<span class="badge b-gray">Oculto</span>') + '</div></div>' +
          '<div class="row"><button class="icon-btn" data-d="editar" data-id="' + esc(d.id) + '">✏️</button><button class="icon-btn" data-d="eliminar" data-id="' + esc(d.id) + '">🗑</button></div></section>';
      }).join('');
    main().onclick = async function (e) {
      var b = e.target.closest('[data-d]'); if (!b) return;
      var d = admin.documentos.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (b.dataset.d === 'eliminar') {
        if (!await UI.confirm('¿Eliminar documento?', 'Se eliminará «<b>' + esc(d.titulo) + '</b>» de la plataforma.', 'Eliminar', 'bad', 'warning')) return;
        if (await UI.intentar(function () { return UI.api('eliminarDocumento', { id: d.id }); }, 'Eliminando…')) { await refrescarForm(); vDocumentos(); }
        return;
      }
      modalDocumento(d);
    };
  }
  function modalDocumento(d) {
    var nuevo = !d;
    d = d || { tipo: 'reglamento', titulo: '', resumen: '', contenido: '', url: '', requiereAceptacion: 'SI', imprimir: 'NO', activo: 'SI', orden: String((admin.documentos.length + 1) * 10) };
    UI.modal({
      title: nuevo ? '➕ Nuevo documento o carta' : '✏️ Editar documento', size: 'wide',
      html: '<div class="grid"><div class="field"><label>Tipo</label><select id="d-tipo"><option value="reglamento">Documento institucional / reglamento</option><option value="carta">Carta (se firma con la ficha)</option></select></div>' +
        '<div class="field"><label>Orden</label><input id="d-or" type="number" value="' + esc(d.orden) + '"></div>' +
        '<div class="field full"><label>Título<span class="req">*</span></label><input id="d-ti" value="' + esc(d.titulo) + '"></div>' +
        '<div class="field full"><label>Resumen (lo que verá la familia)</label><textarea id="d-re" rows="3">' + esc(d.resumen) + '</textarea></div>' +
        '<div class="field full" id="d-cow"><label>Texto de la carta</label><textarea id="d-co" rows="9">' + esc(d.contenido) + '</textarea><small class="help">Puede usar: {{apoderado}} {{rut_apoderado}} {{estudiante}} {{rut_estudiante}} {{curso}} {{curso_anterior}} {{numero_matricula}} {{anio}} {{colegio}} {{ciudad}} {{fecha}} {{director}}</small></div>' +
        '<div class="field full"><label>Archivo del documento (PDF, Word…)</label><div class="dropzone" id="d-dz">📎 <b>Pinche para subir un archivo</b> <span class="small muted" id="d-fn">' + (d.url ? '(ya tiene un archivo; suba otro para reemplazarlo)' : '') + '</span><input type="file" id="d-file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png"></div></div>' +
        '<div class="field full"><label>…o enlace al documento (Google Drive, página del colegio)</label><input id="d-url" type="url" value="' + (d.url && d.url.indexOf('data:') === 0 ? '' : esc(d.url)) + '" placeholder="https://"></div>' +
        '<div class="field full row" style="gap:22px"><label class="check"><input type="checkbox" id="d-ac"' + (UI.si(d.requiereAceptacion) ? ' checked' : '') + '> Requiere confirmación de lectura (acta)</label>' +
        '<label class="check"><input type="checkbox" id="d-im"' + (UI.si(d.imprimir) ? ' checked' : '') + '> Imprimir junto a la ficha</label>' +
        '<label class="check"><input type="checkbox" id="d-vi"' + (UI.si(d.activo) ? ' checked' : '') + '> Visible</label></div></div>',
      buttons: [{ text: 'Cancelar', cls: 'ghost', value: null }, {
        text: 'Guardar', cls: 'ok', onClick: async function (el) {
          var q = function (s) { return el.querySelector(s); }, file = q('#d-file').files[0], archivo = null;
          if (file) {
            if (file.size > 25 * 1024 * 1024) { UI.toast('El archivo supera 25 MB', 'bad'); return false; }
            archivo = { nombre: file.name, mime: file.type || 'application/pdf', base64: await UI.archivoBase64(file) };
          }
          var doc = { id: d.id, tipo: q('#d-tipo').value, titulo: q('#d-ti').value, resumen: q('#d-re').value, contenido: q('#d-co').value,
            url: q('#d-url').value || (d.url && d.url.indexOf('data:') === 0 ? d.url : ''), orden: q('#d-or').value,
            requiereAceptacion: q('#d-ac').checked, imprimir: q('#d-im').checked, activo: q('#d-vi').checked };
          try { return await UI.api('guardarDocumento', { documento: doc, archivo: archivo }); } catch (e) { UI.toast(e.userMsg || e.message, 'bad'); return false; }
        }
      }],
      onOpen: function (el) {
        var t = el.querySelector('#d-tipo'); t.value = d.tipo;
        function vis() { el.querySelector('#d-cow').classList.toggle('hidden', t.value !== 'carta' && !el.querySelector('#d-co').value); }
        t.onchange = vis; vis();
        el.querySelector('#d-dz').onclick = function (e) { if (e.target.id !== 'd-file') el.querySelector('#d-file').click(); };
        el.querySelector('#d-file').onchange = function () { el.querySelector('#d-fn').textContent = this.files[0] ? '✓ ' + this.files[0].name : ''; };
      }
    }).then(async function (r) {
      if (!r) return;
      await refrescarForm();
      UI.success('Documento guardado', 'Las familias ya pueden verlo en su ficha.');
      vDocumentos();
    });
  }

  /* ============================== CONFIGURACIÓN ============================== */
  async function vConfig() {
    admin = await UI.api('datosAdmin');
    var c = admin.config;
    function inp(k, label, ph, help) { return '<div class="field"><label for="cf-' + k + '">' + label + '</label><input id="cf-' + k + '" data-cf="' + k + '" value="' + esc(c[k]) + '" placeholder="' + esc(ph || '') + '">' + (help ? '<small class="help">' + help + '</small>' : '') + '</div>'; }
    main().innerHTML = '<div class="page-h"><h2>Configuración</h2></div>' +
      '<section class="card"><div class="card-h"><div class="sec-num">🏫</div><h3>Datos del establecimiento</h3></div><div class="grid">' +
      inp('nombreColegio', 'Nombre del establecimiento') + inp('anio', 'Año escolar de la matrícula', '2027') + inp('rbd', 'RBD') + inp('ciudad', 'Ciudad') +
      inp('direccion', 'Dirección') + inp('telefono', 'Teléfono') + inp('email', 'Correo de contacto') + inp('directorNombre', 'Nombre del Director/a (firma)') +
      inp('urlPlataforma', 'Dirección (URL) de esta plataforma', 'https://usuario.github.io/fichas-matricula/', 'Se incluye en los correos enviados a funcionarios') + '</div></section>' +
      '<section class="card"><div class="card-h"><div class="sec-num">🎬</div><h3>Video tutorial</h3></div><div class="grid">' +
      inp('videoUrl', 'Enlace del video (YouTube o Google Drive)', 'https://www.youtube.com/watch?v=…', 'Se abre automáticamente la primera vez que cada persona ingresa; después queda disponible en el botón «Tutorial».') +
      '<div class="field" style="align-self:end"><button class="btn ghost" id="cf-ver">▶ Probar video</button></div></div></section>' +
      '<section class="card"><div class="card-h"><div class="sec-num">📝</div><h3>Textos</h3></div><div class="stack">' +
      '<div class="field"><label>Mensaje de bienvenida para las familias</label><textarea data-cf="mensajeBienvenida" rows="3">' + esc(c.mensajeBienvenida) + '</textarea></div>' +
      '<div class="field"><label>Texto del acta de toma de conocimiento</label><textarea data-cf="textoActa" rows="6">' + esc(c.textoActa) + '</textarea></div></div></section>' +
      '<section class="card"><div class="card-h"><div class="sec-num">🎓</div><h3>Cursos (uno por línea, en orden)</h3></div><textarea id="cf-cursos" rows="10">' + esc(admin.cursos.join('\n')) + '</textarea>' +
      '<small class="help">El ciclo se calcula automáticamente: Prekínder/Kínder → Preescolar · 1° a 4° Básico → Primer Ciclo · 5° a 8° Básico → Segundo Ciclo · 1° a 4° Medio → Enseñanza Media.</small></section>' +
      '<div class="actionbar"><span class="grow"></span><button class="btn ok lg" id="cf-save">💾 Guardar configuración</button></div>';
    UI.$('#cf-ver').onclick = function () { S.form.config.videoUrl = UI.$('#cf-videoUrl').value; App.tutorial(); };
    UI.$('#cf-save').onclick = async function () {
      var cfg = {};
      UI.$$('[data-cf]').forEach(function (el) { cfg[el.dataset.cf] = el.value; });
      var r = await UI.intentar(function () { return UI.api('guardarConfig', { config: cfg, cursos: UI.$('#cf-cursos').value }); }, 'Guardando…');
      if (!r) return;
      await refrescarForm();
      UI.success('Configuración guardada', 'Los cambios ya están disponibles para todos los usuarios.');
    };
  }

  async function vBitacora() {
    var b = await UI.api('bitacora');
    main().innerHTML = '<div class="page-h"><h2>Bitácora de actividad</h2><span class="muted small">Últimos 300 registros</span></div><section class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' +
      b.map(function (r) { return '<tr><td class="nowrap small">' + esc(r.fecha) + '</td><td>' + esc(r.usuario) + '</td><td><b>' + esc(r.accion) + '</b></td><td class="small muted">' + esc(r.detalle) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }

  return { iniciar: iniciar };
})();
