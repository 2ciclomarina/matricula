/* =====================================================================
   NÚCLEO DE LÓGICA – Fichas de Matrícula · Colegio Marina de Chile
   ---------------------------------------------------------------------
   Este mismo archivo se usa en dos lugares:
     1) En Google Apps Script (copiar íntegro como "Core.gs").
     2) En el navegador, para el "modo demostración" (sin servidor).
   Toda la seguridad (perfiles, permisos, bloqueos) se valida aquí,
   en el servidor, y no depende de la página web.
   ===================================================================== */
function createCore(env) {
  'use strict';

  var ROLES = { gestion: 'Equipo de Gestión', docente: 'Docente', asistente: 'Asistente de Educación' };
  var ESTADOS = {
    pendiente: 'Sin iniciar', en_proceso: 'En proceso', enviada: 'Enviada por la familia',
    desbloqueada: 'Desbloqueada (autorizada)', matriculada: 'Matriculado/a', retirado: 'Retirado/a'
  };
  var CICLOS = ['Preescolar', 'Primer Ciclo', 'Segundo Ciclo', 'Enseñanza Media', 'Otro'];
  // curso = nivel al que se matricula (año de la matrícula) · cursoAnterior = curso de procedencia
  var FICHA_META = ['rut', 'numeroMatricula', 'curso', 'cursoAnterior', 'estado', 'editFamilia', 'editFuncionario', 'fechaActualizacion', 'claveHash', 'debeCambiarClave', 'videoVisto', 'fechaEnvio',
    'ultimaModificacion', 'modificadoPor', 'matriculadoPorNombre', 'matriculadoPorRut', 'fechaMatricula',
    'aceptaciones', 'fechaIngreso', 'fechaRetiro'];
  var HEADERS = {
    Usuarios: ['id', 'nombre', 'rut', 'email', 'rol', 'cursos', 'fichas', 'claveHash', 'debeCambiarClave', 'activo', 'videoVisto', 'creado', 'ultimoAcceso'],
    Fichas: FICHA_META,
    Campos: ['id', 'seccion', 'etiqueta', 'tipo', 'opciones', 'obligatorio', 'editableFamilia', 'ayuda', 'orden', 'activo', 'sistema'],
    Documentos: ['id', 'tipo', 'titulo', 'resumen', 'contenido', 'url', 'requiereAceptacion', 'imprimir', 'activo', 'orden'],
    Config: ['clave', 'valor'],
    Cursos: ['nombre', 'orden'],
    Bitacora: ['fecha', 'usuario', 'accion', 'detalle']
  };
  var TIPOS_CAMPO = ['texto', 'parrafo', 'numero', 'fecha', 'email', 'telefono', 'rut', 'lista', 'si_no'];

  var CONFIG_DEF = {
    nombreColegio: 'Colegio Marina de Chile',
    ciudad: 'Concepción',
    rbd: '',
    direccion: '',
    telefono: '',
    email: '',
    anio: '2027',
    directorNombre: '',
    urlPlataforma: '',
    videoUrl: '',
    mensajeBienvenida: 'Les damos la bienvenida al proceso de matrícula. Revise y complete la ficha con datos actualizados y lea los documentos institucionales antes de enviar.',
    textoActa: 'Quien suscribe, en calidad de apoderado/a del/la estudiante individualizado/a en la presente ficha, declara haber recibido, leído y tomado conocimiento del Proyecto Educativo Institucional (PEI), del Reglamento Interno Escolar (RIE) y del Reglamento de Evaluación, Calificación y Promoción del establecimiento. Asimismo, se compromete a respetar lo establecido en dichas normas, a apoyar activamente el proceso formativo de su pupilo/a y a respetar los lineamientos de la normativa educacional vigente.'
  };

  var CURSOS_DEF = ['PreKinder A', 'Kinder A',
    '1° Básico A', '1° Básico B', '2° Básico A', '2° Básico B', '3° Básico A', '3° Básico B', '4° Básico A', '4° Básico B',
    '5° Básico A', '5° Básico B', '6° Básico A', '6° Básico B', '7° Básico A', '7° Básico B', '8° Básico A', '8° Básico B',
    '1° Medio A', '2° Medio A', '3° Medio A', '4° Medio A'];

  /* ---------------------------- utilidades ---------------------------- */
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function norm(s) { return str(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function rutKey(s) { return str(s).toUpperCase().replace(/[^0-9K]/g, ''); }
  function rutFmt(s) { var k = rutKey(s); return k.length < 2 ? k : k.slice(0, -1) + '-' + k.slice(-1); }
  function rutValido(s) {
    var k = rutKey(s); if (k.length < 2) return false;
    var body = k.slice(0, -1), dv = k.slice(-1);
    if (!/^\d+$/.test(body)) return false;
    var sum = 0, m = 2;
    for (var i = body.length - 1; i >= 0; i--) { sum += parseInt(body.charAt(i), 10) * m; m = m === 7 ? 2 : m + 1; }
    var r = 11 - (sum % 11);
    return (r === 11 ? '0' : r === 10 ? 'K' : String(r)) === dv;
  }
  function emailValido(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(s).trim()); }
  function si(v) { v = str(v).toUpperCase().trim(); return v === 'SI' || v === 'SÍ' || v === 'TRUE' || v === '1' || v === 'X'; }
  function siNo(b) { return b ? 'SI' : 'NO'; }
  function lista(s) {
    if (Array.isArray(s)) return s.map(function (x) { return str(x).replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    return str(s).split(/[,;\n]/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function pad(n) { n = str(n); return n.length < 2 ? '0' + n : n; }
  function fail(msg) { var e = new Error(msg); e.userMsg = msg; throw e; }
  function limpiarCurso(c) { return str(c).replace(/\s+/g, ' ').trim(); }
  function nivelDe(c) { return limpiarCurso(c).replace(/\s+[A-Za-z]$/, ''); }
  function cicloDe(c) {
    var n = norm(c);
    if (/pre ?k|kinder|nt1|nt2|parvul/.test(n)) return 'Preescolar';
    var num = parseInt(n, 10);
    if (/medio/.test(n)) return 'Enseñanza Media';
    if (/basico/.test(n)) return num <= 4 ? 'Primer Ciclo' : 'Segundo Ciclo';
    return 'Otro';
  }
  function claveNacimiento(fecha) {
    var f = str(fecha).trim(), m = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return pad(m[3]) + pad(m[2]) + m[1];
    m = f.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    return m ? pad(m[1]) + pad(m[2]) + m[3] : '';
  }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'campo'; }
  function claveTemporal() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < 8; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    return s;
  }
  function esc(s) { return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function parseJSON(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }

  /* --------------------------- acceso a datos -------------------------- */
  var db = env.db;
  function log(usuario, accion, detalle) {
    try { db.insert('Bitacora', { fecha: env.now(), usuario: usuario, accion: accion, detalle: str(detalle).slice(0, 500) }); } catch (e) { /* sin bloqueo */ }
  }
  function getConfig() {
    var cfg = {}, k;
    for (k in CONFIG_DEF) cfg[k] = CONFIG_DEF[k];
    db.all('Config').forEach(function (r) { if (r.clave) cfg[r.clave] = str(r.valor); });
    return cfg;
  }
  function getCursos() {
    var rows = db.all('Cursos').filter(function (r) { return str(r.nombre).trim(); });
    rows.sort(function (a, b) { return (parseFloat(a.orden) || 0) - (parseFloat(b.orden) || 0); });
    return rows.map(function (r) { return limpiarCurso(r.nombre); });
  }
  function getNiveles() {
    var out = [];
    getCursos().forEach(function (c) { var n = nivelDe(c); if (out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  function ordenCursos() {
    var map = {};
    getCursos().forEach(function (c, i) {
      map[norm(c)] = i;
      var n = norm(nivelDe(c)); if (!(n in map)) map[n] = i;
    });
    return map;
  }
  function numeroMayor() {
    var max = 0;
    db.all('Fichas').forEach(function (f) { var n = parseInt(str(f.numeroMatricula).replace(/\D/g, ''), 10); if (n > max) max = n; });
    return max;
  }
  function enActualizacion(f) { return !!str(f.editFamilia).trim() && (f.estado === 'enviada' || f.estado === 'matriculada'); }
  function editablesFamilia(f) { // ids que la familia puede modificar en el estado actual de la ficha
    // La lista de datos solicitados solo limita fichas ya enviadas o matriculadas; una ficha en proceso se completa entera.
    var pedidos = enActualizacion(f) ? str(f.editFamilia).trim() : '', lista2 = pedidos && pedidos !== 'TODOS' ? lista(pedidos) : null;
    return getCampos(false).filter(function (c) { return si(c.editableFamilia) && (!lista2 || lista2.indexOf(c.id) >= 0); })
      .map(function (c) { return c.id; });
  }
  function getCampos(todos) {
    var rows = db.all('Campos').filter(function (c) { return c.id && (todos || si(c.activo)); });
    rows.sort(function (a, b) { return (parseFloat(a.orden) || 0) - (parseFloat(b.orden) || 0); });
    return rows.map(limpiarFila);
  }
  function getDocumentos(todos) {
    var rows = db.all('Documentos').filter(function (d) { return d.id && (todos || si(d.activo)); });
    rows.sort(function (a, b) { return (parseFloat(a.orden) || 0) - (parseFloat(b.orden) || 0); });
    return rows.map(limpiarFila);
  }
  function limpiarFila(r) { var o = {}; for (var k in r) if (k.charAt(0) !== '_') o[k] = r[k]; return o; }
  function findFicha(rut) {
    var k = rutKey(rut); if (!k) return null;
    var all = db.all('Fichas');
    for (var i = 0; i < all.length; i++) if (rutKey(all[i].rut) === k) return all[i];
    return null;
  }
  function updFicha(rut, patch) {
    var k = rutKey(rut);
    db.update('Fichas', function (r) { return rutKey(r.rut) === k; }, patch);
  }
  function findUser(id) {
    var all = db.all('Usuarios');
    for (var i = 0; i < all.length; i++) if (str(all[i].id) === str(id)) return all[i];
    return null;
  }
  function updUser(id, patch) { db.update('Usuarios', function (r) { return str(r.id) === str(id); }, patch); }

  function fichaPublica(f) {
    var o = limpiarFila(f);
    o.claveCambiada = !!f.claveHash;
    delete o.claveHash;
    o.aceptaciones = parseJSON(f.aceptaciones, {});
    o.estado = f.estado || 'pendiente';
    o.nivel = nivelDe(f.curso); o.ciclo = cicloDe(f.curso);
    o.editFuncionario = si(f.editFuncionario);
    return o;
  }
  function usuarioPublico(u) {
    return {
      id: u.id, nombre: u.nombre, rut: rutFmt(u.rut), email: u.email, rol: u.rol, rolNombre: ROLES[u.rol] || u.rol,
      cursos: lista(u.cursos), fichas: lista(u.fichas), activo: si(u.activo), debeCambiarClave: si(u.debeCambiarClave),
      videoVisto: si(u.videoVisto), ultimoAcceso: u.ultimoAcceso, creado: u.creado, claveCambiada: !!u.claveHash
    };
  }
  function compararFichas(orden) {
    return function (a, b) {
      var oa = orden[norm(a.curso)], ob = orden[norm(b.curso)];
      oa = oa === undefined ? 9999 : oa; ob = ob === undefined ? 9999 : ob;
      if (oa !== ob) return oa - ob;
      if (oa === 9999 && norm(a.curso) !== norm(b.curso)) return norm(a.curso) < norm(b.curso) ? -1 : 1;
      var ka = norm(a.est_apellido_paterno + ' ' + a.est_apellido_materno + ' ' + a.est_nombres);
      var kb = norm(b.est_apellido_paterno + ' ' + b.est_apellido_materno + ' ' + b.est_nombres);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    };
  }

  /* ----------------------------- sesiones ----------------------------- */
  function nuevaSesion(data) { var t = env.uuid() + env.uuid(); env.session.put(t, data); return t; }
  function staffDe(ses) {
    if (!ses || ses.tipo !== 'staff') fail('Acción disponible solo para funcionarios.');
    var u = findUser(ses.id);
    if (!u || !si(u.activo)) fail('Su usuario no está activo. Contacte al Equipo de Gestión.');
    return u;
  }
  function familiaDe(ses) {
    if (!ses || ses.tipo !== 'familia') fail('Acción disponible solo para familias.');
    var f = findFicha(ses.rut);
    if (!f) fail('No se encontró la ficha del estudiante.');
    return f;
  }
  function soloGestion(u) { if (u.rol !== 'gestion') fail('Solo el Equipo de Gestión puede realizar esta acción.'); }
  function puedeVer(u, f) {
    if (u.rol === 'gestion') return true;
    var cs = lista(u.cursos).map(norm);
    if (cs.indexOf(norm(f.curso)) >= 0 || (f.cursoAnterior && cs.indexOf(norm(f.cursoAnterior)) >= 0)) return true;
    return lista(u.fichas).map(rutKey).indexOf(rutKey(f.rut)) >= 0;
  }
  function asignarAMi(u, rut) { // si un funcionario crea o mueve una ficha fuera de sus cursos, la conserva asignada
    if (u.rol === 'gestion') return;
    var fs = lista(u.fichas); fs.push(rutFmt(rut));
    updUser(u.id, { fichas: fs.join(', ') });
  }
  function puedeEditarFuncionario(u, f) {
    return u.rol === 'gestion' || f.estado !== 'matriculada' || si(f.editFuncionario);
  }
  function fichaAccesible(u, rut) {
    var f = findFicha(rut);
    if (!f) fail('No existe una ficha con el RUT ' + rutFmt(rut) + '.');
    if (!puedeVer(u, f)) fail('Esta ficha no está asignada a su perfil.');
    return f;
  }
  function intentos(clave, sumar) {
    var k = 'att_' + clave, n = parseInt(env.session.get(k) || '0', 10) || 0;
    if (sumar) { n++; env.session.put(k, String(n), 900); }
    return n;
  }

  /* ---------------------------- validación ---------------------------- */
  function faltantes(f, soloFamilia) {
    var out = [], permitidos = soloFamilia ? editablesFamilia(f) : null;
    getCampos(false).forEach(function (c) {
      if (permitidos && permitidos.indexOf(c.id) < 0) return;
      var v = str(f[c.id]).trim();
      if (!v) { if (si(c.obligatorio)) out.push({ id: c.id, etiqueta: c.etiqueta, seccion: c.seccion }); return; }
      if (c.tipo === 'rut' && !rutValido(v)) out.push({ id: c.id, etiqueta: c.etiqueta + ' (RUT no válido)', seccion: c.seccion });
      if (c.tipo === 'email' && !emailValido(v)) out.push({ id: c.id, etiqueta: c.etiqueta + ' (correo no válido)', seccion: c.seccion });
    });
    return out;
  }
  function docsPendientes(acept) {
    return getDocumentos(false).filter(function (d) { return si(d.requiereAceptacion) && !acept[d.id]; })
      .map(function (d) { return { id: 'doc:' + d.id, etiqueta: 'Confirmar lectura de: ' + d.titulo, seccion: 'Documentos institucionales', doc: true }; });
  }
  function filtrarDatos(datos, fichaFamilia) {
    var permitidos = {}, out = {}, ids = fichaFamilia ? editablesFamilia(fichaFamilia) : null;
    getCampos(false).forEach(function (c) { if (!ids || ids.indexOf(c.id) >= 0) permitidos[c.id] = c; });
    for (var k in (datos || {})) {
      if (!permitidos[k]) continue;
      var v = str(datos[k]).slice(0, 3000);
      if (permitidos[k].tipo === 'rut' && v) v = rutFmt(v);
      out[k] = v;
    }
    return out;
  }
  function mezclarAceptaciones(f, nuevas, quien) {
    var acc = parseJSON(f.aceptaciones, {});
    var docs = {}; getDocumentos(false).forEach(function (d) { docs[d.id] = 1; });
    for (var k in (nuevas || {})) {
      if (!docs[k]) continue;
      if (nuevas[k]) { if (!acc[k]) acc[k] = { fecha: env.now(), por: quien }; }
      else delete acc[k];
    }
    return acc;
  }

  /* ------------------------------ correos ----------------------------- */
  function correoCuenta(u, claveTxt, titulo, intro) {
    if (!emailValido(u.email)) return false;
    var cfg = getConfig();
    var link = cfg.urlPlataforma ? '<p style="text-align:center;margin:24px 0"><a href="' + esc(cfg.urlPlataforma) + '" style="background:#1f5fbf;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Ingresar a la plataforma</a></p>' : '';
    var html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dbe4f3;border-radius:12px;overflow:hidden">' +
      '<div style="background:#12347a;color:#fff;padding:18px 24px"><h2 style="margin:0">' + esc(cfg.nombreColegio) + '</h2><div style="opacity:.85">Plataforma de Fichas de Matrícula ' + esc(cfg.anio) + '</div></div>' +
      '<div style="padding:24px;color:#1b2a41;line-height:1.5"><p>Estimado/a <b>' + esc(u.nombre) + '</b>:</p><p>' + intro + '</p>' +
      '<table style="background:#f4f7fc;border-radius:8px;padding:14px;width:100%"><tr><td><b>Usuario:</b></td><td>' + esc(u.nombre) + '</td></tr>' +
      '<tr><td><b>Clave:</b></td><td>' + esc(claveTxt) + '</td></tr><tr><td><b>Perfil:</b></td><td>' + esc(ROLES[u.rol] || u.rol) + '</td></tr></table>' +
      link + '<p style="font-size:13px;color:#5b6b85">Le recomendamos cambiar su clave al ingresar (menú «Mi cuenta»). Este es un mensaje automático, no responda a este correo.</p></div></div>';
    try { env.mail(u.email, titulo + ' – ' + cfg.nombreColegio, html); return true; } catch (e) { return false; }
  }

  /* --------------------------- datos iniciales -------------------------- */
  function campoDef(orden, id, seccion, etiqueta, tipo, opciones, obligatorio, familia, ayuda, sistema) {
    return { id: id, seccion: seccion, etiqueta: etiqueta, tipo: tipo, opciones: opciones || '', obligatorio: siNo(obligatorio),
      editableFamilia: siNo(familia), ayuda: ayuda || '', orden: String(orden), activo: 'SI', sistema: siNo(sistema) };
  }
  function camposIniciales() {
    var S1 = '1. Identificación del estudiante', S2 = '2. Apoderado/a titular', S3 = '3. Apoderado/a suplente',
      S4 = '4. Antecedentes familiares', S5 = '5. Salud y emergencias', S6 = '6. Otros antecedentes', S7 = '7. Uso interno del establecimiento';
    var PAR = 'Madre,Padre,Abuelo/a,Tío/a,Hermano/a,Tutor/a legal,Otro';
    var L = [
      [S1, 'est_nombres', 'Nombres', 'texto', '', true, false, '', true],
      [S1, 'est_apellido_paterno', 'Apellido paterno', 'texto', '', true, false, '', true],
      [S1, 'est_apellido_materno', 'Apellido materno', 'texto', '', false, false, '', true],
      [S1, 'est_fecha_nacimiento', 'Fecha de nacimiento', 'fecha', '', true, false, 'Si hay un error, informe al establecimiento.', true],
      [S1, 'est_sexo', 'Sexo', 'lista', 'Femenino,Masculino,Otro', true, true],
      [S1, 'est_nacionalidad', 'Nacionalidad', 'texto', '', true, true, 'Ej.: Chilena'],
      [S1, 'est_direccion', 'Dirección del estudiante', 'texto', '', true, true, 'Calle, número, block/depto., población o villa'],
      [S1, 'est_comuna', 'Comuna', 'texto', '', true, true],
      [S1, 'est_vive_con', 'Vive con', 'lista', 'Madre y padre,Madre,Padre,Abuelos,Otro familiar,Tutor/a legal,Otro', true, true],
      [S1, 'est_colegio_procedencia', 'Establecimiento de procedencia', 'texto', '', false, true, 'Solo para estudiantes nuevos'],
      [S2, 'apo_nombres', 'Nombres', 'texto', '', true, true],
      [S2, 'apo_apellido_paterno', 'Apellido paterno', 'texto', '', true, true],
      [S2, 'apo_apellido_materno', 'Apellido materno', 'texto', '', false, true],
      [S2, 'apo_rut', 'RUT', 'rut', '', true, true, 'Ej.: 12.345.678-9'],
      [S2, 'apo_parentesco', 'Parentesco con el estudiante', 'lista', PAR, true, true],
      [S2, 'apo_celular', 'Teléfono celular', 'telefono', '', true, true, 'Ej.: 9 1234 5678'],
      [S2, 'apo_email', 'Correo electrónico', 'email', '', true, true],
      [S2, 'apo_direccion', 'Dirección (si es distinta a la del estudiante)', 'texto', '', false, true],
      [S2, 'apo_comuna', 'Comuna', 'texto', '', false, true],
      [S2, 'apo_ocupacion', 'Ocupación', 'texto', '', false, true],
      [S2, 'apo_escolaridad', 'Nivel de escolaridad', 'lista', 'Básica incompleta,Básica completa,Media incompleta,Media completa,Técnico profesional,Universitaria,Postgrado', false, true],
      [S3, 'sup_nombre', 'Nombre completo', 'texto', '', false, true],
      [S3, 'sup_rut', 'RUT', 'rut', '', false, true],
      [S3, 'sup_parentesco', 'Parentesco', 'lista', PAR, false, true],
      [S3, 'sup_celular', 'Teléfono celular', 'telefono', '', false, true],
      [S4, 'mad_nombre', 'Nombre completo de la madre', 'texto', '', false, true],
      [S4, 'mad_celular', 'Teléfono de la madre', 'telefono', '', false, true],
      [S4, 'pad_nombre', 'Nombre completo del padre', 'texto', '', false, true],
      [S4, 'pad_celular', 'Teléfono del padre', 'telefono', '', false, true],
      [S4, 'fam_personas_hogar', 'N° de personas que viven en el hogar', 'numero', '', false, true],
      [S5, 'sal_prevision', 'Previsión de salud', 'lista', 'FONASA,ISAPRE,CAPREDENA / DIPRECA,Otra,Ninguna', true, true],
      [S5, 'sal_enfermedades', 'Enfermedades o condiciones de salud', 'parrafo', '', false, true, 'Escriba "No" si no presenta'],
      [S5, 'sal_alergias', 'Alergias', 'parrafo', '', false, true],
      [S5, 'sal_medicamentos', 'Medicamentos de uso permanente', 'parrafo', '', false, true],
      [S5, 'sal_nee', '¿Presenta necesidades educativas especiales (NEE)?', 'lista', 'No,Sí - transitoria,Sí - permanente,En evaluación', true, true],
      [S5, 'sal_diagnostico', 'Diagnóstico / especialista tratante', 'parrafo', '', false, true],
      [S5, 'sal_emergencia_nombre', 'Contacto de emergencia (nombre)', 'texto', '', true, true],
      [S5, 'sal_emergencia_telefono', 'Contacto de emergencia (teléfono)', 'telefono', '', true, true],
      [S6, 'otr_religion', 'Clase de religión (Decreto 924)', 'lista', 'Católica,Evangélica,No desea clases de religión,Otra', true, true],
      [S6, 'otr_autoriza_imagen', 'Autorizo el uso de la imagen del estudiante en actividades y medios institucionales', 'si_no', '', true, true],
      [S6, 'otr_personas_retiro', 'Personas autorizadas para retirar al estudiante', 'parrafo', '', false, true, 'Nombre, RUT y parentesco'],
      [S6, 'otr_transporte', 'Medio de transporte al colegio', 'lista', 'Caminando,Transporte escolar,Locomoción colectiva,Vehículo particular,Otro', false, true],
      [S6, 'otr_beneficios', 'Beneficios (Prioritario, Preferente, JUNAEB, otros)', 'texto', '', false, true],
      [S7, 'int_observaciones', 'Observaciones del establecimiento', 'parrafo', '', false, false]
    ];
    return L.map(function (x, i) { return campoDef((i + 1) * 10, x[1], x[0], x[2], x[3], x[4], x[5], x[6], x[7], x[8]); });
  }
  function documentosIniciales() {
    return [
      { id: 'pei', tipo: 'reglamento', titulo: 'Proyecto Educativo Institucional (PEI)', orden: '10', requiereAceptacion: 'SI', imprimir: 'NO', activo: 'SI', url: '', contenido: '',
        resumen: 'Presenta la misión, visión, sellos y valores que orientan la formación de nuestros estudiantes, así como el perfil del estudiante, del apoderado y de la comunidad educativa.' },
      { id: 'rie', tipo: 'reglamento', titulo: 'Reglamento Interno Escolar (RIE)', orden: '20', requiereAceptacion: 'SI', imprimir: 'NO', activo: 'SI', url: '', contenido: '',
        resumen: 'Regula la convivencia escolar: derechos y deberes de la comunidad, normas de funcionamiento, uniforme, asistencia, puntualidad, faltas, medidas formativas y protocolos de actuación.' },
      { id: 'reval', tipo: 'reglamento', titulo: 'Reglamento de Evaluación, Calificación y Promoción', orden: '30', requiereAceptacion: 'SI', imprimir: 'NO', activo: 'SI', url: '', contenido: '',
        resumen: 'Establece cómo se evalúa y califica a los estudiantes, la cantidad de evaluaciones, la eximición, la situación de ausencias y los requisitos de promoción según el Decreto 67/2018.' },
      { id: 'compromiso', tipo: 'carta', titulo: 'Carta de compromiso del apoderado/a', orden: '40', requiereAceptacion: 'SI', imprimir: 'SI', activo: 'SI', url: '',
        resumen: 'Compromiso de la familia con el proceso formativo del estudiante y con las normas del establecimiento.',
        contenido: 'Yo, {{apoderado}}, RUT {{rut_apoderado}}, apoderado/a de {{estudiante}}, RUT {{rut_estudiante}}, matriculado/a en {{curso}} para el año escolar {{anio}} en el {{colegio}}, me comprometo a:\n\n1. Conocer, respetar y cumplir el Proyecto Educativo Institucional, el Reglamento Interno Escolar y el Reglamento de Evaluación, Calificación y Promoción.\n2. Velar por la asistencia y puntualidad diaria de mi pupilo/a, justificando oportunamente sus inasistencias.\n3. Asistir a reuniones de apoderados, entrevistas y citaciones del establecimiento.\n4. Apoyar el proceso de aprendizaje y formación valórica de mi pupilo/a, supervisando sus deberes escolares.\n5. Mantener un trato respetuoso con todos los integrantes de la comunidad educativa.\n6. Mantener actualizados mis datos de contacto e informar cualquier cambio relevante en la salud o situación familiar del estudiante.\n\n{{ciudad}}, {{fecha}}.' }
    ];
  }

  function setup(opts) {
    opts = opts || {};
    if (!db.all('Campos').length) camposIniciales().forEach(function (c) { db.insert('Campos', c); });
    if (!db.all('Documentos').length) documentosIniciales().forEach(function (d) { db.insert('Documentos', d); });
    if (!db.all('Cursos').length) db.replaceAll('Cursos', CURSOS_DEF.map(function (c, i) { return { nombre: c, orden: String(i + 1) }; }));
    var cfgRows = db.all('Config'), existentes = {};
    cfgRows.forEach(function (r) { existentes[r.clave] = 1; });
    for (var k in CONFIG_DEF) if (!existentes[k]) db.insert('Config', { clave: k, valor: CONFIG_DEF[k] });
    var hayGestion = db.all('Usuarios').some(function (u) { return u.rol === 'gestion' && si(u.activo); });
    if (!hayGestion && opts.adminNombre && opts.adminRut) {
      db.insert('Usuarios', { id: env.uuid(), nombre: opts.adminNombre, rut: rutFmt(opts.adminRut), email: opts.adminEmail || '', rol: 'gestion',
        cursos: '', fichas: '', claveHash: '', debeCambiarClave: 'NO', activo: 'SI', videoVisto: 'NO', creado: env.now(), ultimoAcceso: '' });
    }
    return 'ok';
  }

  /* Importa filas con el formato del Excel "Registro Estudiantes" (encabezados en la fila 0). */
  function siguienteCurso(c) {
    var n = norm(c), m = limpiarCurso(c).match(/\s([A-Za-z])$/), suf = m ? ' ' + m[1].toUpperCase() : '', num = parseInt(n, 10);
    if (/pre ?kinder/.test(n)) return 'Kinder' + suf;
    if (/kinder/.test(n)) return '1° Básico' + suf;
    if (/basico/.test(n)) return num < 8 ? (num + 1) + '° Básico' + suf : '1° Medio' + suf;
    if (/medio/.test(n)) return num < 4 ? (num + 1) + '° Medio' + suf : 'Egresado/a';
    return limpiarCurso(c);
  }
  /* Nombre de columna para descargas/cargas: si la etiqueta se repite, se agrega la sección. */
  function etiquetaExport(c, campos) {
    var rep = campos.filter(function (x) { return norm(x.etiqueta) === norm(c.etiqueta); }).length > 1;
    return c.etiqueta + (rep ? ' (' + str(c.seccion).replace(/^\d+[.)]\s*/, '') + ')' : '');
  }
  function fechaISO(v) {
    v = str(v).trim();
    if (/^\d{5}(\.\d+)?$/.test(v)) { // número de serie de Excel
      var d = new Date(Math.round((parseFloat(v) - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    return m ? m[3] + '-' + pad(m[2]) + '-' + pad(m[1]) : v;
  }
  /* Importa o actualiza fichas desde un Excel. Acepta:
     - el formato del registro del colegio (Rut, DV, AL Paterno, …, Curso, Apod …)
     - el Excel descargado desde la plataforma (columnas con los nombres de los datos de la ficha).
     opciones.modo: 'nuevos' (solo agrega) · 'completar' (solo llena datos vacíos) · 'sobrescribir' (reemplaza con lo del Excel).
     Una celda vacía en el Excel NUNCA borra un dato ya registrado. */
  function importarRegistro(filas, opciones) {
    opciones = opciones || {};
    var modo = opciones.modo || 'nuevos', res = { creadas: 0, actualizadas: 0, sinCambios: 0, omitidas: 0, conflictos: 0, reconocidas: [], ignoradas: [] };
    if (!filas || filas.length < 2) return res;
    var REG = { 'al nombre': 'est_nombres', 'al paterno': 'est_apellido_paterno', 'ap materno': 'est_apellido_materno', 'nacimiento': 'est_fecha_nacimiento',
      'direccion': 'est_direccion', 'apod comuna': 'est_comuna', 'apod nombre': 'apo_nombres', 'apod paterno': 'apo_apellido_paterno',
      'apod materno': 'apo_apellido_materno', 'apod celular': 'apo_celular', 'apod email': 'apo_email', 'matricula': 'fechaIngreso', 'fecha de retiro': 'fechaRetiro',
      'n° matricula': 'numeroMatricula', 'n matricula': 'numeroMatricula', 'numero de matricula': 'numeroMatricula', 'nro matricula': 'numeroMatricula',
      'curso de procedencia': 'cursoAnterior', 'curso anterior': 'cursoAnterior', 'rut estudiante': '_rutCompleto', 'rut': '_rut', 'dv': '_dv', 'curso': '_curso' };
    var campos = getCampos(true), porNombre = {}, tipos = {};
    campos.forEach(function (c) {
      tipos[c.id] = c.tipo;
      porNombre[norm(etiquetaExport(c, campos))] = c.id; porNombre[norm(c.id)] = c.id;
      if (!porNombre[norm(c.etiqueta)]) porNombre[norm(c.etiqueta)] = c.id;
    });
    var mapa = filas[0].map(function (h) {
      var n = norm(h);
      var k = REG[n] || porNombre[n] || (/^nivel( (al que se matricula|\d{4}))?$/.test(n) ? 'curso' : null);
      var informativa = /^(no|n°|ciclo|estado|fecha envio familia|ultima actualizacion familia|matriculado por|rut funcionario|fecha matricula|ultima modificacion|modificado por)$/.test(n);
      if (n && !informativa) (k ? res.reconocidas : res.ignoradas).push(str(h).trim());
      return k;
    });
    var explicitoNivel = mapa.indexOf('curso') >= 0;
    var existentes = {}, numeros = {};
    db.all('Fichas').forEach(function (f) { existentes[rutKey(f.rut)] = f; if (str(f.numeroMatricula).trim()) numeros[norm(f.numeroMatricula)] = rutKey(f.rut); });
    var nuevas = [];
    for (var r = 1; r < filas.length; r++) {
      var row = filas[r], d = {}, cuerpo = '', dv = '', completo = '', cursoReg = '';
      mapa.forEach(function (k, i) {
        if (!k) return;
        var v = str(row[i]).trim().replace(/^(\d+)\.0+$/, '$1');
        if (!v) return;
        if (k === '_rut') cuerpo = v.replace(/\D/g, '');
        else if (k === '_dv') dv = v;
        else if (k === '_rutCompleto') completo = v;
        else if (k === '_curso') cursoReg = limpiarCurso(v);
        else d[k] = v;
      });
      var rut = completo ? rutFmt(completo) : (cuerpo ? rutFmt(cuerpo + dv) : '');
      if (!rut || rutKey(rut).length < 2) continue;
      for (var k in d) {
        if (tipos[k] === 'fecha' || k === 'fechaIngreso' || k === 'fechaRetiro') d[k] = fechaISO(d[k]);
        else if (tipos[k] === 'rut') d[k] = rutFmt(d[k]);
        else if (tipos[k] === 'email') d[k] = d[k].toLowerCase();
      }
      if (d.est_sexo) { var sx = d.est_sexo.toUpperCase(); d.est_sexo = sx === 'F' ? 'Femenino' : sx === 'M' ? 'Masculino' : d.est_sexo; }
      if (d.curso) d.curso = limpiarCurso(d.curso);
      if (d.cursoAnterior) d.cursoAnterior = limpiarCurso(d.cursoAnterior);
      if (cursoReg) {
        d.cursoAnterior = cursoReg;
        if (!explicitoNivel) d.curso = nivelDe(opciones.promover && !d.fechaRetiro ? siguienteCurso(cursoReg) : cursoReg);
      }
      var kr = rutKey(rut);
      if (d.numeroMatricula) {
        var dueno = numeros[norm(d.numeroMatricula)];
        if (dueno && dueno !== kr) { delete d.numeroMatricula; res.conflictos++; } else numeros[norm(d.numeroMatricula)] = kr;
      }
      var f = existentes[kr];
      if (f) {
        if (modo === 'nuevos') { res.omitidas++; continue; }
        var patch = {}, hay = false;
        for (var c in d) {
          if (modo === 'completar' ? !str(f[c]).trim() : str(f[c]) !== d[c]) { patch[c] = d[c]; hay = true; }
        }
        if (patch.fechaRetiro && f.estado !== 'retirado') patch.estado = 'retirado';
        if (!hay) { res.sinCambios++; continue; }
        patch.ultimaModificacion = env.now(); patch.modificadoPor = opciones.usuario || 'Importación';
        db.update('Fichas', (function (kk) { return function (x) { return rutKey(x.rut) === kk; }; })(kr), patch);
        for (var p in patch) f[p] = patch[p];
        res.actualizadas++;
      } else {
        var nueva = { rut: rut, estado: d.fechaRetiro ? 'retirado' : 'pendiente', claveHash: '', debeCambiarClave: 'NO', videoVisto: 'NO', aceptaciones: '{}',
          ultimaModificacion: env.now(), modificadoPor: opciones.usuario || 'Importación' };
        for (var c2 in d) nueva[c2] = d[c2];
        existentes[kr] = nueva;
        nuevas.push(nueva);
        res.creadas++;
      }
    }
    if (nuevas.length) db.insertMany('Fichas', nuevas);
    return res;
  }

  /* ------------------------------ acciones ----------------------------- */
  var PUBLICAS = { infoPublica: 1, loginFamilia: 1, loginFuncionario: 1, recuperarClave: 1 };
  var A = {};

  A.infoPublica = function () {
    var cfg = getConfig();
    return {
      config: { nombreColegio: cfg.nombreColegio, ciudad: cfg.ciudad, anio: cfg.anio, videoUrl: cfg.videoUrl, mensajeBienvenida: cfg.mensajeBienvenida,
        direccion: cfg.direccion, telefono: cfg.telefono, email: cfg.email },
      documentos: getDocumentos(false).filter(function (d) { return d.tipo === 'reglamento'; })
        .map(function (d) { return { id: d.id, titulo: d.titulo, resumen: d.resumen, url: d.url }; })
    };
  };

  A.loginFamilia = function (p) {
    var k = rutKey(p.rut);
    if (!k) fail('Ingrese el RUT del estudiante.');
    if (intentos('f' + k) >= 8) fail('Demasiados intentos fallidos. Espere 15 minutos o contacte al establecimiento.');
    var f = findFicha(k);
    var ok = false;
    if (f) {
      if (f.claveHash) ok = env.hash(str(p.clave)) === f.claveHash;
      else ok = !!f.est_fecha_nacimiento && str(p.clave).replace(/\D/g, '') === claveNacimiento(f.est_fecha_nacimiento);
    }
    if (!ok) { intentos('f' + k, true); fail('RUT o clave incorrectos. Recuerde: la clave inicial es la fecha de nacimiento del estudiante (DDMMAAAA).'); }
    if (f.estado === 'retirado') fail('El estudiante figura como retirado. Contacte al establecimiento.');
    var token = nuevaSesion({ tipo: 'familia', rut: rutFmt(f.rut) });
    log('Familia ' + rutFmt(f.rut), 'Ingreso', '');
    return { token: token, perfil: perfilFamilia(f) };
  };
  function perfilFamilia(f) {
    return { tipo: 'familia', rut: rutFmt(f.rut), nombre: str(f.est_nombres + ' ' + f.est_apellido_paterno + ' ' + f.est_apellido_materno).trim(),
      curso: f.curso, debeCambiarClave: si(f.debeCambiarClave), videoVisto: si(f.videoVisto) };
  }

  A.loginFuncionario = function (p) {
    var n = norm(p.usuario);
    if (!n) fail('Ingrese su nombre de usuario.');
    if (intentos('s' + n) >= 8) fail('Demasiados intentos fallidos. Espere 15 minutos o solicite restablecer su clave.');
    var u = null;
    db.all('Usuarios').forEach(function (x) { if (si(x.activo) && (norm(x.nombre) === n || (x.email && norm(x.email) === n))) u = x; });
    var ok = false;
    if (u) ok = u.claveHash ? env.hash(str(p.clave)) === u.claveHash : rutKey(p.clave) === rutKey(u.rut);
    if (!ok) { intentos('s' + n, true); fail('Usuario o clave incorrectos. Su usuario es su nombre completo y la clave inicial es su RUT.'); }
    updUser(u.id, { ultimoAcceso: env.now() });
    var token = nuevaSesion({ tipo: 'staff', id: u.id });
    log(u.nombre, 'Ingreso', ROLES[u.rol]);
    return { token: token, perfil: perfilStaff(u) };
  };
  function perfilStaff(u) { var o = usuarioPublico(u); o.tipo = 'staff'; return o; }

  A.sesion = function (p, ses) {
    if (ses.tipo === 'familia') return perfilFamilia(familiaDe(ses));
    return perfilStaff(staffDe(ses));
  };
  A.logout = function (p, ses, token) { env.session.remove(token); return true; };

  A.cambiarClave = function (p, ses) {
    var nueva = str(p.nueva);
    if (nueva.length < 6) fail('La nueva clave debe tener al menos 6 caracteres.');
    if (ses.tipo === 'familia') {
      var f = familiaDe(ses);
      var ok = f.claveHash ? env.hash(str(p.actual)) === f.claveHash : str(p.actual).replace(/\D/g, '') === claveNacimiento(f.est_fecha_nacimiento);
      if (!ok) fail('La clave actual no es correcta.');
      updFicha(f.rut, { claveHash: env.hash(nueva), debeCambiarClave: 'NO' });
      log('Familia ' + rutFmt(f.rut), 'Cambio de clave', '');
    } else {
      var u = staffDe(ses);
      var ok2 = u.claveHash ? env.hash(str(p.actual)) === u.claveHash : rutKey(p.actual) === rutKey(u.rut);
      if (!ok2) fail('La clave actual no es correcta.');
      updUser(u.id, { claveHash: env.hash(nueva), debeCambiarClave: 'NO' });
      log(u.nombre, 'Cambio de clave', '');
    }
    return true;
  };

  A.recuperarClave = function (p) {
    var n = norm(p.usuario), e = norm(p.email), u = null;
    db.all('Usuarios').forEach(function (x) { if (si(x.activo) && norm(x.nombre) === n && norm(x.email) === e) u = x; });
    var msg = 'Si los datos coinciden con un funcionario registrado, recibirá una clave temporal en su correo.';
    if (!u) return msg;
    var temp = claveTemporal();
    updUser(u.id, { claveHash: env.hash(temp), debeCambiarClave: 'SI' });
    correoCuenta(u, temp, 'Restablecimiento de clave', 'Se solicitó restablecer su clave de acceso. Ingrese con la siguiente clave temporal; el sistema le pedirá crear una nueva.');
    log(u.nombre, 'Recuperación de clave', 'Autoservicio');
    return msg;
  };

  A.marcarVideoVisto = function (p, ses) {
    if (ses.tipo === 'familia') updFicha(familiaDe(ses).rut, { videoVisto: 'SI' });
    else updUser(staffDe(ses).id, { videoVisto: 'SI' });
    return true;
  };

  A.formulario = function (p, ses) {
    if (ses.tipo === 'staff') staffDe(ses);
    var cfg = getConfig();
    return { campos: getCampos(false), documentos: getDocumentos(false), config: cfg, cursos: getCursos(), niveles: getNiveles(), estados: ESTADOS, roles: ROLES };
  };

  /* ---------- familias ---------- */
  A.miFicha = function (p, ses) {
    var o = fichaPublica(familiaDe(ses));
    getCampos(true).forEach(function (c) { if (/uso interno/i.test(c.seccion)) delete o[c.id]; });
    delete o.matriculadoPorRut;
    return o;
  };

  function bloqueadaParaFamilia(f) {
    if (f.estado === 'retirado') return true;
    if (str(f.editFamilia).trim()) return false; // el Equipo de Gestión habilitó la edición
    return f.estado === 'enviada' || f.estado === 'matriculada';
  }
  var MSG_BLOQUEO = 'La ficha ya fue enviada y no puede modificarse. Solo el equipo del establecimiento puede autorizar cambios.';

  A.guardarBorrador = function (p, ses) {
    var f = familiaDe(ses);
    if (bloqueadaParaFamilia(f)) fail(MSG_BLOQUEO);
    var patch = filtrarDatos(p.datos, f);
    if (p.aceptaciones) patch.aceptaciones = JSON.stringify(mezclarAceptaciones(f, p.aceptaciones, 'Familia'));
    if (!f.estado || f.estado === 'pendiente') patch.estado = 'en_proceso';
    patch.ultimaModificacion = env.now(); patch.modificadoPor = 'Familia';
    updFicha(f.rut, patch);
    return { guardado: patch.ultimaModificacion };
  };

  A.enviarFicha = function (p, ses) {
    var f = familiaDe(ses);
    if (bloqueadaParaFamilia(f)) fail(MSG_BLOQUEO);
    var actualizacion = enActualizacion(f);
    var patch = filtrarDatos(p.datos, f), acc = mezclarAceptaciones(f, p.aceptaciones || {}, 'Familia');
    var merged = {}, k;
    for (k in f) merged[k] = f[k];
    for (k in patch) merged[k] = patch[k];
    patch.aceptaciones = JSON.stringify(acc);
    patch.ultimaModificacion = env.now(); patch.modificadoPor = 'Familia';
    var falta = faltantes(merged, true).concat(docsPendientes(acc));
    if (falta.length) {
      if (!f.estado || f.estado === 'pendiente') patch.estado = 'en_proceso';
      updFicha(f.rut, patch);
      return { enviado: false, faltantes: falta };
    }
    patch.editFamilia = '';
    if (actualizacion) {
      patch.fechaActualizacion = env.now(); // se conserva el estado (p. ej., matriculado/a)
    } else {
      patch.estado = 'enviada'; patch.fechaEnvio = env.now();
    }
    updFicha(f.rut, patch);
    log('Familia ' + rutFmt(f.rut), actualizacion ? 'Datos actualizados por la familia' : 'Ficha enviada', f.curso);
    return { enviado: true, actualizacion: actualizacion, fecha: env.now() };
  };

  /* ---------- funcionarios: fichas ---------- */
  function fichasVisibles(u) { return db.all('Fichas').filter(function (f) { return f.rut && puedeVer(u, f); }); }

  A.listarFichas = function (p, ses) {
    var u = staffDe(ses);
    var fs = fichasVisibles(u).map(fichaPublica);
    fs.sort(compararFichas(ordenCursos()));
    return fs;
  };
  A.obtenerFicha = function (p, ses) { return fichaPublica(fichaAccesible(staffDe(ses), p.rut)); };

  A.guardarFicha = function (p, ses) {
    var u = staffDe(ses), f = fichaAccesible(u, p.rut);
    if (!puedeEditarFuncionario(u, f)) fail('La ficha ya está matriculada. Solo el Equipo de Gestión puede habilitar su edición.');
    var patch = filtrarDatos(p.datos, false), moverse = false;
    if (p.curso !== undefined && limpiarCurso(p.curso) && norm(p.curso) !== norm(f.curso)) { patch.curso = limpiarCurso(p.curso); moverse = true; }
    if (p.cursoAnterior !== undefined && norm(p.cursoAnterior) !== norm(f.cursoAnterior)) { patch.cursoAnterior = limpiarCurso(p.cursoAnterior); moverse = true; }
    if (p.numeroMatricula !== undefined && str(p.numeroMatricula).trim() !== str(f.numeroMatricula)) {
      soloGestion(u);
      patch.numeroMatricula = validarNumero(p.numeroMatricula, f.rut);
    }
    if (moverse && !puedeVer(u, Object.assign({}, f, patch))) asignarAMi(u, f.rut);
    if (p.estado && ESTADOS[p.estado] && p.estado !== f.estado) {
      if (p.estado === 'matriculada') fail('Use el botón «Registrar matrícula» para matricular.');
      patch.estado = p.estado;
      if (p.estado === 'retirado' && !f.fechaRetiro) patch.fechaRetiro = env.now().slice(0, 10);
    }
    if (p.aceptaciones) patch.aceptaciones = JSON.stringify(mezclarAceptaciones(f, p.aceptaciones, u.nombre + ' (presencial)'));
    patch.ultimaModificacion = env.now(); patch.modificadoPor = u.nombre;
    updFicha(f.rut, patch);
    if (!p.auto) log(u.nombre, 'Edición de ficha', rutFmt(f.rut));
    return fichaPublica(findFicha(f.rut));
  };

  A.crearFicha = function (p, ses) {
    var u = staffDe(ses);
    if (!rutValido(p.rut)) fail('El RUT del estudiante no es válido.');
    if (findFicha(p.rut)) fail('Ya existe una ficha con ese RUT.');
    var curso = limpiarCurso(p.curso);
    if (!curso) fail('Seleccione el nivel al que se matricula.');
    var datos = filtrarDatos(p.datos, false);
    if (!datos.est_nombres || !datos.est_apellido_paterno) fail('Ingrese nombres y apellido paterno del estudiante.');
    if (!datos.est_fecha_nacimiento) fail('Ingrese la fecha de nacimiento (será la clave inicial de la familia).');
    var f = { rut: rutFmt(p.rut), curso: curso, cursoAnterior: limpiarCurso(p.cursoAnterior), estado: 'pendiente', claveHash: '', debeCambiarClave: 'NO', videoVisto: 'NO', aceptaciones: '{}',
      fechaIngreso: env.now().slice(0, 10), ultimaModificacion: env.now(), modificadoPor: u.nombre };
    for (var k in datos) f[k] = datos[k];
    db.insert('Fichas', f);
    if (!puedeVer(u, f)) asignarAMi(u, f.rut);
    log(u.nombre, 'Ficha creada', f.rut + ' ' + curso);
    return fichaPublica(findFicha(f.rut));
  };

  /* Carga masiva de estudiantes nuevos (mismo formato que el Excel "Registro Estudiantes"). */
  A.importarEstudiantes = function (p, ses) {
    var u = staffDe(ses); soloGestion(u);
    var modo = ['nuevos', 'completar', 'sobrescribir'].indexOf(p.modo) >= 0 ? p.modo : 'nuevos';
    var r = importarRegistro(p.filas || [], { promover: !!p.promover, modo: modo, usuario: u.nombre + ' (carga Excel)' });
    log(u.nombre, 'Carga de base de datos (' + modo + ')', r.creadas + ' nuevas · ' + r.actualizadas + ' actualizadas · ' + r.sinCambios + ' sin cambios · ' + r.omitidas + ' omitidas');
    return r;
  };

  function validarNumero(n, rutPropio) {
    n = str(n).trim();
    if (!n) return '';
    if (n.length > 20) fail('El número de matrícula es demasiado largo.');
    db.all('Fichas').forEach(function (x) {
      if (rutKey(x.rut) !== rutKey(rutPropio) && norm(x.numeroMatricula) === norm(n)) fail('El N° de matrícula ' + n + ' ya está asignado a otro estudiante.');
    });
    return n;
  }
  A.siguienteNumero = function (p, ses) { staffDe(ses); return String(numeroMayor() + 1); };

  /* Cierra el proceso: estado «Matriculado/a», N° de matrícula y funcionario que matricula. */
  A.registrarMatricula = function (p, ses) {
    var u = staffDe(ses), f = fichaAccesible(u, p.rut);
    if (f.estado === 'matriculada') fail('El estudiante ya está matriculado con el N° ' + f.numeroMatricula + '.');
    if (!f.cursoAnterior && p.cursoAnterior) f.cursoAnterior = limpiarCurso(p.cursoAnterior);
    var falta = faltantes(f, false);
    if (falta.length) return { matriculado: false, faltantes: falta };
    var numero = validarNumero(p.numero, f.rut) || String(numeroMayor() + 1);
    updFicha(f.rut, { estado: 'matriculada', numeroMatricula: numero, editFamilia: '', editFuncionario: '', matriculadoPorNombre: u.nombre,
      matriculadoPorRut: rutFmt(u.rut), fechaMatricula: env.now(), ultimaModificacion: env.now(), modificadoPor: u.nombre });
    log(u.nombre, 'Matrícula registrada N° ' + numero, rutFmt(f.rut) + ' ' + f.curso);
    return { matriculado: true, ficha: fichaPublica(findFicha(f.rut)) };
  };

  /* El Equipo de Gestión habilita (o cierra) la edición para familias y/o funcionarios,
     en una ficha, un nivel, un curso de procedencia, un ciclo o todo el establecimiento.
     Los datos ya registrados se conservan: solo se permite modificarlos. */
  function fichasDelAlcance(p) {
    var v = norm(p.valor);
    return db.all('Fichas').filter(function (f) {
      if (!f.rut || f.estado === 'retirado') return false;
      if (p.alcance === 'ficha') return rutKey(f.rut) === rutKey(p.valor);
      if (p.alcance === 'nivel') return norm(nivelDe(f.curso)) === v;
      if (p.alcance === 'cursoAnterior') return norm(f.cursoAnterior) === v;
      if (p.alcance === 'ciclo') return norm(cicloDe(f.curso)) === v;
      return p.alcance === 'todos';
    });
  }
  A.habilitarEdicion = function (p, ses) {
    var u = staffDe(ses); soloGestion(u);
    var fs = fichasDelAlcance(p), patch = {};
    if (!fs.length) fail('No hay fichas en el alcance seleccionado.');
    var campos = p.campos === 'TODOS' || !lista(p.campos).length ? 'TODOS' : lista(p.campos).join(',');
    if (p.para === 'familia' || p.para === 'ambos') patch.editFamilia = campos;
    if (p.para === 'funcionarios' || p.para === 'ambos') patch.editFuncionario = 'SI';
    patch.ultimaModificacion = env.now(); patch.modificadoPor = u.nombre;
    var claves = {}; fs.forEach(function (f) { claves[rutKey(f.rut)] = 1; });
    db.update('Fichas', function (r) { return claves[rutKey(r.rut)]; }, patch);
    log(u.nombre, 'Edición habilitada para ' + p.para, fs.length + ' fichas · alcance ' + p.alcance + ' ' + str(p.valor) + ' · datos: ' + (campos === 'TODOS' ? 'todos' : campos));
    return { fichas: fs.length, ficha: p.alcance === 'ficha' ? fichaPublica(findFicha(p.valor)) : null };
  };
  A.cerrarEdicion = function (p, ses) {
    var u = staffDe(ses); soloGestion(u);
    var fs = fichasDelAlcance(p), claves = {};
    fs.forEach(function (f) { claves[rutKey(f.rut)] = 1; });
    db.update('Fichas', function (r) { return claves[rutKey(r.rut)]; }, { editFamilia: '', editFuncionario: '' });
    log(u.nombre, 'Edición cerrada', fs.length + ' fichas · alcance ' + p.alcance + ' ' + str(p.valor));
    return { fichas: fs.length, ficha: p.alcance === 'ficha' ? fichaPublica(findFicha(p.valor)) : null };
  };
  A.desbloquearFicha = function (p, ses) { // compatibilidad: abre toda la ficha a la familia
    return A.habilitarEdicion({ alcance: 'ficha', valor: p.rut, para: 'familia', campos: 'TODOS' }, ses).ficha;
  };

  A.claveFamilia = function (p, ses) {
    var u = staffDe(ses), f = fichaAccesible(u, p.rut), patch = {};
    if (p.restablecer) patch.claveHash = '';
    patch.debeCambiarClave = siNo(!!p.forzarCambio);
    updFicha(f.rut, patch);
    log(u.nombre, p.restablecer ? 'Clave familia restablecida' : 'Cambio de clave solicitado a familia', rutFmt(f.rut));
    return fichaPublica(findFicha(f.rut));
  };

  A.eliminarFicha = function (p, ses) {
    var u = staffDe(ses); soloGestion(u);
    var k = rutKey(p.rut);
    db.remove('Fichas', function (r) { return rutKey(r.rut) === k; });
    log(u.nombre, 'Ficha eliminada', rutFmt(p.rut));
    return true;
  };

  A.estadisticas = function (p, ses) {
    var u = staffDe(ses), orden = ordenCursos(), porCurso = {};
    // Las fichas se cuentan por el nivel al que se matriculan (curso del año de matrícula)
    if (u.rol === 'gestion') getNiveles().forEach(function (n) { porCurso[norm(n)] = nuevoContador(n); });
    fichasVisibles(u).forEach(function (f) {
      var c = nivelDe(f.curso) || 'Sin nivel', key = norm(c);
      var o = porCurso[key] || (porCurso[key] = nuevoContador(c));
      var e = f.estado || 'pendiente';
      o.total++; o[e] = (o[e] || 0) + 1;
      var sx = norm(f.est_sexo);
      if (sx.charAt(0) === 'f') o.mujeres++; else if (sx.charAt(0) === 'm') o.hombres++;
    });
    var cursos = Object.keys(porCurso).map(function (k) { return porCurso[k]; });
    cursos.sort(function (a, b) {
      var oa = orden[norm(a.curso)], ob = orden[norm(b.curso)];
      return (oa === undefined ? 9999 : oa) - (ob === undefined ? 9999 : ob) || (a.curso < b.curso ? -1 : 1);
    });
    return { cursos: cursos, ciclos: CICLOS, estados: ESTADOS };
  };
  function nuevoContador(c) {
    return { curso: c, nivel: nivelDe(c), ciclo: cicloDe(c), total: 0, pendiente: 0, en_proceso: 0, enviada: 0, desbloqueada: 0, matriculada: 0, retirado: 0, mujeres: 0, hombres: 0 };
  }

  /* ---------- funcionarios: usuarios (Equipo de Gestión) ---------- */
  function rolDe(txt) {
    var n = norm(txt);
    if (ROLES[n]) return n;
    if (/asist/.test(n)) return 'asistente';
    if (/docen|profe/.test(n)) return 'docente';
    if (/gesti|direct|equipo|admin|utp|inspector/.test(n)) return 'gestion';
    return '';
  }
  function validarUsuario(d, idActual) {
    var nombre = str(d.nombre).replace(/\s+/g, ' ').trim();
    if (nombre.split(' ').length < 2) fail('Ingrese nombre y apellido del funcionario (' + (nombre || 'vacío') + ').');
    if (!rutValido(d.rut)) fail('RUT no válido para ' + nombre + '.');
    var rol = rolDe(d.rol);
    if (!rol) fail('Perfil no válido para ' + nombre + '. Use: Docente, Asistente de Educación o Equipo de Gestión.');
    if (d.email && !emailValido(d.email)) fail('Correo no válido para ' + nombre + '.');
    db.all('Usuarios').forEach(function (x) {
      if (str(x.id) === str(idActual)) return;
      if (norm(x.nombre) === norm(nombre)) fail('Ya existe un usuario con el nombre «' + nombre + '». Agregue el segundo apellido para diferenciarlo.');
      if (rutKey(x.rut) === rutKey(d.rut)) fail('Ya existe un usuario con el RUT ' + rutFmt(d.rut) + '.');
    });
    return { nombre: nombre, rut: rutFmt(d.rut), email: str(d.email).trim().toLowerCase(), rol: rol,
      cursos: lista(d.cursos).join(', '), fichas: lista(d.fichas).map(rutFmt).join(', ') };
  }

  A.listarUsuarios = function (p, ses) {
    soloGestion(staffDe(ses));
    var us = db.all('Usuarios').map(usuarioPublico);
    us.sort(function (a, b) { return norm(a.nombre) < norm(b.nombre) ? -1 : 1; });
    return us;
  };

  A.guardarUsuario = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var d = p.usuario || {}, limpio = validarUsuario(d, d.id), correo = false;
    if (d.id) {
      if (!findUser(d.id)) fail('Usuario no encontrado.');
      if (str(d.id) === str(yo.id) && limpio.rol !== 'gestion') fail('No puede quitarse a sí mismo el perfil de Equipo de Gestión.');
      limpio.activo = siNo(d.activo !== false);
      updUser(d.id, limpio);
      log(yo.nombre, 'Usuario editado', limpio.nombre);
    } else {
      limpio.id = env.uuid(); limpio.claveHash = ''; limpio.debeCambiarClave = 'NO'; limpio.activo = 'SI'; limpio.videoVisto = 'NO';
      limpio.creado = env.now(); limpio.ultimoAcceso = '';
      db.insert('Usuarios', limpio);
      if (p.enviarCorreo !== false) correo = correoCuenta(limpio, limpio.rut + ' (su RUT, sin puntos y con guion)', 'Cuenta creada', 'Se ha creado su cuenta en la plataforma de Fichas de Matrícula. Sus datos de acceso son:');
      log(yo.nombre, 'Usuario creado', limpio.nombre);
    }
    return { correoEnviado: correo };
  };

  A.importarUsuarios = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var res = [];
    (p.filas || []).forEach(function (fila, i) {
      try {
        var existente = null;
        db.all('Usuarios').forEach(function (x) { if (rutKey(x.rut) === rutKey(fila.rut)) existente = x; });
        var limpio = validarUsuario(fila, existente ? existente.id : null);
        if (existente) {
          updUser(existente.id, limpio);
          res.push({ fila: i + 2, nombre: limpio.nombre, estado: 'actualizado', mensaje: 'Datos actualizados' });
        } else {
          limpio.id = env.uuid(); limpio.claveHash = ''; limpio.debeCambiarClave = 'NO'; limpio.activo = 'SI'; limpio.videoVisto = 'NO';
          limpio.creado = env.now(); limpio.ultimoAcceso = '';
          db.insert('Usuarios', limpio);
          var c = p.enviarCorreo !== false && correoCuenta(limpio, limpio.rut + ' (su RUT, sin puntos y con guion)', 'Cuenta creada', 'Se ha creado su cuenta en la plataforma de Fichas de Matrícula. Sus datos de acceso son:');
          res.push({ fila: i + 2, nombre: limpio.nombre, estado: 'creado', mensaje: c ? 'Creado y correo enviado' : (limpio.email ? 'Creado (no se pudo enviar el correo)' : 'Creado (sin correo registrado)') });
        }
      } catch (e) {
        res.push({ fila: i + 2, nombre: str(fila.nombre), estado: 'error', mensaje: e.userMsg || String(e.message || e) });
      }
    });
    log(yo.nombre, 'Carga masiva de usuarios', res.length + ' filas');
    return res;
  };

  A.eliminarUsuario = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    if (str(p.id) === str(yo.id)) fail('No puede eliminar su propio usuario.');
    var u = findUser(p.id);
    db.remove('Usuarios', function (r) { return str(r.id) === str(p.id); });
    log(yo.nombre, 'Usuario eliminado', u ? u.nombre : p.id);
    return true;
  };

  A.restablecerClaveUsuario = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var u = findUser(p.id);
    if (!u) fail('Usuario no encontrado.');
    updUser(u.id, { claveHash: '', debeCambiarClave: 'SI' });
    var c = correoCuenta(u, rutFmt(u.rut) + ' (su RUT, sin puntos y con guion)', 'Clave restablecida', 'Su clave de acceso fue restablecida por el Equipo de Gestión. Al ingresar, el sistema le pedirá crear una nueva clave.');
    log(yo.nombre, 'Clave de usuario restablecida', u.nombre);
    return { correoEnviado: c };
  };

  /* ---------- configuración (Equipo de Gestión) ---------- */
  A.datosAdmin = function (p, ses) {
    soloGestion(staffDe(ses));
    return { campos: getCampos(true), documentos: getDocumentos(true), config: getConfig(), cursos: getCursos(), tipos: TIPOS_CAMPO };
  };

  A.guardarCampo = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var c = p.campo || {};
    if (!str(c.etiqueta).trim()) fail('Ingrese el nombre (etiqueta) del dato.');
    if (TIPOS_CAMPO.indexOf(c.tipo) < 0) fail('Tipo de dato no válido.');
    if (c.tipo === 'lista' && !lista(c.opciones).length) fail('Ingrese las opciones de la lista, separadas por coma.');
    var limpio = { seccion: str(c.seccion).trim() || 'Otros antecedentes', etiqueta: str(c.etiqueta).trim(), tipo: c.tipo,
      opciones: lista(c.opciones).join(','), obligatorio: siNo(!!c.obligatorio), editableFamilia: siNo(!!c.editableFamilia),
      ayuda: str(c.ayuda).trim(), orden: str(c.orden || '999'), activo: siNo(c.activo !== false) };
    var existente = c.id && db.all('Campos').filter(function (x) { return x.id === c.id; })[0];
    if (existente) {
      if (si(existente.sistema)) { limpio.activo = 'SI'; limpio.tipo = existente.tipo; }
      db.update('Campos', function (x) { return x.id === c.id; }, limpio);
    } else {
      var base = 'x_' + slug(limpio.etiqueta), id = base, n = 2, ids = {};
      db.all('Campos').forEach(function (x) { ids[x.id] = 1; });
      FICHA_META.forEach(function (m) { ids[m] = 1; });
      while (ids[id]) id = base + '_' + (n++);
      limpio.id = id; limpio.sistema = 'NO';
      db.insert('Campos', limpio);
    }
    log(yo.nombre, 'Formulario modificado', limpio.etiqueta);
    return getCampos(true);
  };

  A.eliminarCampo = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var c = db.all('Campos').filter(function (x) { return x.id === p.id; })[0];
    if (!c) fail('Dato no encontrado.');
    if (si(c.sistema)) fail('Este dato es esencial para el sistema y no puede eliminarse (puede cambiar su nombre).');
    db.remove('Campos', function (x) { return x.id === p.id; });
    log(yo.nombre, 'Dato eliminado del formulario', c.etiqueta + ' (la información ya ingresada se conserva en la planilla)');
    return getCampos(true);
  };

  A.guardarDocumento = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var d = p.documento || {};
    if (!str(d.titulo).trim()) fail('Ingrese el título del documento.');
    var limpio = { tipo: d.tipo === 'carta' ? 'carta' : 'reglamento', titulo: str(d.titulo).trim(), resumen: str(d.resumen),
      contenido: str(d.contenido), url: str(d.url).trim(), requiereAceptacion: siNo(!!d.requiereAceptacion),
      imprimir: siNo(!!d.imprimir), activo: siNo(d.activo !== false), orden: str(d.orden || '999') };
    if (p.archivo && p.archivo.base64) {
      limpio.url = env.saveFile(p.archivo.nombre || (limpio.titulo + '.pdf'), p.archivo.mime || 'application/pdf', p.archivo.base64);
    }
    if (d.id && db.all('Documentos').some(function (x) { return x.id === d.id; })) {
      db.update('Documentos', function (x) { return x.id === d.id; }, limpio);
    } else {
      limpio.id = slug(limpio.titulo).slice(0, 20) + '_' + env.uuid().slice(0, 4);
      db.insert('Documentos', limpio);
    }
    log(yo.nombre, 'Documento guardado', limpio.titulo);
    return getDocumentos(true);
  };

  A.eliminarDocumento = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    db.remove('Documentos', function (x) { return x.id === p.id; });
    log(yo.nombre, 'Documento eliminado', p.id);
    return getDocumentos(true);
  };

  A.guardarConfig = function (p, ses) {
    var yo = staffDe(ses); soloGestion(yo);
    var cfg = p.config || {}, existentes = {};
    db.all('Config').forEach(function (r) { existentes[r.clave] = 1; });
    for (var k in cfg) {
      if (!(k in CONFIG_DEF)) continue;
      if (existentes[k]) db.update('Config', (function (kk) { return function (r) { return r.clave === kk; }; })(k), { valor: str(cfg[k]) });
      else db.insert('Config', { clave: k, valor: str(cfg[k]) });
    }
    if (p.cursos) {
      var cs = lista(p.cursos);
      if (!cs.length) fail('Debe existir al menos un curso.');
      db.replaceAll('Cursos', cs.map(function (c, i) { return { nombre: c, orden: String(i + 1) }; }));
    }
    log(yo.nombre, 'Configuración actualizada', '');
    return { config: getConfig(), cursos: getCursos() };
  };

  A.bitacora = function (p, ses) {
    soloGestion(staffDe(ses));
    return db.all('Bitacora').slice(-300).reverse().map(limpiarFila);
  };

  /* ------------------------------ despacho ----------------------------- */
  function handle(action, payload, token) {
    try {
      if (!Object.prototype.hasOwnProperty.call(A, action)) fail('Acción no reconocida: ' + action);
      var ses = null;
      if (!PUBLICAS[action]) {
        ses = token ? env.session.get(token) : null;
        if (ses && typeof ses === 'string') ses = parseJSON(ses, null);
        if (!ses) return { ok: false, auth: false, error: 'Su sesión expiró. Por favor ingrese nuevamente.' };
      }
      return { ok: true, data: A[action](payload || {}, ses, token) };
    } catch (e) {
      return { ok: false, error: e && e.userMsg ? e.userMsg : 'Error interno: ' + (e && e.message ? e.message : e) };
    }
  }

  return {
    handle: handle, setup: setup, importarRegistro: importarRegistro, HEADERS: HEADERS, FICHA_META: FICHA_META,
    util: { etiquetaExport: etiquetaExport, rutFmt: rutFmt, rutValido: rutValido, rutKey: rutKey, nivelDe: nivelDe, cicloDe: cicloDe, norm: norm }
  };
}

/* Utilidades de RUT y cursos para la página (no dependen de la base de datos). */
var CoreUtil = createCore({ db: { all: function () { return []; } } }).util;
