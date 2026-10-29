import readline from 'readline';
import { initDatabaseConnections, closeDatabaseConnections, pgPool } from './config/database.js';
import { ActorRepository, ClienteRepository } from './repositories/actorRepository.js';
import { FacturaRepository } from './repositories/facturaRepository.js';
import { PagoRepository } from './repositories/pagoRepository.js';
import { CuentaCorrienteRepository } from './repositories/cuentaCorrienteRepository.js';
import { ReporteComercialRepository } from './repositories/reporteComercialRepository.js';
import { ContenedorRepository } from './repositories/contenedorRepository.js';
import { MongoTelemetryRepository } from './repositories/telemetriaRepository.js';
import { SensorRepository } from './repositories/sensorRepository.js';
import { LecturaRepository } from './repositories/lecturaRepository.js';
import { IncidenteRepository } from './repositories/incidenteRepository.js';
import { AlertaRepository } from './repositories/alertaRepository.js';
import { MensajeRepository } from './repositories/mensajeRepository.js';
import { Neo4jRouteRepository } from './repositories/rutaRepository.js';
import { RedisCacheRepository } from './repositories/cacheRepository.js';
import { LogisticsService } from './services/logisticsService.js';
import { AnalyticsService } from './services/analyticsService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => {
  if (rl.closed) return resolve('');
  rl.question(query, (answer) => {
    if (rl.closed) return resolve('');
    resolve(answer);
  });
});

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
  1.  [PostgreSQL] Gestionar Clientes, Proveedores y Operadores (Actores y CC)
  2.  [PostgreSQL] Gestionar Contenedores (Listado, Alta, Modificación, Baja)
  3.  [Finanzas]   Gestión Comercial y Financiera (Facturación Clientes/Prov, Pagos, CC y Cierres)
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
  14. [Reporte]    Reportes Comerciales Parametrizados (Filtros y Auditoría en MongoDB)
  15. [Analítica]  Ranking de Rutas con Mayor Cantidad de Incidentes (Mongo + PG + Redis)
  16. [Analítica]  Análisis Histórico de Desempeño (Tiempos Entrega, Puntualidad y Costos)
  0.  Salir
`);

    const opt = (await ask('Opción > ')).trim();

    try {
      switch (opt) {
        case '1': {
          console.log('\n--- GESTIÓN DE ACTORES Y CUENTAS CORRIENTES (PostgreSQL) ---');
          const actores = await ActorRepository.listarTodos();
          console.table(actores.map(a => ({
            ID: a.id_actor,
            Tipo: a.tipo_actor,
            Razon_Social: a.razon_social,
            CUIT: a.cuit,
            Pais: a.pais,
            Saldo_CC: `$ ${a.saldo || 0}`
          })));

          console.log('\nAcciones:');
          console.log('  1. Dar de alta nuevo actor (Cliente, Proveedor u Operador)');
          console.log('  2. Ver estado detallado de cuenta corriente de un actor');
          console.log('  3. Volver al menú principal');
          const subOpt = (await ask('Seleccione acción (1-3) > ')).trim();

          if (subOpt === '1') {
            const tipo_actor = (await ask('Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR) [CLIENTE]: ')).trim() || 'CLIENTE';
            const razon_social = await ask('Razón Social: ');
            const cuit = await ask('CUIT: ');
            const email = await ask('Email: ');
            const pais = await ask('País: ');
            const direccion = await ask('Dirección (opcional): ') || null;
            const nuevo = await ActorRepository.crear({ tipo_actor, razon_social, cuit, email, pais, direccion });
            console.log('\nActor creado exitosamente con cuenta corriente inicializada:', nuevo);
          } else if (subOpt === '2') {
            const id_actor = await ask('ID del Actor: ');
            const estado = await CuentaCorrienteRepository.obtenerEstadoCuenta(Number(id_actor));
            console.log(`\n=== ESTADO DE CUENTA: ${estado.actor.razon_social} (${estado.actor.tipo_actor}) ===`);
            console.log('\nCuenta Corriente:');
            console.table([estado.cuenta_corriente]);
            console.log('\nFacturas asociadas:');
            console.table(estado.facturas);
            console.log('\nPagos / Cobros asociados:');
            console.table(estado.pagos);
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
          console.log(`
========================================================================
             MÓDULO DE GESTIÓN COMERCIAL Y FINANCIERA
========================================================================
1. [Clientes]           Emitir Factura de Venta y Registrar Cobro
2. [Proveedores/Oper.]  Registrar Factura Recibida y Realizar Pago
                        (Recepción de facturas ya confeccionadas externamente)
3. [Cuentas Corrientes] Consultar Saldos y Estado de Cuenta por Actor
4. [Cuentas Corrientes] Listar Todas las Cuentas Corrientes (Saldos Generales)
5. [Automatización]     Facturación Automática de Envíos (Cierre / Entrega)
6. [Contabilidad]       Cierre Mensual de Cuentas Corrientes (Ejecutar / Histórico)
7. [Reportes]           Solicitar Reporte Comercial Parametrizado (Guardado en MongoDB)
0. Volver al menú principal
`);
          const subCom = (await ask('Seleccione operación comercial (0-7) > ')).trim();

          if (subCom === '1') {
            console.log('\n--- FACTURACIÓN A CLIENTES (EMISIÓN DE VENTA) ---');
            const clientes = await ActorRepository.listarTodos('CLIENTE');
            console.table(clientes.map(c => ({
              ID: c.id_actor,
              Razon_Social: c.razon_social,
              CUIT: c.cuit,
              Pais: c.pais,
              Saldo_CC: `$ ${c.saldo}`
            })));

            const id_cliente = await ask('ID del Cliente: ');
            const importe = await ask('Importe total a facturar ($): ');
            const concepto = await ask('Concepto de facturación [Servicio de flete y logística internacional]: ') || 'Servicio de flete y logística internacional';
            const id_envio = (await ask('ID Envío asociado (opcional, ej: ENV-1001): ')).trim() || null;

            const factura = await FacturaRepository.emitirFactura({
              id_cliente: Number(id_cliente),
              importe_total: Number(importe),
              concepto,
              id_envio
            });
            console.log(`\nFactura N° ${factura.id_factura} (${factura.numero_comprobante}) emitida correctamente en estado ${factura.estado}.`);
            console.log(`Cuenta corriente de cliente debitada por $${importe}.`);

            const cobrar = (await ask('¿Desea registrar el cobro de esta factura ahora? (s/n): ')).toLowerCase();
            if (cobrar === 's') {
              const medio = await ask('Medio de pago (TRANSFERENCIA_BANCARIA / EFECTIVO / CHEQUE / TARJETA) [TRANSFERENCIA_BANCARIA]: ') || 'TRANSFERENCIA_BANCARIA';
              const ref = (await ask('Referencia de cobro / comprobante (opcional): ')).trim() || null;
              const resPago = await PagoRepository.registrarPago({
                id_factura: factura.id_factura,
                monto: Number(importe),
                medio_pago: medio.toUpperCase(),
                referencia_comprobante: ref
              });
              console.log('\nCobro registrado y acreditado en Cuenta Corriente:', resPago);
            }

          } else if (subCom === '2') {
            console.log('\n--- FACTURAS RECIBIDAS DE PROVEEDORES Y OPERADORES LOGÍSTICOS ---');
            console.log('* Nota: El sistema no crea facturas para proveedores y operadores, sino que recibe facturas ya confeccionadas por ellos.');
            console.log('1. Registrar Factura Recibida');
            console.log('2. Registrar Pago a Factura Recibida Pendiente');
            console.log('3. Volver');
            const optProv = (await ask('Seleccione acción (1-3) > ')).trim();

            if (optProv === '1') {
              const proveedoresOperadores = await ActorRepository.listarTodos();
              const filtrados = proveedoresOperadores.filter(a => a.tipo_actor === 'PROVEEDOR' || a.tipo_actor === 'OPERADOR');
              console.log('\nProveedores y Operadores registrados:');
              console.table(filtrados.map(a => ({
                ID: a.id_actor,
                Tipo: a.tipo_actor,
                Razon_Social: a.razon_social,
                CUIT: a.cuit,
                Saldo_CC: `$ ${a.saldo}`
              })));

              const id_actor = await ask('ID del Proveedor u Operador: ');
              const numero_comprobante = await ask('N° de Factura / Comprobante Externo (ej: FC-A-0001-0004521): ');
              const concepto = await ask('Concepto [Servicio de transporte / insumos]: ') || 'Servicio de transporte / insumos';
              const importe = await ask('Importe total facturado ($): ');
              const id_envio = (await ask('ID Envío asociado (opcional, ej: ENV-1001): ')).trim() || null;

              const facRec = await FacturaRepository.registrarFacturaRecibida({
                id_actor: Number(id_actor),
                importe_total: Number(importe),
                numero_comprobante,
                concepto,
                id_envio
              });
              console.log(`\nFactura recibida N° ${facRec.id_factura} (${facRec.numero_comprobante}) registrada exitosamente.`);
              console.log(`Saldo de cuenta corriente actualizado: se registró la obligación de pago con el tercero.`);

            } else if (optProv === '2') {
              const rep = await ReporteComercialRepository.reporteComercialParametrizado({
                tipo_factura: 'RECIBIDA',
                estado_factura: 'PENDIENTE'
              });

              if (rep.facturas.length === 0) {
                console.log('\nNo hay facturas recibidas de proveedores u operadores pendientes de pago.');
              } else {
                console.log('\nFacturas recibidas pendientes de pago:');
                console.table(rep.facturas.map(f => ({
                  ID_Factura: f.id_factura,
                  Tipo_Actor: f.tipo_actor,
                  Actor: f.razon_social,
                  Comprobante: f.numero_comprobante || '-',
                  Concepto: f.concepto,
                  Total: `$ ${f.importe_total}`,
                  Pagado: `$ ${f.total_pagado}`,
                  Saldo_Pendiente: `$ ${Number(f.importe_total) - Number(f.total_pagado)}`,
                  Envio: f.id_envio || 'N/A'
                })));

                const id_factura = await ask('ID de Factura a pagar: ');
                const monto = await ask('Monto a abonar ($): ');
                const medio = await ask('Medio de pago (TRANSFERENCIA_BANCARIA / CHEQUE / EFECTIVO) [TRANSFERENCIA_BANCARIA]: ') || 'TRANSFERENCIA_BANCARIA';
                const ref = (await ask('Referencia de pago / transferencia: ')).trim() || `TRF-${Date.now().toString().slice(-6)}`;

              const resPago = await PagoRepository.registrarPago({
                  id_factura: Number(id_factura),
                  monto: Number(monto),
                  medio_pago: medio.toUpperCase(),
                  referencia_comprobante: ref
                });
                console.log('\nPago registrado exitosamente y deuda cancelada en Cuenta Corriente:', resPago);
              }
            }

          } else if (subCom === '3') {
            console.log('\n--- CONSULTA DE ESTADO DE CUENTA POR ACTOR ---');
            const actores = await ActorRepository.listarTodos();
            console.table(actores.map(a => ({
              ID: a.id_actor,
              Tipo: a.tipo_actor,
              Razon_Social: a.razon_social,
              CUIT: a.cuit,
              Saldo_CC: `$ ${a.saldo}`
            })));

            const id_actor = await ask('Ingrese ID del Actor a consultar: ');
            const estado = await CuentaCorrienteRepository.obtenerEstadoCuenta(Number(id_actor));
            console.log(`\n=== ESTADO DE CUENTA CORRIENTE: ${estado.actor.razon_social} (${estado.actor.tipo_actor}) ===`);
            console.log(`Saldo Actual: $ ${estado.cuenta_corriente.saldo}`);
            console.log(`Última Actualización: ${estado.cuenta_corriente.fecha_actualizacion}`);

            console.log('\nFacturas Registradas (Emitidas / Recibidas):');
            if (estado.facturas.length === 0) {
              console.log('No tiene facturas registradas.');
            } else {
              console.table(estado.facturas.map(f => ({
                ID: f.id_factura,
                Tipo: f.tipo_factura,
                Comprobante: f.numero_comprobante || '-',
                Concepto: f.concepto,
                Total: `$ ${f.importe_total}`,
                Pagado: `$ ${f.total_pagado}`,
                Estado: f.estado,
                Envio: f.id_envio || '-'
              })));
            }

            console.log('\nHistorial de Pagos / Cobros:');
            if (estado.pagos.length === 0) {
              console.log('No tiene pagos registrados.');
            } else {
              console.table(estado.pagos.map(p => ({
                ID_Pago: p.id_pago,
                Factura: p.id_factura,
                Tipo: p.tipo_pago,
                Monto: `$ ${p.monto}`,
                Medio: p.medio_pago,
                Referencia: p.referencia_comprobante,
                Fecha: p.fecha
              })));
            }

          } else if (subCom === '4') {
            console.log('\n--- LISTADO GENERAL DE CUENTAS CORRIENTES ---');
            console.log('Filtro por tipo de actor:');
            console.log('  1. Clientes');
            console.log('  2. Proveedores');
            console.log('  3. Operadores Logísticos');
            console.log('  4. Todos');
            const fOpt = (await ask('Opción (1-4) [4]: ')).trim() || '4';
            const tipoMap = { '1': 'CLIENTE', '2': 'PROVEEDOR', '3': 'OPERADOR', '4': null };
            const lista = await ActorRepository.listarTodos(tipoMap[fOpt]);

            console.table(lista.map(a => ({
              ID: a.id_actor,
              Tipo: a.tipo_actor,
              Razon_Social: a.razon_social,
              CUIT: a.cuit,
              Pais: a.pais,
              Saldo_CC: `$ ${a.saldo}`,
              Estado_Saldo: Number(a.saldo) < 0 ? 'DEUDOR' : (Number(a.saldo) > 0 ? 'A FAVOR' : 'EQUILIBRADO'),
              Ultima_Actualizacion: a.cc_actualizacion
            })));

          } else if (subCom === '5') {
            console.log('\n--- FACTURACIÓN AUTOMÁTICA POR CIERRE DE ENVÍO ---');
            console.log('1. Facturar un envío específico (por entrega/cierre)');
            console.log('2. Ejecutar proceso automático masivo para envíos pendientes');
            const autoOpt = (await ask('Opción (1-2) > ')).trim();

            if (autoOpt === '1') {
              const id_envio = await ask('Código del Envío a facturar (ej: ENV-1001): ');
              const resAuto = await FacturaRepository.facturacionAutomaticaPorEnvio(id_envio.trim());
              if (resAuto.ya_facturado) {
                console.log(`\n[AVISO]: ${resAuto.mensaje}`);
              } else {
                console.log('\n[ÉXITO] Facturación automática completada:');
                console.log(`Factura N° ${resAuto.factura.id_factura} emitida por un total de $${resAuto.factura.importe_total}.`);
                console.log('Desglose de cálculo comercial:');
                console.log(`- Tarifa Base: $${resAuto.calculo.base}`);
                console.log(`- Tramos de recorrido: ${resAuto.calculo.tramos} tramo(s) ($${resAuto.calculo.costo_tramos})`);
                console.log(`- Factor por prioridad: x${resAuto.calculo.factor_prioridad}`);
                console.log(`- Importe total calculado: $${resAuto.calculo.total}`);
                console.log('El envío fue actualizado a estado ENTREGADO y se registró auditoría en MongoDB.');
              }
            } else if (autoOpt === '2') {
              console.log('\nEjecutando proceso de facturación automática por lote...');
              const resultados = await FacturaRepository.ejecutarFacturacionAutomaticaMasiva();
              if (resultados.length === 0) {
                console.log('No se encontraron envíos pendientes de facturación automática.');
              } else {
                console.table(resultados.map(r => ({
                  Envio: r.id_envio,
                  Estado: r.exito ? 'FACTURADO' : 'ERROR',
                  Factura_ID: r.factura?.id_factura || '-',
                  Importe: r.factura ? `$ ${r.factura.importe_total}` : '-',
                  Detalle: r.exito ? 'Factura emitida y registrada en CC' : r.error
                })));
              }
            }

          } else if (subCom === '6') {
            console.log('\n--- CIERRE MENSUAL DE CUENTAS CORRIENTES ---');
            console.log('1. Ejecutar Cierre Mensual del período');
            console.log('2. Consultar historial de cierres mensuales');
            const cOpt = (await ask('Opción (1-2) > ')).trim();

            if (cOpt === '1') {
              const defPeriodo = new Date().toISOString().slice(0, 7);
              const periodo = (await ask(`Período a cerrar (YYYY-MM) [${defPeriodo}]: `)).trim() || defPeriodo;
              const id_actor = (await ask('Filtrar por ID Actor específico (opcional, ENTER para todos): ')).trim() || null;

              console.log(`\nEjecutando cierre contable mensual para el período ${periodo}...`);
               const resCierre = await CuentaCorrienteRepository.ejecutarCierreMensual({
                periodo,
                id_actor: id_actor ? Number(id_actor) : null
              });

              console.log(`\nCierre mensual ${resCierre.periodo} finalizado. Actores procesados: ${resCierre.total_procesados}.`);
              console.table(resCierre.cierres.map(c => ({
                ID: c.id_actor,
                Tipo: c.tipo_actor,
                Actor: c.razon_social,
                Saldo_Inicial: `$ ${c.saldo_inicial}`,
                Facturado_Mes: `$ ${c.total_facturado}`,
                Pagado_Mes: `$ ${c.total_pagado}`,
                Saldo_Cierre: `$ ${c.saldo_final}`
              })));
              console.log('Auditoría contable registrada en colección documental MongoDB (db.reportes).');

            } else if (cOpt === '2') {
              const per = (await ask('Período a consultar (YYYY-MM o ENTER para todos): ')).trim() || null;
               const historico = await CuentaCorrienteRepository.consultarCierresMensuales(per);
              if (historico.length === 0) {
                console.log('No se registran cierres mensuales para el criterio especificado.');
              } else {
                console.table(historico.map(h => ({
                  Periodo: h.periodo,
                  Actor: h.razon_social,
                  Tipo: h.tipo_actor,
                  Saldo_Inicial: `$ ${h.saldo_inicial}`,
                  Total_Debe: `$ ${h.total_debe}`,
                  Total_Haber: `$ ${h.total_haber}`,
                  Saldo_Final: `$ ${h.saldo_final}`,
                  Fecha_Cierre: h.fecha_cierre,
                  Estado: h.estado
                })));
              }
            }

          } else if (subCom === '7') {
            console.log('\n--- SOLICITUD DE REPORTE COMERCIAL PARAMETRIZADO ---');
            console.log('Ingrese parámetros de filtro (ENTER para omitir filtro):');
            const fecha_desde = (await ask('Fecha Desde (YYYY-MM-DD): ')).trim() || null;
            const fecha_hasta = (await ask('Fecha Hasta (YYYY-MM-DD): ')).trim() || null;
            const tipo_actor = (await ask('Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR / TODOS) [TODOS]: ')).trim() || 'TODOS';
            const tipo_factura = (await ask('Tipo de Factura (EMITIDA / RECIBIDA / TODAS) [TODAS]: ')).trim() || 'TODAS';
            const estado_factura = (await ask('Estado de Factura (PENDIENTE / PAGADA / TODAS) [TODAS]: ')).trim() || 'TODAS';
            const id_actor = (await ask('ID Actor específico (opcional): ')).trim() || null;

            console.log('\nGenerando reporte comercial...');
              const rep = await ReporteComercialRepository.reporteComercialParametrizado({
              fecha_desde,
              fecha_hasta,
              tipo_actor,
              tipo_factura,
              estado_factura,
              id_actor: id_actor ? Number(id_actor) : null
            });

            console.log('\n=== COMPROBANTES ENCONTRADOS ===');
            if (rep.facturas.length === 0) {
              console.log('No se encontraron comprobantes con los filtros indicados.');
            } else {
              console.table(rep.facturas.map(f => ({
                ID: f.id_factura,
                Tipo_Factura: f.tipo_factura,
                Nro_Comprobante: f.numero_comprobante || '-',
                Actor: f.razon_social,
                Tipo_Actor: f.tipo_actor,
                Concepto: f.concepto,
                Total: `$ ${f.importe_total}`,
                Pagado: `$ ${f.total_pagado}`,
                Estado: f.estado,
                Fecha: f.fecha_emision
              })));
            }

            console.log('\n=== MÉTRICAS CONSOLIDADAS DEL REPORTE ===');
            console.table([rep.metricas]);
            if (rep.id_reporte_mongo) {
              console.log(`Documento de reporte persistido en MongoDB (Colección: reportes, ID: ${rep.id_reporte_mongo})`);
            }
          }
          break;
        }

        case '4': {
          console.log('\n--- INGESTA DE TELEMETRÍA IOT (MongoDB + Redis) ---');
          console.log('1. Registrar lectura de sensor');
          console.log('2. ABM Sensores (Alta/Listado/Editar/Baja/Activar)');
          console.log('3. Asignar sensor a contenedor');
          console.log('4. Listar sensores por contenedor');
          console.log('5. Reglas y Alertas de estado');
          console.log('6. Ejecutar monitoreo de sensores (Alertas por batería/inactividad)');
          console.log('7. Volver');
          const subIoT = (await ask('Opción (1-7): ')).trim();
          
          if (subIoT === '1') {
            const id_sensor = await ask('ID Sensor (ej: SENS-101): ') || 'SENS-101';
            const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
            const id_envio = await ask('ID Envío asociado (ej: ENV-1001): ') || 'ENV-1001';
            const temperatura = await ask('Temperatura (°C): ') || '4.5';
            const humedad = await ask('Humedad (%): ') || '60';
            const latitud = await ask('Latitud GPS: ') || '-34.6037';
            const longitud = await ask('Longitud GPS: ') || '-58.3816';
            const nivel_bateria = await ask('Nivel batería (%): ') || '90';

            const res = await LogisticsService.procesarLecturaSensor({
              id_sensor,
              id_contenedor,
              id_envio,
              temperatura,
              humedad,
              vibracion: 0.05,
              latitud,
              longitud,
              nivel_bateria
            });
            console.log('\nTelemetría guardada en MongoDB y última coordenada actualizada en Redis');
            console.log(res);
          } else if (subIoT === '2') {
            console.log('\n--- ABM DE SENSORES IOT ---');
            console.log('1. Alta de sensor');
            console.log('2. Listar sensores');
            console.log('3. Editar sensor');
            console.log('4. Dar de baja sensor');
            console.log('5. Activar sensor');
            console.log('6. Volver');
            const abmOpt = (await ask('Opción (1-6): ')).trim();
            
            if (abmOpt === '1') {
              const id_sensor = await ask('ID Sensor: ');
              const tipo = await ask('Tipo (TEMPERATURA/HUMEDAD/GPS/VIBRACION): ');
              const fabricante = await ask('Fabricante: ');
              const id_contenedor = await ask('ID Contenedor asociado: ');
              const sensor = await SensorRepository.registrarSensor({
                id_sensor,
                tipo,
                fabricante,
                id_contenedor,
                estado: 'ACTIVO'
              });
              console.log('\nSensor registrado:', sensor);
            } else if (abmOpt === '2') {
              const sensores = await SensorRepository.listarSensores();
              console.table(sensores);
            } else if (abmOpt === '3') {
              const id_sensor = await ask('ID Sensor a editar: ');
              const tipo = await ask('Nuevo tipo (ENTER para mantener): ') || undefined;
              const fabricante = await ask('Nuevo fabricante (ENTER para mantener): ') || undefined;
              const datos = {};
              if (tipo) datos.tipo = tipo;
              if (fabricante) datos.fabricante = fabricante;
              const actualizado = await SensorRepository.actualizarSensor(id_sensor, datos);
              console.log(actualizado ? '\nSensor actualizado:' : '\nSensor no encontrado', actualizado || '');
            } else if (abmOpt === '4') {
              const id_sensor = await ask('ID Sensor a dar de baja: ');
              const resultado = await SensorRepository.darDeBajaSensor(id_sensor);
              console.log(resultado ? '\nSensor dado de baja:' : '\nSensor no encontrado', resultado || '');
            } else if (abmOpt === '5') {
              const id_sensor = await ask('ID Sensor a activar: ');
              const resultado = await SensorRepository.activarSensor(id_sensor);
              console.log(resultado ? '\nSensor activado:' : '\nSensor no encontrado', resultado || '');
            }
          } else if (subIoT === '3') {
            const id_envio = await ask('ID Envío: ');
            const id_contenedor = await ask('ID Contenedor: ');
            const id_sensor = await ask('ID Sensor: ');
            await Neo4jRouteRepository.asignarSensorAContenedorEnvio(id_envio, id_contenedor, id_sensor);
            await SensorRepository.asignarSensorAContenedor(id_sensor, id_contenedor);
            console.log('\nSensor asignado a contenedor/envío correctamente.');
          } else if (subIoT === '4') {
            const id_contenedor = await ask('ID Contenedor: ');
            const sensores = await SensorRepository.listarSensoresPorContenedor(id_contenedor);
            console.table(sensores);
          } else if (subIoT === '5') {
            console.log('\n--- REGLAS Y ALERTAS ---');
            console.log('1. Crear regla de alerta');
            console.log('2. Listar reglas');
            console.log('3. Desactivar regla');
            console.log('4. Listar alertas abiertas');
            console.log('5. Cerrar alerta');
            console.log('6. Volver');
            const rOpt = (await ask('Opción (1-6): ')).trim();
            if (rOpt === '1') {
              const id_regla = await ask('ID Regla (ej: REG-TEMP-01): ');
              const tipo = await ask('Tipo (TEMPERATURA/BATERIA/INACTIVIDAD): ');
              const umbral = await ask('Umbral: ');
              const severidad = await ask('Severidad (BAJA/MEDIA/ALTA/CRITICA): ');
              const descripcion = await ask('Descripción: ');
              const regla = await AlertaRepository.crearRegla({ id_regla, tipo, umbral, severidad, descripcion });
              console.log('\nRegla creada:', regla);
            } else if (rOpt === '2') {
              const reglas = await AlertaRepository.listarReglas();
              console.table(reglas);
            } else if (rOpt === '3') {
              const id_regla = await ask('ID Regla a desactivar: ');
              const res = await AlertaRepository.desactivarRegla(id_regla);
              console.log(res ? '\nRegla desactivada' : '\nRegla no encontrada');
            } else if (rOpt === '4') {
              const alertas = await AlertaRepository.listarAlertasAbiertas();
              console.table(alertas);
            } else if (rOpt === '5') {
              const id_alerta = await ask('ID Alerta a cerrar: ');
              const res = await AlertaRepository.cerrarAlerta(id_alerta);
              console.log(res ? '\nAlerta cerrada' : '\nAlerta no encontrada');
            }
          } else if (subIoT === '6') {
            console.log('\nEjecutando monitoreo de sensores...');
            const monitoreo = await LogisticsService.ejecutarMonitoreoSensores();
            console.log(`Alertas generadas: ${monitoreo.alertas_generadas}`);
            if (monitoreo.alertas.length > 0) console.table(monitoreo.alertas);
          }
          break;
        }

        case '5': {
          console.log('\n--- HISTÓRICO Y DETECCIÓN DE ANOMALÍAS (MongoDB) ---');
          const id_sensor = await ask('ID Sensor para ver histórico (ej: SENS-101): ') || 'SENS-101';
          const lecturas = await LecturaRepository.consultarHistoricoLecturas(id_sensor, 5);
          console.log('\nÚltimas 5 lecturas registradas:');
          console.table(lecturas.map(l => ({
            Sensor: l.id_sensor,
            Fecha: l.fecha_hora,
            Temp: `${l.temperatura}°C`,
            Hum: `${l.humedad}%`,
            Coords: JSON.stringify(l.posicion_gps?.coordinates)
          })));

          console.log('\nBuscando anomalías de temperatura (> 8°C)...');
          const anomalias = await LecturaRepository.detectarAnomaliasTemperatura(8.0);
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
          const incidentes = await IncidenteRepository.listarIncidentesAbiertos();
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
          console.log('1. Ruta completa de un envío');
          console.log('2. Reconstrucción del recorrido de un contenedor');
          console.log('3. Historial completo de movimientos de un contenedor');
          console.log('4. Volver');
          const subRuta = (await ask('Opción (1-4): ')).trim();
          
          if (subRuta === '1') {
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
          } else if (subRuta === '2') {
            const id_contenedor = await ask('ID Contenedor: ');
            const recorrido = await Neo4jRouteRepository.reconstruirRecorridoContenedor(id_contenedor);
            console.log('\nRecorrido reconstruido:');
            console.table(recorrido);
          } else if (subRuta === '3') {
            const id_contenedor = await ask('ID Contenedor: ');
            const movimientos = await Neo4jRouteRepository.historialMovimientosContenedor(id_contenedor);
            console.table(movimientos);
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
          console.log('1. Crear envío completo');
          console.log('2. Asignar contenedor a envío');
          console.log('3. Asignar sensor a contenedor/envío');
          const opEnv = (await ask('Opción (1-3): ')).trim();
          if (opEnv === '1') {
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
          } else if (opEnv === '2') {
            const id_envio = await ask('ID Envío: ');
            const id_contenedor = await ask('ID Contenedor: ');
            await Neo4jRouteRepository.asignarContenedorAEnvio(id_envio, id_contenedor);
            console.log('\nContenedor asignado a envío correctamente.');
          } else if (opEnv === '3') {
            const id_envio = await ask('ID Envío: ');
            const id_contenedor = await ask('ID Contenedor: ');
            const id_sensor = await ask('ID Sensor: ');
            await Neo4jRouteRepository.asignarSensorAContenedorEnvio(id_envio, id_contenedor, id_sensor);
            await SensorRepository.asignarSensorAContenedor(id_sensor, id_contenedor);
            console.log('\nSensor asignado a contenedor/envío correctamente.');
          }
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
          const ranking = await ReporteComercialRepository.rankingClientesPorVolumen();
          console.table(ranking);
          break;
        }

        case '14': {
          console.log('\n--- REPORTES OPERATIVOS Y ANALÍTICOS PARAMETRIZADOS ---');
          console.log('1. Reporte Comercial Parametrizado (Facturable)');
          console.log('2. Reporte Operativo de Envíos (país/estado/cliente/demorados/incidentes)');
          console.log('3. Tiempos Máximos y Mínimos de Envío por Cliente');
          console.log('4. Promedio de Incidentes por País/Estado/Cliente');
          console.log('5. Tiempos Promedio de Entrega');
          console.log('6. Costos por Tipo de Transporte');
          console.log('7. Volver');
          const opRep = (await ask('Opción (1-7): ')).trim();
          
          if (opRep === '1') {
            console.log('\n--- REPORTE COMERCIAL PARAMETRIZADO (Facturable) ---');
            console.log('Ingrese filtros (ENTER para omitir):');
            const fecha_desde = (await ask('Fecha Desde (YYYY-MM-DD): ')).trim() || null;
            const fecha_hasta = (await ask('Fecha Hasta (YYYY-MM-DD): ')).trim() || null;
            const tipo_actor = (await ask('Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR / TODOS) [TODOS]: ')).trim() || 'TODOS';
            const tipo_factura = (await ask('Tipo de Factura (EMITIDA / RECIBIDA / TODAS) [TODAS]: ')).trim() || 'TODAS';
            const estado_factura = (await ask('Estado de Factura (PENDIENTE / PAGADA / TODAS) [TODAS]: ')).trim() || 'TODAS';
            const id_actor = (await ask('ID Actor específico (opcional): ')).trim() || null;

            const rep = await ReporteComercialRepository.reporteFacturableParametrizado({
              fecha_desde,
              fecha_hasta,
              tipo_actor,
              tipo_factura,
              estado_factura,
              id_actor: id_actor ? Number(id_actor) : null
            });

            console.log('\n=== COMPROBANTES ENCONTRADOS ===');
            if (rep.facturas.length === 0) {
              console.log('No se encontraron comprobantes con los filtros especificados.');
            } else {
              console.table(rep.facturas.map(f => ({
                ID: f.id_factura,
                Tipo: f.tipo_factura,
                Nro_Comp: f.numero_comprobante || '-',
                Actor: f.razon_social,
                Tipo_Actor: f.tipo_actor,
                Concepto: f.concepto,
                Total: `$ ${f.importe_total}`,
                Pagado: `$ ${f.total_pagado}`,
                Estado: f.estado,
                Fecha: f.fecha_emision
              })));
            }

            console.log('\n=== RESUMEN MÉTRICO ===');
            console.table([rep.metricas]);
            if (rep.id_reporte_facturable) {
              console.log(`Reporte facturable guardado en MongoDB: ${rep.id_reporte_facturable}`);
            }
          } else if (opRep === '2') {
            console.log('\n--- REPORTE OPERATIVO DE ENVÍOS ---');
            const pais = (await ask('País (opcional): ')).trim() || null;
            const estado = (await ask('Estado (CREADO/EN_TRANSITO/ENTREGADO/RETRASADO): ')).trim() || null;
            const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
            const solo_demorados = (await ask('Solo demorados (s/n): ')).toLowerCase() === 's';
            const solo_incidentes_abiertos = (await ask('Solo con incidentes abiertos (s/n): ')).toLowerCase() === 's';
            
            const rep = await ReporteComercialRepository.reporteOperativoEnvios({
              pais, estado, id_cliente: id_cliente ? Number(id_cliente) : null, solo_demorados, solo_incidentes_abiertos
            });
            console.log(`\nRegistros encontrados: ${rep.datos.length}`);
            console.table(rep.datos);
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
          } else if (opRep === '3') {
            console.log('\n--- TIEMPOS MÁXIMOS Y MÍNIMOS DE ENVÍO POR CLIENTE ---');
            const datos = await ReporteComercialRepository.tiemposEnvioPorCliente();
            console.table(datos);
          } else if (opRep === '4') {
            console.log('\n--- PROMEDIO DE INCIDENTES POR PAÍS/ESTADO/CLIENTE ---');
            const pais = (await ask('País (opcional): ')).trim() || null;
            const estado = (await ask('Estado (opcional): ')).trim() || null;
            const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
            const datos = await ReporteComercialRepository.promedioIncidentesPorPaisEstadoCliente({
              pais, estado, id_cliente: id_cliente ? Number(id_cliente) : null
            });
            console.table(datos);
          } else if (opRep === '5') {
            console.log('\n--- TIEMPOS PROMEDIO DE ENTREGA ---');
            const datos = await ReporteComercialRepository.tiemposPromedioEntrega();
            console.table(datos);
          } else if (opRep === '6') {
            console.log('\n--- COSTOS POR TIPO DE TRANSPORTE ---');
            const datos = await ReporteComercialRepository.costosPorTipoTransporte();
            console.table(datos);
          }
          break;
        }

        case '15': {
          console.log('\n--- RANKING DE RUTAS CON MAYOR CANTIDAD DE INCIDENTES (MongoDB + PostgreSQL + Redis) ---');
          const forzar = (await ask('¿Desea forzar recálculo omitiendo la caché de Redis? (s/n) [n]: ')).toLowerCase() === 's';
          console.log('\nCalculando correlación políglota de rutas e incidentes...');
          const res = await AnalyticsService.rankingRutasConMasIncidentes({ forzarRecalculo: forzar });
          console.log(`[Origen de datos: ${res.origen_datos}] | Rutas evaluadas: ${res.total_rutas_evaluadas}`);

          console.table(res.ranking.map(r => ({
            Ruta: r.ruta,
            Viajes: r.total_viajes,
            Incidentes: r.total_incidentes,
            'Tasa (Inc/Viaje)': r.tasa_incidentes_por_viaje,
            Críticos: r.incidentes_criticos,
            Leves: r.incidentes_leves,
            Abiertos: r.incidentes_abiertos,
            Riesgo: r.nivel_riesgo,
            'Tipos Frecuentes': r.tipos_recurrentes
          })));

          console.log('\nRecomendaciones Operativas por Ruta:');
          res.ranking.forEach(r => {
            console.log(`* [${r.nivel_riesgo}] ${r.ruta}: ${r.recomendacion}`);
          });
          break;
        }

        case '16': {
          console.log('\n--- ANÁLISIS HISTÓRICO DE DESEMPEÑO LOGÍSTICO (PostgreSQL + MongoDB + Redis) ---');
          const id_cliente = (await ask('Filtrar por ID Cliente específico (opcional, ENTER para global): ')).trim() || null;
          console.log('\nProcesando análisis de tiempos, puntualidad y costos...');
          const res = await AnalyticsService.analisisHistoricoDesempeno({ id_cliente });

          console.log(`\n[Origen de datos: ${res.origen_datos}]`);
          console.log('\n=== RESUMEN GENERAL DE ENVÍOS ===');
          console.table([res.resumen_general]);

          console.log('\n=== MÉTRICAS DE TIEMPOS DE ENTREGA Y PUNTUALIDAD ===');
          console.table([res.metricas_tiempos_entrega]);

          console.log('\n=== DESEMPEÑO Y TIEMPOS DE ENTREGA POR CLIENTE ===');
          console.table(res.desempeno_por_cliente.map(c => ({
            ID_Cliente: c.id_cliente,
            Cliente: c.cliente,
            Pais: c.pais,
            Envíos_Totales: c.total_envios,
            Entregados: c.envios_entregados,
            'Tiempo Prom (días)': c.tiempo_promedio_dias,
            'Tiempo Mín (días)': c.tiempo_minimo_dias,
            'Tiempo Máx (días)': c.tiempo_maximo_dias
          })));

          console.log('\n=== COSTOS Y VOLÚMENES POR MEDIO DE TRANSPORTE ===');
          console.table(res.costos_por_tipo_transporte);

          console.log('\n=== CONFIABILIDAD OPERATIVA POR OPERADOR LOGÍSTICO ===');
          console.table(res.confiabilidad_operadores);

          console.log('\nInforme analítico histórico persistido en MongoDB (Colección: reportes, Categoría: INTELIGENCIA_ANALITICA)');
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
