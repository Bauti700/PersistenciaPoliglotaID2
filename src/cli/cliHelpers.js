// Función para parsear una cadena de IDs de contenedores, separándolos por comas y eliminando los espacios en blanco.
export function parsearIdsContenedores(texto) {
  return (texto || '').split(',').map(id => id.trim()).filter(Boolean);
}

// Función para mostrar un banner de bienvenida en la CLI, indicando el nombre del sistema y la plataforma de gestión logística.
export function banner() {
  console.log(`
========================================================================
   SISTEMA DE MONITOREO Y LOGÍSTICA INTERNACIONAL - GRUPO 12
        PLATAFORMA DE GESTIÓN LOGÍSTICA
========================================================================
`);
}
