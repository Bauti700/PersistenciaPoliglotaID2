export function parsearIdsContenedores(texto) {
  return (texto || '').split(',').map(id => id.trim()).filter(Boolean);
}

export function banner() {
  console.log(`
========================================================================
   SISTEMA DE MONITOREO Y LOGÍSTICA INTERNACIONAL - GRUPO 12
        PLATAFORMA DE GESTIÓN LOGÍSTICA
========================================================================
`);
}
