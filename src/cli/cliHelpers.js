export function parsearIdsContenedores(texto) {
  return (texto || '').split(',').map(id => id.trim()).filter(Boolean);
}

export function banner() {
  console.log(`
========================================================================
   SISTEMA DE MONITOREO Y LOGÍSTICA INTERNACIONAL - GRUPO 12
        ARQUITECTURA DE PERSISTENCIA POLÍGLOTA (SQL + NoSQL)
========================================================================
Motores soportados:
  [PostgreSQL] -> Gestión Comercial, Clientes, Contenedores, Facturación (ACID)
  [MongoDB]    -> Telemetría IoT, Sensores, Incidentes, Alertas, Chat
  [Neo4j]      -> Redes de Transporte, Tramos y Topología Logística
  [Redis]      -> Caché de Última Ubicación GPS, Sesiones con TTL, Riesgos
========================================================================
`);
}
