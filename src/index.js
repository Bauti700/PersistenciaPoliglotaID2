import { initDatabaseConnections, closeDatabaseConnections } from './config/database.js';
import { createCliContext } from './cli/cliContext.js';
import { login } from './cli/authCli.js';
import { runMainMenu } from './cli/mainMenu.js';

process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

async function main() {
  console.log('Verificando estado de conexiones...');
  const status = await initDatabaseConnections();
  console.log('Estado de conexión con los motores:');
  console.log(`- PostgreSQL: ${status.postgres ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- MongoDB:    ${status.mongo ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- Neo4j:      ${status.neo4j ? 'CONECTADO' : 'NO DISPONIBLE'}`);
  console.log(`- Redis:      ${status.redis ? 'CONECTADO' : 'NO DISPONIBLE'}`);

  if (!status.postgres && !status.mongo && !status.neo4j && !status.redis) {
    console.log(`
[NOTA]: Si los contenedores de Docker aún no están levantados, ejecute en una terminal:
  docker compose up -d
y luego vuelva a iniciar la aplicaci?n con 'npm start'.
`);
  }

  const context = createCliContext();
  try {
    await login(context);
    await runMainMenu(context);
  } finally {
    context.close();
    await closeDatabaseConnections();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
