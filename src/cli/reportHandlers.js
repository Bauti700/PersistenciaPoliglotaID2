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
import { formatDate, formatMoney } from './cliFormatters.js';

export async function handleOption14({ ask, currentUser }) {
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
    let tipo_actor_filtro = tipo_actor;
    if (id_actor && (!tipo_actor_filtro || tipo_actor_filtro === 'TODOS')) {
      tipo_actor_filtro = (await ask('Para filtrar por ID, indique Tipo de Actor (CLIENTE / PROVEEDOR / OPERADOR): ')).trim().toUpperCase();
    }

    const rep = await ReporteComercialRepository.reporteFacturableParametrizado({
      fecha_desde,
      fecha_hasta,
      tipo_actor: tipo_actor_filtro,
      tipo_factura,
      estado_factura,
      id_actor: id_actor ? Number(id_actor) : null
    }, currentUser?.email || 'sistema');

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
        Total: formatMoney(f.importe_total),
        Pagado: formatMoney(f.total_pagado),
        Estado: f.estado,
        Fecha: formatDate(f.fecha_emision)
      })));
    }

    console.log('\n=== RESUMEN MÉTRICO ===');
    console.table([rep.metricas]);
    if (rep.id_reporte_facturable) {
      console.log(`Reporte facturable guardado correctamente. ID: ${rep.id_reporte_facturable}`);
    }
  } else if (opRep === '2') {
    console.log('\n--- REPORTE OPERATIVO DE ENVÍOS ---');
    const pais = (await ask('País (cliente/origen/destino, opcional): ')).trim() || null;
    const estado = (await ask('Estado (CREADO/EN_TRANSITO/ENTREGADO/RETRASADO/CANCELADO, ENTER todos): ')).trim() || null;
    const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
    const solo_demorados = (await ask('Solo demorados (s/n): ')).toLowerCase() === 's';
    const solo_incidentes_abiertos = (await ask('Solo con incidentes abiertos (s/n): ')).toLowerCase() === 's';

    const rep = await ReporteComercialRepository.reporteOperativoEnvios({
      pais, estado, id_cliente: id_cliente ? Number(id_cliente) : null, solo_demorados, solo_incidentes_abiertos
    }, currentUser?.email || 'sistema');
    console.log(`\nRegistros encontrados: ${rep.datos.length}`);
    console.table(rep.datos);
    if (rep.id_reporte_mongo) console.log(`Reporte guardado correctamente. ID: ${rep.id_reporte_mongo}`);
  } else if (opRep === '3') {
    console.log('\n--- TIEMPOS MÁXIMOS Y MÍNIMOS DE ENVÍO POR CLIENTE ---');
    const rep = await ReporteComercialRepository.tiemposEnvioPorCliente(
      currentUser?.email || 'sistema'
    );
    console.table(rep.datos);
    if (rep.id_reporte_mongo) console.log(`Reporte guardado correctamente. ID: ${rep.id_reporte_mongo}`);
  } else if (opRep === '4') {
    console.log('\n--- PROMEDIO DE INCIDENTES POR PAÍS/ESTADO/CLIENTE ---');
    const pais = (await ask('País (opcional): ')).trim() || null;
    const estado = (await ask('Estado (opcional): ')).trim() || null;
    const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
    const rep = await ReporteComercialRepository.promedioIncidentesPorPaisEstadoCliente({
      pais, estado, id_cliente: id_cliente ? Number(id_cliente) : null
    }, currentUser?.email || 'sistema');
    console.table(rep.datos);
    if (rep.id_reporte_mongo) console.log(`Reporte guardado correctamente. ID: ${rep.id_reporte_mongo}`);
  } else if (opRep === '5') {
    console.log('\n--- TIEMPOS PROMEDIO DE ENTREGA ---');
    const rep = await ReporteComercialRepository.tiemposPromedioEntrega(
      currentUser?.email || 'sistema'
    );
    console.table(rep.datos);
    if (rep.id_reporte_mongo) console.log(`Reporte guardado correctamente. ID: ${rep.id_reporte_mongo}`);
  } else if (opRep === '6') {
    console.log('\n--- COSTOS POR TIPO DE TRANSPORTE ---');
    const rep = await ReporteComercialRepository.costosPorTipoTransporte(
      currentUser?.email || 'sistema'
    );
    console.table(rep.datos);
    if (rep.id_reporte_mongo) console.log(`Reporte guardado correctamente. ID: ${rep.id_reporte_mongo}`);
  }
}
