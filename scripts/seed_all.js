// =============================================================================
// SEED ALL - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
// Ejecutar con: npm run seed
// Inicializa datos de prueba en todos los motores y crea usuarios por defecto.
// =============================================================================

import { initDatabaseConnections, closeDatabaseConnections } from '../src/config/database.js';
import { SecurityBootstrapService } from '../src/services/securityBootstrapService.js';

async function seedAll() {
  console.log('=== SEED ALL - TPO Persistencia Políglota Grupo 12 ===\n');
  console.log('Conectando a los motores...');

  const status = await initDatabaseConnections();

  console.log(`- PostgreSQL: ${status.postgres ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- MongoDB:    ${status.mongo    ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- Neo4j:      ${status.neo4j    ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- Redis:      ${status.redis    ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log('');

  // ── PostgreSQL: Roles y usuarios por defecto ─────────────────────────────
  if (status.postgres) {
    console.log('[PostgreSQL] Ejecutando bootstrap de seguridad (roles + usuarios)...');
    const result = await SecurityBootstrapService.bootstrap();
    if (result.created) {
      console.log('[PostgreSQL] ✓ Usuarios por defecto creados:');
      console.log('             Admin:   admin@logistica.com  / admin123');
      console.log('             Usuarios: juan.perez@logistica.com, maria.gonzalez@logistica.com,');
      console.log('                       carlos.lopez@logistica.com / usuario123');
    } else if (result.error) {
      console.warn(`[PostgreSQL] ⚠ Error en bootstrap: ${result.error}`);
    } else {
      console.log('[PostgreSQL] ✓ Usuarios ya existentes, se omitió la creación.');
    }
  } else {
    console.warn('[PostgreSQL] ⚠ No disponible, se omitió el seed de usuarios.');
  }

  // ── MongoDB: Recordatorio de init_mongo.js ───────────────────────────────
  if (status.mongo) {
    console.log('\n[MongoDB] ✓ Conexión OK.');
    console.log('          Para cargar los datos de ejemplo de colecciones (sensores, lecturas, etc.)');
    console.log('          ejecutar dentro del contenedor:');
    console.log('          docker exec -i tpo_mongo mongosh < scripts/init_mongo.js');
  }

  // ── Neo4j: Recordatorio de init_neo4j.cypher ─────────────────────────────
  if (status.neo4j) {
    console.log('\n[Neo4j]   ✓ Conexión OK.');
    console.log('          Para cargar el grafo de rutas ejecutar:');
    console.log('          docker exec -i tpo_neo4j cypher-shell -u neo4j -p password123 < scripts/init_neo4j.cypher');
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  if (status.redis) {
    console.log('\n[Redis]   ✓ Conexión OK. No requiere datos iniciales.');
  }

  console.log('\n=== Seed finalizado. ===');
  await closeDatabaseConnections();
}

seedAll().catch((err) => {
  console.error('Error durante el seed:', err);
  process.exit(1);
});
