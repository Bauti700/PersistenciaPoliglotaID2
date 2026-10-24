import readline from 'readline';
import { initDatabaseConnections, closeDatabaseConnections, pgPool } from './config/database.js';
import { ClienteRepository, ComercialRepository, ContenedorRepository } from './repositories/postgresRepository.js';
import { MongoTelemetryRepository } from './repositories/mongoRepository.js';
import { Neo4jRouteRepository } from './repositories/neo4jRepository.js';
import { RedisCacheRepository } from './repositories/redisRepository.js';
import { LogisticsService } from './services/logisticsService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

function banner() {
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

async function menu() {
  banner();
  let salir = false;

  while (!salir) {
    console.log(`
Seleccione una opción:
  1.  [PostgreSQL] Gestionar Clientes (CRUD y Cuentas Corrientes)
  2.  [PostgreSQL] Gestionar Contenedores (Listado, Alta, Modificación, Baja)
  3.  [PostgreSQL] Emitir Factura y Registrar Pago
  4.  [MongoDB]    Ingresar Lectura de Sensor IoT (Temperatura/GPS/Batería)
  5.  [MongoDB]    Ver Histórico de Lecturas y Detectar Anomalías
  6.  [MongoDB]    Gestionar Incidentes y Alertas
  7.  [MongoDB]    Mensajería y Chat entre Actores
  8.  [Neo4j]      Consultar Ruta Completa de un Envío (Grafo de Tramos)
  9.  [Neo4j]      Ver Red de Relaciones (Clientes - Operadores - Envíos)
  10. [Redis]      Consultar Última Posición GPS en Caché
  11. [Políglota]  Crear Nuevo Envío Sincronizado (PG + Neo4j + Mongo)
  12. [Políglota]  Calcular / Consultar Predicción de Riesgo
  13. [Reporte]    Ranking de Clientes por Volumen Facturado
  0.  Salir
`);

    const opt = (await ask('Opción > ')).trim();

    try {
      switch (opt) {
        case '1': {
          console.log('\n--- CLIENTES REGISTRADOS (PostgreSQL) ---');
          const clientes = await ClienteRepository.listarTodos();
          console.table(clientes.map(c => ({
            ID: c.id_actor,
            Razon_Social: c.razon_social,
            CUIT: c.cuit,
            Pais: c.pais,
            Saldo_CC: `$ ${c.saldo || 0}`
          })));

          console.log('\nAcciones:');
          console.log('  1. Dar de alta nuevo cliente');
          console.log('  2. Ver estado de cuenta corriente de un cliente');
          console.log('  3. Volver al menú principal');
          const subOpt = (await ask('Seleccione acción (1-3) > ')).trim();

          if (subOpt === '1') {
            const razon_social = await ask('Razón Social: ');
            const cuit = await ask('CUIT: ');
            const email = await ask('Email: ');
            const pais = await ask('País: ');
            const nuevo = await ClienteRepository.crear({ razon_social, cuit, email, pais });
            console.log('Cliente creado exitosamente:', nuevo);
          } else if (subOpt === '2') {
            const id_cliente = await ask('ID del Cliente: ');
            const estado = await ComercialRepository.obtenerEstadoCuenta(Number(id_cliente));
            console.log('\nCuenta Corriente:');
            console.table([estado.cuenta_corriente]);
            console.log('\nFacturas asociadas:');
            console.table(estado.facturas);
          }
          break;
        }

        case '2': {
          console.log('\n--- GESTIÓN DE CONTENEDORES (PostgreSQL) ---');
          const contenedores = await ContenedorRepository.listarTodos();
          console.table(contenedores.map(c => ({
            ID: c.id_contenedor,
            Codigo_Int: c.codigo_internacional,
            Tipo: c.tipo,
            Capacidad: `${c.capacidad} kg`,
            Estado: c.estado
          })));

          console.log('\nAcciones:');
          console.log('  1. Dar de alta nuevo contenedor');
          console.log('  2. Modificar contenedor existente');
          console.log('  3. Dar de baja contenedor (baja lógica)');
          console.log('  4. Volver al menú principal');
          const subOpt = (await ask('Seleccione acción (1-4) > ')).trim();

          if (subOpt === '1') {
            const id_contenedor = await ask('ID Contenedor (ej: CONT-100): ');
            const codigo_internacional = await ask('Código Internacional (ej: BICU1234567): ');
            const tipo = await ask('Tipo (DRY / REEFER / OPEN_TOP): ') || 'REEFER';
            const capacidad = await ask('Capacidad (kg): ') || '25000';
            const estado = await ask('Estado (DISPONIBLE / EN_TRANSITO / FUERA_SERVICIO): ') || 'DISPONIBLE';

            const nuevo = await ContenedorRepository.crear({
              id_contenedor,
              codigo_internacional,
              tipo,
              capacidad: Number(capacidad),
              estado
            });
            console.log('\nContenedor creado exitosamente:', nuevo);
          } else if (subOpt === '2') {
            const id = await ask('ID Contenedor a modificar: ');
            const existente = await ContenedorRepository.obtenerPorId(id);
            if (!existente) {
              console.log('Contenedor no encontrado.');
              break;
            }
            console.log('Presione ENTER para mantener el valor actual entre corchetes:');
            const codigo_internacional = (await ask(`Código Internacional [${existente.codigo_internacional}]: `)).trim() || existente.codigo_internacional;
            const tipo = (await ask(`Tipo [${existente.tipo}]: `)).trim() || existente.tipo;
            const capacidad = (await ask(`Capacidad [${existente.capacidad}]: `)).trim() || existente.capacidad;
            const estado = (await ask(`Estado [${existente.estado}]: `)).trim() || existente.estado;

            const modificado = await ContenedorRepository.actualizar(id, {
              codigo_internacional,
              tipo,
              capacidad: Number(capacidad),
              estado
            });
            console.log('\nContenedor actualizado:', modificado);
          } else if (subOpt === '3') {
            const id = await ask('ID Contenedor a dar de baja: ');
            const res = await ContenedorRepository.darDeBaja(id);
            console.log(`\nContenedor ${id} dado de baja (estado FUERA_SERVICIO):`, res);
          }
          break;
        }

        case '3': {
          console.log('\n--- FACTURACIÓN Y PAGOS (PostgreSQL) ---');
          const id_cliente = await ask('ID del Cliente: ');
          const importe = await ask('Importe total a facturar ($): ');
          const factura = await ComercialRepository.emitirFactura({ id_cliente: Number(id_cliente), importe_total: Number(importe) });
          console.log(`Factura N° ${factura.id_factura} emitida correctamente con estado ${factura.estado}.`);

          const pagar = (await ask('¿Desea registrar el cobro de esta factura ahora? (s/n): ')).toLowerCase();
          if (pagar === 's') {
            const medio = await ask('Medio de pago (TRANSFERENCIA/EFECTIVO/TARJETA): ');
            const pago = await ComercialRepository.registrarPago({
              id_factura: factura.id_factura,
              monto: Number(importe),
              medio_pago: medio.toUpperCase()
            });
            console.log('Pago registrado y acreditado en Cuenta Corriente:', pago);
          }
          break;
        }

        case '4': {
          console.log('\n--- INGESTA DE TELEMETRÍA IOT (MongoDB + Redis) ---');
          const id_sensor = await ask('ID Sensor (ej: SENS-101): ') || 'SENS-101';
          const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
          const id_envio = await ask('ID Envío asociado (ej: ENV-1001): ') || 'ENV-1001';
          const temperatura = await ask('Temperatura (°C): ') || '4.5';
          const humedad = await ask('Humedad (%): ') || '60';
          const latitud = await ask('Latitud GPS: ') || '-34.6037';
          const longitud = await ask('Longitud GPS: ') || '-58.3816';

          const res = await LogisticsService.procesarLecturaSensor({
            id_sensor,
            id_contenedor,
            id_envio,
            temperatura,
            humedad,
            vibracion: 0.05,
            latitud,
            longitud,
            nivel_bateria: 90
          });
          console.log('Telemetría guardada en MongoDB y última coordenada actualizada en Redis:', res);
          break;
        }

        case '5': {
          console.log('\n--- HISTÓRICO Y DETECCIÓN DE ANOMALÍAS (MongoDB) ---');
          const id_sensor = await ask('ID Sensor para ver histórico (ej: SENS-101): ') || 'SENS-101';
          const lecturas = await MongoTelemetryRepository.consultarHistoricoLecturas(id_sensor, 5);
          console.log('\nÚltimas 5 lecturas registradas:');
          console.table(lecturas.map(l => ({
            Sensor: l.id_sensor,
            Fecha: l.fecha_hora,
            Temp: `${l.temperatura}°C`,
            Hum: `${l.humedad}%`,
            Coords: JSON.stringify(l.posicion_gps?.coordinates)
          })));

          console.log('\nBuscando anomalías de temperatura (> 8°C)...');
          const anomalias = await MongoTelemetryRepository.detectarAnomaliasTemperatura(8.0);
          console.log(`Se detectaron ${anomalias.length} lecturas anómalas:`);
          console.table(anomalias.map(a => ({
            Sensor: a.id_sensor,
            Fecha: a.fecha_hora,
            Temperatura: `${a.temperatura} °C (Alerta)`,
            Contenedor: a.sensor_info?.id_contenedor || 'N/A'
          })));
          break;
        }

        case '6': {
          console.log('\n--- GESTIÓN DE INCIDENTES Y ALERTAS (MongoDB) ---');
          const incidentes = await MongoTelemetryRepository.listarIncidentesAbiertos();
          console.log('\nIncidentes actualmente abiertos:');
          console.table(incidentes.map(i => ({
            ID: i.id_incidente,
            Envio: i.id_envio,
            Tipo: i.tipo,
            Severidad: i.severidad,
            Estado: i.estado,
            Descripcion: i.descripcion,
            Fecha: i.fecha
          })));

          const crear = (await ask('¿Desea registrar un nuevo incidente? (s/n): ')).toLowerCase();
          if (crear === 's') {
            const id_incidente = `INC-${Date.now().toString().slice(-4)}`;
            const id_envio = await ask('ID Envío asociado (ej: ENV-1001): ') || 'ENV-1001';
            const tipo = await ask('Tipo de incidente (DESVIO_RUTA / RUPTURA_CADENA_FRIO / DEMORA): ') || 'RUPTURA_CADENA_FRIO';
            const severidad = await ask('Severidad (BAJA / MEDIA / ALTA / CRITICA): ') || 'MEDIA';
            const descripcion = await ask('Descripción del incidente: ') || 'Alerta registrada por operador';

            const nuevo = await MongoTelemetryRepository.registrarIncidente({
              id_incidente,
              id_envio,
              tipo,
              severidad,
              descripcion
            });
            console.log('\nIncidente registrado en MongoDB:', nuevo);
          }
          break;
        }

        case '7': {
          console.log('\n--- MENSAJERÍA Y CHAT ENTRE ACTORES (MongoDB) ---');
          const u1 = await ask('Remitente / Usuario 1 (ej: admin@logistica.com): ') || 'admin@logistica.com';
          const u2 = await ask('Destinatario / Usuario 2 (ej: carlos@expressplata.com): ') || 'carlos@expressplata.com';

          const mensajes = await MongoTelemetryRepository.obtenerMensajes(u1, u2);
          console.log(`\nHistorial de mensajes entre ${u1} y ${u2}:`);
          if (mensajes.length === 0) {
            console.log('No hay mensajes previos.');
          } else {
            console.table(mensajes.map(m => ({
              De: m.remitente,
              Para: m.destinatario,
              Fecha: m.fecha,
              Mensaje: m.contenido
            })));
          }

          const enviar = (await ask('¿Desea enviar un mensaje? (s/n): ')).toLowerCase();
          if (enviar === 's') {
            const contenido = await ask('Mensaje a enviar: ');
            if (contenido.trim()) {
              const res = await MongoTelemetryRepository.enviarMensaje({
                remitente: u1,
                destinatario: u2,
                contenido: contenido.trim(),
                tipo: 'PRIVADO'
              });
              console.log('Mensaje enviado y persistido en MongoDB:', res);
            }
          }
          break;
        }

        case '8': {
          console.log('\n--- CONSULTA DE RUTA EN GRAFO (Neo4j) ---');
          const id_envio = await ask('ID del Envío a rastrear (ej: ENV-1001): ') || 'ENV-1001';
          const ruta = await Neo4jRouteRepository.obtenerRutaCompletaEnvio(id_envio);
          if (ruta) {
            console.log(`\nEnvío: ${ruta.envio} | Cliente: ${ruta.cliente}`);
            console.log(`Origen: ${ruta.origen} ===> Destino: ${ruta.destino}`);
            console.log(`Operador Asignado: ${ruta.operador || 'Sin asignar'} | Vehículo: ${ruta.vehiculo || 'Sin asignar'}`);
            console.log('\nTramos del recorrido:');
            console.table(ruta.tramos);
          } else {
            console.log(`No se encontró el envío ${id_envio} en la base de datos de grafos.`);
          }
          break;
        }

        case '9': {
          console.log('\n--- RED LOGÍSTICA COMPLETA (Neo4j) ---');
          const red = await Neo4jRouteRepository.obtenerRedRelaciones();
          console.table(red);
          break;
        }

        case '10': {
          console.log('\n--- CONSULTA DE ÚLTIMA POSICIÓN EN TIEMPO REAL (Redis) ---');
          const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
          const pos = await RedisCacheRepository.obtenerUltimaPosicion(id_contenedor);
          if (pos) {
            console.log(`\nDatos en memoria caché para ${id_contenedor}:`);
            console.log(pos);
          } else {
            console.log(`No hay información en caché de Redis para el contenedor ${id_contenedor}.`);
          }
          break;
        }

        case '11': {
          console.log('\n--- ALTA DE ENVÍO POLÍGLOTA ---');
          const id_envio = await ask('Código Envío (ej: ENV-2005): ') || `ENV-${Date.now().toString().slice(-4)}`;
          const id_cliente = await ask('ID Cliente (ej: 1): ') || '1';
          const origen = await ask('Ciudad Origen: ') || 'Buenos Aires';
          const destino = await ask('Ciudad Destino: ') || 'Montevideo';
          const operador = await ask('Empresa Operadora: ') || 'Logística Express del Plata';
          const vehiculo = await ask('Vehículo Patente: ') || 'AF-204-ZX';

          const res = await LogisticsService.crearEnvioPoliglota({
            id_envio,
            id_cliente: Number(id_cliente),
            origen,
            destino,
            prioridad: 'ALTA',
            operador,
            vehiculo,
            tramos: [
              { desde: origen, hasta: destino, medio: 'Ferry / Fluvial' }
            ]
          });
          console.log('\nEnvío creado y propagado en PostgreSQL, Neo4j y MongoDB exitosamente:');
          console.log(res);
          break;
        }

        case '12': {
          console.log('\n--- PREDICCIÓN DE RIESGO DE DEMORA ---');
          const id_envio = await ask('ID Envío (ej: ENV-1001): ') || 'ENV-1001';
          const riesgo = await LogisticsService.obtenerOPredicirRiesgo(id_envio);
          console.log('\nResultado de predicción:');
          console.log(riesgo);
          break;
        }

        case '13': {
          console.log('\n--- RANKING DE CLIENTES POR VOLUMEN FACTURADO (PostgreSQL) ---');
          const ranking = await ComercialRepository.rankingClientesPorVolumen();
          console.table(ranking);
          break;
        }

        case '0':
          salir = true;
          break;

        default:
          console.log('Opción inválida.');
      }
    } catch (err) {
      console.error(`\n[Error al ejecutar operación]: ${err.message}`);
    }

    if (!salir) {
      await ask('\nPresione ENTER para continuar...');
    }
  }

  rl.close();
  await closeDatabaseConnections();
  console.log('Conexiones cerradas. ¡Hasta luego!');
}

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
y luego vuelva a iniciar la aplicación con 'npm start'.
`);
  }

  await menu();
}

main().catch(console.error);
