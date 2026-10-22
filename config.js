/* =====================================================================
   CONFIGURACIÓN DE LA PÁGINA
   URL de la «Aplicación web» de Apps Script (termina en /exec).
   Si se deja vacía, la página funciona en MODO DEMOSTRACIÓN.
   Para probar la demostración sin tocar los datos reales, agregue ?demo
   al final de la dirección (ej.: https://usuario.github.io/fichas-matricula/?demo).
   ===================================================================== */
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyQKA8Gu1S2PVYCEvE3fiuZ4e1dzOQxhZoWoXii_AR2piFP4muKvVR4VryKLCGfBJd3/exec'
};
if (/[?&]demo\b/.test(location.search)) window.APP_CONFIG.API_URL = '';
