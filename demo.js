/* =====================================================================
   MODO DEMOSTRACIÓN – ejecuta el mismo núcleo (core.js) en el navegador,
   guardando todo en localStorage. Solo se usa si config.js no tiene API_URL.
   Los estudiantes de ejemplo son ficticios.
   ===================================================================== */
function crearBackendDemo() {
  var KEY = 'fichas_demo_db_v2', SKEY = 'fichas_demo_ses_v2';
  var data = {}, sesiones = {};
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { data = {}; }
  try { sesiones = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { sesiones = {}; }

  function tabla(n) { return data[n] || (data[n] = []); }
  function strs(o) { var r = {}; for (var k in o) r[k] = o[k] === undefined || o[k] === null ? '' : String(o[k]); return r; }
  function persistir() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); localStorage.setItem(SKEY, JSON.stringify(sesiones)); } catch (e) { /* cuota */ }
  }
  function hash(s) { // hash simple solo para la demo (el servidor real usa SHA-256 con sal secreta)
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) { var ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  var env = {
    db: {
      all: function (n) { return tabla(n).map(function (r) { return Object.assign({}, r); }); },
      insert: function (n, o) { tabla(n).push(strs(o)); },
      insertMany: function (n, l) { l.forEach(function (o) { tabla(n).push(strs(o)); }); },
      update: function (n, pred, patch) { var c = 0; tabla(n).forEach(function (r) { if (pred(r)) { Object.assign(r, strs(patch)); c++; } }); return c; },
      remove: function (n, pred) { data[n] = tabla(n).filter(function (r) { return !pred(r); }); },
      replaceAll: function (n, l) { data[n] = l.map(strs); }
    },
    now: function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); },
    uuid: function () { return Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6); },
    hash: function (s) { return hash('demo|' + s); },
    session: {
      put: function (k, v) { sesiones[k] = v; },
      get: function (k) { return sesiones[k] || null; },
      remove: function (k) { delete sesiones[k]; }
    },
    mail: function (to, asunto) {
      console.info('[DEMO] Correo simulado para', to, '·', asunto);
      if (window.UI && UI.toast) UI.toast('📧 (Demo) Correo simulado enviado a ' + to, 'info');
    },
    saveFile: function (nombre, mime, b64) {
      if (b64.length > 3000000) throw Object.assign(new Error('x'), { userMsg: 'En modo demostración el archivo debe pesar menos de 2 MB.' });
      return 'data:' + mime + ';base64,' + b64;
    }
  };

  var core = createCore(env);

  if (!tabla('Campos').length) {
    core.setup({ adminNombre: 'Equipo Gestión Demo', adminRut: '11.111.111-1', adminEmail: 'gestion.demo@colegio.cl' });
    env.db.insert('Usuarios', { id: 'doc1', nombre: 'Docente Demo', rut: '22222222-2', email: 'docente.demo@colegio.cl', rol: 'docente', cursos: '1° Básico A', fichas: '', claveHash: '', debeCambiarClave: 'NO', activo: 'SI', videoVisto: 'NO', creado: env.now() });
    env.db.insert('Usuarios', { id: 'asi1', nombre: 'Asistente Demo', rut: '33333333-3', email: 'asistente.demo@colegio.cl', rol: 'asistente', cursos: 'Kinder A', fichas: '', claveHash: '', debeCambiarClave: 'NO', activo: 'SI', videoVisto: 'NO', creado: env.now() });
    var nombres = [['SOFÍA ANTONIA', 'F'], ['MATEO IGNACIO', 'M'], ['ISIDORA BELÉN', 'F'], ['BENJAMÍN TOMÁS', 'M'], ['AGUSTINA PAZ', 'F'], ['VICENTE ANDRÉS', 'M'], ['EMILIA JAVIERA', 'F'], ['LUCAS MARTÍN', 'M'], ['FLORENCIA AMANDA', 'F'], ['JOAQUÍN ELÍAS', 'M'], ['MAITE CONSTANZA', 'F'], ['TOMÁS ALONSO', 'M'], ['RENATA ISABEL', 'F'], ['GASPAR NICOLÁS', 'M']];
    var apellidos = ['SOTO', 'MUÑOZ', 'ROJAS', 'DÍAZ', 'PÉREZ', 'CONTRERAS', 'SILVA', 'MARTÍNEZ', 'SEPÚLVEDA', 'MORALES', 'FUENTES', 'VALENZUELA', 'ARAYA', 'CASTILLO'];
    var cursos = ['Kinder A', 'Kinder A', '1° Básico A', '1° Básico A', '1° Básico A', '1° Básico B', '3° Básico A', '5° Básico A', '5° Básico B', '6° Básico A', '7° Básico A', '8° Básico B', 'PreKinder A', '1° Básico A'];
    var filas = [['No', 'Rut', 'DV', 'AL Paterno', 'AP Materno', 'AL Nombre', 'Sexo', 'Nacimiento', 'Curso', 'Matrícula', 'Direccion', 'Apod Comuna', 'Apod Nombre', 'Apod Paterno', 'Apod Materno', 'Apod Celular', 'Apod Email', 'Fecha de retiro']];
    nombres.forEach(function (n, i) {
      var cuerpo = String(27100000 + i * 13579), dv = dvDe(cuerpo), anio = 2014 + (i % 8);
      filas.push([i + 1, cuerpo, dv, apellidos[i], apellidos[(i + 5) % 14], n[0], n[1], anio + '-' + p2((i % 12) + 1) + '-' + p2((i % 27) + 1),
        cursos[i], '2026-03-01', 'PASAJE EJEMPLO ' + (100 + i), 'CONCEPCIÓN', 'APODERADO/A', apellidos[(i + 5) % 14], apellidos[(i + 3) % 14], '9' + String(11112222 + i * 7), 'familia' + (i + 1) + '@ejemplo.cl', '']);
    });
    core.importarRegistro(filas, { promover: true });
    persistir();
  }

  function dvDe(cuerpo) {
    var s = 0, m = 2;
    for (var i = cuerpo.length - 1; i >= 0; i--) { s += +cuerpo[i] * m; m = m === 7 ? 2 : m + 1; }
    var r = 11 - (s % 11);
    return r === 11 ? '0' : r === 10 ? 'K' : String(r);
  }

  return {
    llamar: function (accion, payload, token) {
      var r = core.handle(accion, JSON.parse(JSON.stringify(payload || {})), token);
      persistir();
      return JSON.parse(JSON.stringify(r));
    },
    ejemploFamilia: function () {
      var f = env.db.all('Fichas').filter(function (x) { return x.cursoAnterior === '1° Básico A'; })[0];
      if (!f) return null;
      var m = String(f.est_fecha_nacimiento).split('-');
      return { rut: f.rut, clave: m[2] + m[1] + m[0], nombre: f.est_nombres + ' ' + f.est_apellido_paterno };
    },
    reiniciar: function () { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); }
  };
}
