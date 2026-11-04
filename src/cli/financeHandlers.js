import { ActorRepository, ClienteRepository, ProveedorRepository, OperadorRepository } from '../repositories/actorRepository.js';
import { FacturaRepository } from '../repositories/facturaRepository.js';
import { PagoRepository } from '../repositories/pagoRepository.js';
import { CuentaCorrienteRepository } from '../repositories/cuentaCorrienteRepository.js';
import { ReporteComercialRepository } from '../repositories/reporteComercialRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { ContenedorAssignmentService } from '../services/contenedorAssignmentService.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { SensorRepository } from '../repositories/sensorRepository.js';
import { LecturaRepository } from '../repositories/lecturaRepository.js';
import { IncidenteRepository, TIPOS_INCIDENTE, ESTADOS_INCIDENTE } from '../repositories/incidenteRepository.js';
import { AlertaRepository } from '../repositories/alertaRepository.js';
import { MensajeRepository } from '../repositories/mensajeRepository.js';
import { UsuarioRepository } from '../repositories/usuarioRepository.js';
import { SesionRepository } from '../repositories/sesionRepository.js';
import { EnvioRepository } from '../repositories/envioRepository.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';

export async function handleOption3({ ask, currentUser }) {
            let salirCom = false;
            while (!salirCom) {
              try {
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

            if (subCom === '0') {
              salirCom = true;
              continue;
            }

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
                const montoCobro = (await ask(`Monto a cobrar (total facturado $${factura.importe_total}) [${factura.importe_total}]: `)).trim() || factura.importe_total;
                const medio = await ask('Medio de pago (TRANSFERENCIA_BANCARIA / EFECTIVO / CHEQUE / TARJETA) [TRANSFERENCIA_BANCARIA]: ') || 'TRANSFERENCIA_BANCARIA';
                const ref = (await ask('Referencia de cobro / comprobante (opcional): ')).trim() || null;
                const resPago = await PagoRepository.registrarPago({
                  id_factura: factura.id_factura,
                  monto: Number(montoCobro),
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

                const tipo_actor = (await ask('Tipo de Actor (PROVEEDOR / OPERADOR): ')).trim().toUpperCase();
                const id_actor = await ask('ID del Proveedor u Operador: ');
                const numero_comprobante = await ask('N° de Factura / Comprobante Externo (ej: FC-A-0001-0004521): ');
                const concepto = await ask('Concepto [Servicio de transporte / insumos]: ') || 'Servicio de transporte / insumos';
                const importe = await ask('Importe total facturado ($): ');
                const id_envio = (await ask('ID Envío asociado (opcional, ej: ENV-1001): ')).trim() || null;

                const facRec = await FacturaRepository.registrarFacturaRecibida({
                  id_actor: Number(id_actor),
                  tipo_actor,
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
                }, currentUser?.email || 'sistema');

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
              } else if (optProv !== '3') {
                console.log('Opción inválida.');
              }

            } else if (subCom === '3') {
              console.log('\n--- CONSULTA DE ESTADO DE CUENTA POR ENTIDAD ---');
              const actores = await ActorRepository.listarTodos();
              console.table(actores.map(a => ({
                ID: a.id_actor,
                Tipo: a.tipo_actor,
                Razon_Social: a.razon_social,
                CUIT: a.cuit,
                Saldo_CC: `$ ${a.saldo}`
              })));

              const tipo_actor = (await ask('Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR, ENTER para autodetectar): ')).trim().toUpperCase() || null;
              const id_actor = await ask('Ingrese ID del Actor a consultar: ');
              const estado = await CuentaCorrienteRepository.obtenerEstadoCuenta(Number(id_actor), tipo_actor);
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
                const tipo_actor = id_actor
                  ? (await ask('Tipo de Actor a cerrar (CLIENTE / PROVEEDOR / OPERADOR): ')).trim().toUpperCase()
                  : null;

                const recalcular = (await ask('¿Recalcular cierres ya existentes del período? (s/n) [n]: ')).trim().toLowerCase();

                console.log(`\nEjecutando cierre contable mensual para el período ${periodo}...`);
                 const resCierre = await CuentaCorrienteRepository.ejecutarCierreMensual({
                  periodo,
                  id_actor: id_actor ? Number(id_actor) : null,
                  tipo_actor,
                  forzar: recalcular === 's',
                  usuario: currentUser?.email || 'sistema'
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
              let tipo_actor_filtro = tipo_actor;
              if (id_actor && (!tipo_actor_filtro || tipo_actor_filtro === 'TODOS')) {
                tipo_actor_filtro = (await ask('Para filtrar por ID, indique Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR): ')).trim().toUpperCase();
              }

              console.log('\nGenerando reporte comercial...');
                const rep = await ReporteComercialRepository.reporteComercialParametrizado({
                fecha_desde,
                fecha_hasta,
                tipo_actor: tipo_actor_filtro,
                tipo_factura,
                estado_factura,
                id_actor: id_actor ? Number(id_actor) : null
              }, currentUser?.email || 'sistema');

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
            } else {
              console.log('Opción inválida.');
            }

            await ask('\nPresione ENTER para continuar...');
          } catch (error) {
            console.log(`\n[Error] ${error.message}`);
            await ask('\nPresione ENTER para continuar...');
          }
            }
}
