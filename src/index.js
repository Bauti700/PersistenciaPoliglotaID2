import readline from 'readline';
import { initDatabaseConnections, closeDatabaseConnections, pgPool } from './config/database.js';
import { ActorRepository, ClienteRepository, ProveedorRepository, OperadorRepository } from './repositories/actorRepository.js';
import { FacturaRepository } from './repositories/facturaRepository.js';
import { PagoRepository } from './repositories/pagoRepository.js';
import { CuentaCorrienteRepository } from './repositories/cuentaCorrienteRepository.js';
import { ReporteComercialRepository } from './repositories/reporteComercialRepository.js';
import { ContenedorRepository } from './repositories/contenedorRepository.js';
import { MongoTelemetryRepository } from './repositories/telemetriaRepository.js';
import { SensorRepository } from './repositories/sensorRepository.js';
import { LecturaRepository } from './repositories/lecturaRepository.js';
import { IncidenteRepository, TIPOS_INCIDENTE, ESTADOS_INCIDENTE } from './repositories/incidenteRepository.js';
import { AlertaRepository } from './repositories/alertaRepository.js';
import { MensajeRepository } from './repositories/mensajeRepository.js';
import { UsuarioRepository } from './repositories/usuarioRepository.js';
import { SesionRepository } from './repositories/sesionRepository.js';
import { EnvioRepository } from './repositories/envioRepository.js';

let currentUser = null;

async function login() {
  console.log('\n==================== AUTENTICACIÓN ====================');
  console.log('Ingrese sus credenciales para acceder al sistema');
  console.log('====================================================\n');
  let intentos = 0;
  while (!currentUser && intentos < 3) {
    const email = (await ask('Email: ')).trim();
    if (!email) {
      console.log('Email requerido\n');
      intentos++;
      continue;
    }
    const password = (await ask('Contraseña: ')).trim();
    if (!password) {
      console.log('Contraseña requerida\n');
      intentos++;
      continue;
    }
    
    try {
      const user = await UsuarioRepository.autenticar(email, password);
      if (!user) {
        console.log('Credenciales inválidas o usuario bloqueado.\n');
        intentos++;
        continue;
      }
      
      currentUser = user;
      
      try {
        const sesion = await SesionRepository.crearSesion({
          id_usuario: user.id_usuario,
          email: user.email,
          id_rol: user.id_rol,
          ip: '127.0.0.1',
          ttl: 3600
        });
        currentUser = { ...user, token: sesion.token };
      } catch (e) {
        console.warn(`[Aviso] No se pudo registrar la sesión en Redis/PostgreSQL: ${e.message}`);
      }
      
      console.log(`\nBienvenido/a: ${user.nombre} ${user.apellido} | Rol: ${user.rol_descripcion || 'N/A'} | Estado: ${user.estado}`);
      console.log('====================================================\n');
    } catch (e) {
      console.log(`Error de autenticación: ${e.message}\n`);
      intentos++;
    }
  }
  
  if (!currentUser) {
    console.log('Demasiados intentos fallidos. Cerrando aplicación...');
    process.exit(0);
  }
}
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

function parsearIdsContenedores(texto) {
  return (texto || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

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


async function menuABMEntidad(nombrePlural, nombreSingular, repo, idField) {
  let salir = false;
  while (!salir) {
    console.log(`\n--- LISTADO DE ${nombrePlural.toUpperCase()} (PostgreSQL) ---`);
    const items = await repo.listarTodos();
    if (items.length === 0) {
      console.log(`No hay ${nombrePlural.toLowerCase()} registrados.\n`);
    } else {
      console.table(items.map(it => ({
        ID: it[idField],
        Razon_Social: it.razon_social,
        CUIT: it.cuit,
        Email: it.email,
        Telefono: it.telefono || '-',
        Direccion: it.direccion || '-',
        Pais: it.pais,
        Estado: it.estado,
        Saldo_CC: `$ ${it.saldo || 0}`
      })));
    }

    console.log(`Acciones para ${nombrePlural}:`);
    console.log(`  1. Dar de alta nuevo ${nombreSingular.toLowerCase()}`);
    console.log(`  2. Modificar ${nombreSingular.toLowerCase()}`);
    console.log(`  3. Dar de baja ${nombreSingular.toLowerCase()} (baja lógica: INACTIVO)`);
    console.log(`  4. Activar ${nombreSingular.toLowerCase()}`);
    console.log(`  5. Eliminar ${nombreSingular.toLowerCase()} definitivamente (baja física)`);
    console.log(`  6. Consultar ${nombreSingular.toLowerCase()} por ID`);
    console.log(`  0. Volver al menú de entidades`);

    const accion = (await ask(`Seleccione acción (0-6) > `)).trim();

    if (accion === '1') {
      console.log(`\n--- ALTA DE ${nombreSingular.toUpperCase()} ---`);
      const razon_social = (await ask('Razón Social: ')).trim();
      const cuit = (await ask('CUIT: ')).trim();
      const email = (await ask('Email: ')).trim();
      const telefono = (await ask('Teléfono (opcional): ')).trim() || null;
      const direccion = (await ask('Dirección (opcional): ')).trim() || null;
      const pais = (await ask('País: ')).trim();

      const nuevo = await repo.crear({ razon_social, cuit, email, telefono, direccion, pais });
      console.log(`\n✓ ${nombreSingular} creado exitosamente:`, nuevo);
    } else if (accion === '2') {
      const id = Number(await ask(`ID del ${nombreSingular} a modificar: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`⚠ ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      console.log('Presione ENTER para mantener el valor actual:');
      const razon_social = (await ask(`Razón Social [${existente.razon_social}]: `)).trim() || existente.razon_social;
      const email = (await ask(`Email [${existente.email}]: `)).trim() || existente.email;
      const telefono = (await ask(`Teléfono [${existente.telefono || ''}]: `)).trim() || existente.telefono;
      const direccion = (await ask(`Dirección [${existente.direccion || ''}]: `)).trim() || existente.direccion;
      const pais = (await ask(`País [${existente.pais}]: `)).trim() || existente.pais;

      const modificado = await repo.actualizar(id, { razon_social, email, telefono, direccion, pais });
      console.log(`\n✓ ${nombreSingular} actualizado exitosamente:`, modificado);
    } else if (accion === '3') {
      const id = Number(await ask(`ID del ${nombreSingular} a dar de baja: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`⚠ ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      const confirmar = (await ask(`¿Confirma la baja lógica de "${existente.razon_social}"? (s/n): `)).trim().toLowerCase();
      if (confirmar === 's') {
        const resBaja = await repo.darDeBaja(id);
        console.log(`\n✓ ${nombreSingular} dado de baja (estado INACTIVO):`, resBaja);
      } else {
        console.log('Operación cancelada.');
      }
    } else if (accion === '4') {
      const id = Number(await ask(`ID del ${nombreSingular} a activar: `));
      const resAct = await repo.activar(id);
      if (resAct) {
        console.log(`\n✓ ${nombreSingular} reactivado (estado ACTIVO):`, resAct);
      } else {
        console.log(`⚠ ${nombreSingular} no encontrado.`);
      }
    } else if (accion === '5') {
      const id = Number(await ask(`ID del ${nombreSingular} a eliminar DEFINITIVAMENTE: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`⚠ ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      const confirmar = (await ask(`¿Está seguro de ELIMINAR FÍSICAMENTE a "${existente.razon_social}"? Esta acción no se puede deshacer. (s/n): `)).trim().toLowerCase();
      if (confirmar === 's') {
        try {
          const resEliminado = await repo.eliminar(id);
          console.log(`\n✓ ${nombreSingular} eliminado de la base de datos:`, resEliminado);
        } catch (err) {
          console.error(`\n⚠ No se pudo eliminar: ${err.message}`);
        }
      } else {
        console.log('Operación cancelada.');
      }
    } else if (accion === '6') {
      const id = Number(await ask(`ID del ${nombreSingular}: `));
      const item = await repo.obtenerPorId(id);
      if (!item) {
        console.log(`⚠ ${nombreSingular} no encontrado.`);
      } else {
        console.table([item]);
      }
    } else if (accion === '0') {
      salir = true;
    }
  }
}

async function menu() {
  banner();
  let salir = false;

  while (!salir) {
    console.log(`
Seleccione una opción:
  1.  [PostgreSQL] Gestionar Clientes, Proveedores y Operadores (ABMs Separados)
  2.  [PostgreSQL] Gestionar Contenedores (Listado, Alta, Modificación, Baja)
  3.  [Finanzas]   Gestión Comercial y Financiera (Facturación Clientes/Prov, Pagos, CC y Cierres)
  4.  [MongoDB]    Telemetría IoT (Lecturas, ABM Sensores, Reglas y Alertas)
  5.  [MongoDB]    Ver Histórico de Lecturas y Detectar Anomalías
  6.  [MongoDB]    Gestionar Incidentes y Alertas
  7.  [MongoDB]    Mensajería y Chat (MongoDB)
  8.  [Neo4j]      Consultar Ruta Completa de un Envío (Grafo de Tramos)
  9.  [Neo4j]      Ver Red de Relaciones (Clientes - Operadores - Envíos)
  10. [Redis]      Consultar Última Posición GPS en Caché
  11. [Políglota]  ABM de Envíos (Alta, Modificación, Estado, Cancelación, Asignaciones)
  12. [Políglota]  Calcular / Consultar Predicción de Riesgo
  13. [Reporte]    Ranking de Clientes por Volumen Transportado / Facturado
  14. [Reporte]    Reportes Operativos y Analíticos (Filtros y Auditoría en MongoDB)
  15. [Analítica]  Ranking de Rutas con Mayor Cantidad de Incidentes (Mongo + PG + Redis)
  16. [Analítica]  Análisis Histórico de Desempeño (Tiempos Entrega, Puntualidad y Costos)
${UsuarioRepository.esAdministrador(currentUser) ? '  17. [Seguridad]   ABM Usuarios, Roles y Sesiones\n' : ''}  18. [Sesión]      Cerrar sesión actual y volver a autenticarse
  0.  Salir
`);

    const opt = (await ask('Opción > ')).trim();

    try {
      switch (opt) {
        case '1': {
          let volverSub = false;
          while (!volverSub) {
            console.log(`
========================================================================
   GESTIÓN SEPARADA DE ENTIDADES LOGÍSTICAS (PostgreSQL)
========================================================================
  1. ABM Clientes (Listado, Alta, Modificación, Baja, Eliminación)
  2. ABM Proveedores (Listado, Alta, Modificación, Baja, Eliminación)
  3. ABM Operadores Logísticos (Listado, Alta, Modificación, Baja, Eliminación)
  4. Consultar Estado de Cuenta Corriente por Entidad
  0. Volver al menú principal
`);
            const subOpt = (await ask('Seleccione entidad a gestionar (0-4) > ')).trim();

            if (subOpt === '1') {
              await menuABMEntidad('Clientes', 'Cliente', ClienteRepository, 'id_cliente');
            } else if (subOpt === '2') {
              await menuABMEntidad('Proveedores', 'Proveedor', ProveedorRepository, 'id_proveedor');
            } else if (subOpt === '3') {
              await menuABMEntidad('Operadores Logísticos', 'Operador', OperadorRepository, 'id_operador');
            } else if (subOpt === '4') {
              console.log('\n--- CONSULTA DE ESTADO DE CUENTA CORRIENTE ---');
              const tipoEntidad = (await ask('Tipo de entidad (CLIENTE / PROVEEDOR / OPERADOR) [CLIENTE]: ')).trim() || 'CLIENTE';
              const id_actor = Number(await ask('ID de la entidad: '));
              try {
                const estado = await CuentaCorrienteRepository.obtenerEstadoCuenta(id_actor, tipoEntidad.toUpperCase());
                console.log(`\n=== ESTADO DE CUENTA: ${estado.actor.razon_social} (${estado.actor.tipo_actor}) ===`);
                console.log('\nCuenta Corriente:');
                console.table([estado.cuenta_corriente]);
                console.log('\nFacturas asociadas:');
                console.table(estado.facturas);
                console.log('\nPagos / Cobros asociados:');
                console.table(estado.pagos);
              } catch (e) {
                console.log(`⚠ Error al consultar cuenta corriente: ${e.message}`);
              }
            } else if (subOpt === '0') {
              volverSub = true;
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '2': {
          let salirCont = false;
          while (!salirCont) {
            console.log('\n--- GESTIÓN DE CONTENEDORES (PostgreSQL) ---');
            const contenedores = await ContenedorRepository.listarTodos();
            if (contenedores.length === 0) {
              console.log('No hay contenedores registrados.');
            } else {
              console.table(contenedores.map(c => ({
                ID: c.id_contenedor,
                Codigo_Int: c.codigo_internacional,
                Tipo: c.tipo,
                Capacidad: `${c.capacidad} kg`,
                Estado: c.estado
              })));
            }

            console.log('\nAcciones:');
            console.log('  1. Dar de alta nuevo contenedor');
            console.log('  2. Modificar contenedor existente');
            console.log('  3. Dar de baja contenedor (baja lógica)');
            console.log('  4. Activar contenedor');
            console.log('  5. Eliminar contenedor definitivamente');
            console.log('  6. Consultar contenedor por ID');
            console.log('  0. Volver al menú principal');
            const subOpt = (await ask('Seleccione acción (0-6) > ')).trim();

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
                capacidad,
                estado
              });
              console.log('\nContenedor creado exitosamente:', nuevo);
            } else if (subOpt === '2') {
              const id = await ask('ID Contenedor a modificar: ');
              const existente = await ContenedorRepository.obtenerPorId(id);
              if (!existente) {
                console.log('Contenedor no encontrado.');
                continue;
              }
              console.log('Presione ENTER para mantener el valor actual entre corchetes:');
              const codigo_internacional = (await ask(`Código Internacional [${existente.codigo_internacional}]: `)).trim() || existente.codigo_internacional;
              const tipo = (await ask(`Tipo [${existente.tipo}]: `)).trim() || existente.tipo;
              const capacidad = (await ask(`Capacidad [${existente.capacidad}]: `)).trim() || existente.capacidad;
              const estado = (await ask(`Estado [${existente.estado}]: `)).trim() || existente.estado;

              const modificado = await ContenedorRepository.actualizar(id, {
                codigo_internacional,
                tipo,
                capacidad,
                estado
              });
              console.log('\nContenedor actualizado:', modificado);
            } else if (subOpt === '3') {
              const id = await ask('ID Contenedor a dar de baja: ');
              const res = await ContenedorRepository.darDeBaja(id);
              console.log(res ? `\nContenedor ${id} dado de baja (estado FUERA_SERVICIO):` : '\nContenedor no encontrado.', res || '');
            } else if (subOpt === '4') {
              const id = await ask('ID Contenedor a activar: ');
              const res = await ContenedorRepository.activar(id);
              console.log(res ? `\nContenedor ${id} activado (estado DISPONIBLE):` : '\nContenedor no encontrado.', res || '');
            } else if (subOpt === '5') {
              const id = await ask('ID Contenedor a eliminar DEFINITIVAMENTE: ');
              const existente = await ContenedorRepository.obtenerPorId(id);
              if (!existente) {
                console.log('Contenedor no encontrado.');
                continue;
              }
              const conf = (await ask(`¿Eliminar físicamente el contenedor "${id}"? (s/n): `)).trim().toLowerCase();
              if (conf === 's') {
                try {
                  const res = await ContenedorRepository.eliminar(id);
                  console.log('\nContenedor eliminado:', res);
                } catch (error) {
                  console.log(`\n[No se pudo eliminar] ${error.message}`);
                }
              } else {
                console.log('Operación cancelada.');
              }
            } else if (subOpt === '6') {
              const id = await ask('ID Contenedor: ');
              const item = await ContenedorRepository.obtenerPorId(id);
              console.log(item ? '\nContenedor encontrado:' : '\nContenedor no encontrado.', item || '');
            } else if (subOpt === '0') {
              salirCont = true;
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '3': {
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
          break;
        }

        case '4': {
          let salirIoT = false;
          while (!salirIoT) {
            console.log('\n--- INGESTA DE TELEMETRÍA IOT (MongoDB + Redis) ---');
            console.log('1. Registrar lectura de sensor');
            console.log('2. ABM Sensores (Alta/Listado/Editar/Baja/Activar/Eliminar)');
            console.log('3. Asignar sensor a contenedor/envío');
            console.log('4. Listar sensores por contenedor');
            console.log('5. Reglas y Alertas de estado');
            console.log('6. Ejecutar monitoreo de sensores (Alertas por batería/inactividad)');
            console.log('0. Volver');
            const subIoT = (await ask('Opción (0-6): ')).trim();

            if (subIoT === '0') {
              salirIoT = true;
              continue;
            }

            if (subIoT === '1') {
              const id_sensor = await ask('ID Sensor (ej: SENS-101): ') || 'SENS-101';
              const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
              const id_envio = (await ask('ID Envío asociado (ej: ENV-1001, ENTER para omitir): ')).trim() || null;
              const leerNumeroOpcional = async (mensaje) => {
                const valor = (await ask(mensaje)).trim();
                return valor === '' ? null : valor;
              };
              console.log('Deje vacío cualquier métrica opcional; las coordenadas 0 son válidas.');
              const temperatura = await leerNumeroOpcional('Temperatura (°C, ENTER para omitir): ');
              const humedad = await leerNumeroOpcional('Humedad (%, ENTER para omitir): ');
              const vibracion = await leerNumeroOpcional('Vibración (ENTER para omitir): ');
              const latitud = await leerNumeroOpcional('Latitud GPS (ENTER para omitir, 0 es válido): ');
              const longitud = await leerNumeroOpcional('Longitud GPS (ENTER para omitir, 0 es válido): ');
              const nivel_bateria = await leerNumeroOpcional('Nivel batería (%, ENTER para omitir): ');

              const res = await LogisticsService.procesarLecturaSensor({
                id_sensor,
                id_contenedor,
                id_envio,
                temperatura,
                humedad,
                vibracion,
                latitud,
                longitud,
                nivel_bateria
              });
              console.log('\nTelemetría guardada en MongoDB, posición actualizada en Redis y lectura proyectada en Neo4j.');
              console.log(
                `Alertas generadas: ${res.alertas_generadas} | Incidentes generados: ${res.incidentes_generados}`
              );
              if (res.alertas.length > 0) {
                console.table(res.alertas.map(a => ({
                  ID: a.id_alerta,
                  Tipo: a.tipo,
                  Severidad: a.severidad,
                  Mensaje: a.mensaje
                })));
              }
              if (res.incidentes.length > 0) {
                console.table(res.incidentes.map(i => ({
                  ID: i.id_incidente,
                  Tipo: i.tipo,
                  Severidad: i.severidad,
                  Estado: i.estado,
                  Descripcion: i.descripcion
                })));
              }
            } else if (subIoT === '2') {
              let salirSensores = false;
              while (!salirSensores) {
                console.log('\n--- ABM DE SENSORES IOT ---');
                const sensores = await SensorRepository.listarSensores();
                if (sensores.length === 0) {
                  console.log('No hay sensores registrados.');
                } else {
                  console.table(sensores.map(s => ({
                    ID: s.id_sensor,
                    Tipo: s.tipo,
                    Fabricante: s.fabricante || '-',
                    Contenedor: s.id_contenedor || 'Sin asignar',
                    Estado: s.estado,
                    Instalacion: s.fecha_instalacion
                  })));
                }
                console.log('1. Alta de sensor');
                console.log('2. Listar sensores');
                console.log('3. Editar sensor (incluye reasignar contenedor)');
                console.log('4. Dar de baja sensor');
                console.log('5. Activar sensor');
                console.log('6. Eliminar sensor definitivamente');
                console.log('0. Volver');
                const abmOpt = (await ask('Opción (0-6): ')).trim();

                if (abmOpt === '0') {
                  salirSensores = true;
                } else if (abmOpt === '1') {
                  const id_sensor = await ask('ID Sensor: ');
                  const tipo = await ask('Tipo (TEMPERATURA/HUMEDAD/GPS/VIBRACION): ');
                  const fabricante = (await ask('Fabricante: ')).trim() || null;
                  const id_contenedor = (await ask('ID Contenedor asociado (ENTER para dejar sin asignar): ')).trim() || null;
                  const sensor = await SensorRepository.registrarSensor({
                    id_sensor,
                    tipo,
                    fabricante,
                    id_contenedor,
                    estado: 'ACTIVO'
                  });
                  console.log('\nSensor registrado:', sensor);
                } else if (abmOpt === '2') {
                  const lista = await SensorRepository.listarSensores();
                  console.table(lista);
                } else if (abmOpt === '3') {
                  const id_sensor = await ask('ID Sensor a editar: ');
                  const sensor = await SensorRepository.obtenerSensorPorId(id_sensor);
                  if (!sensor) {
                    console.log('Sensor no encontrado.');
                    continue;
                  }
                  console.log('Presione ENTER para mantener el valor actual:');
                  const tipo = (await ask(`Tipo [${sensor.tipo}]: `)).trim();
                  const fabricante = (await ask(`Fabricante [${sensor.fabricante || '-'}]: `)).trim();
                  const contenedorActual = sensor.id_contenedor || 'sin asignar';
                  const id_contenedor = (await ask(
                    `ID Contenedor [${contenedorActual}] (ENTER mantiene, "-" desasigna): `
                  )).trim();
                  const estado = (await ask(`Estado (ACTIVO/INACTIVO) [${sensor.estado}]: `)).trim();

                  const datos = {};
                  if (tipo) datos.tipo = tipo;
                  if (fabricante) datos.fabricante = fabricante;
                  if (id_contenedor === '-') datos.id_contenedor = null;
                  else if (id_contenedor) datos.id_contenedor = id_contenedor;
                  if (estado) datos.estado = estado;

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
                } else if (abmOpt === '6') {
                  const id_sensor = await ask('ID Sensor a eliminar DEFINITIVAMENTE: ');
                  const conf = (await ask(
                    `¿Eliminar físicamente el sensor "${id_sensor}"? Solo es posible si no tiene lecturas, alertas ni incidentes. (s/n): `
                  )).trim().toLowerCase();
                  if (conf === 's') {
                    try {
                      const ok = await SensorRepository.eliminarSensor(id_sensor);
                      console.log(ok ? '\nSensor eliminado.' : '\nSensor no encontrado.');
                    } catch (error) {
                      console.log(`\n[No se pudo eliminar] ${error.message}`);
                    }
                  } else {
                    console.log('Operación cancelada.');
                  }
                } else {
                  console.log('Opción inválida.');
                }
              }
            } else if (subIoT === '3') {
              const id_sensor = await ask('ID Sensor: ');
              const id_contenedor = await ask('ID Contenedor: ');
              const id_envio = (await ask('ID Envío (ENTER para asignar sólo al contenedor): ')).trim();

              try {
                if (id_envio) {
                  const res = await LogisticsService.asignarSensorAContenedorEnvio({
                    id_envio,
                    id_contenedor,
                    id_sensor
                  });
                  console.log('\nSensor asignado a contenedor/envío correctamente:', res);
                } else {
                  const sensor = await SensorRepository.asignarSensorAContenedor(id_sensor, id_contenedor);
                  console.log('\nSensor asignado al contenedor correctamente:', sensor);
                }
              } catch (error) {
                console.log(`\n[No se pudo asignar] ${error.message}`);
              }
            } else if (subIoT === '4') {
              const id_contenedor = await ask('ID Contenedor: ');
              const sensores = await SensorRepository.listarSensoresPorContenedor(id_contenedor);
              if (sensores.length === 0) {
                console.log('El contenedor no tiene sensores asignados.');
              } else {
                console.table(sensores);
              }
            } else if (subIoT === '5') {
              let salirReglas = false;
              while (!salirReglas) {
                console.log('\n--- REGLAS Y ALERTAS ---');
                console.log('1. Crear regla de alerta');
                console.log('2. Listar reglas');
                console.log('3. Modificar regla');
                console.log('4. Activar regla');
                console.log('5. Desactivar regla');
                console.log('6. Eliminar regla');
                console.log('7. Ver reglas efectivas (con valores por defecto)');
                console.log('8. Listar alertas (con filtros)');
                console.log('9. Listar alertas abiertas');
                console.log('10. Cerrar alerta');
                console.log('0. Volver');
                const rOpt = (await ask('Opción (0-10): ')).trim();

                if (rOpt === '0') {
                  salirReglas = true;
                } else if (rOpt === '1') {
                  const id_regla = (await ask('ID Regla (ENTER para generar automáticamente): ')).trim() || undefined;
                  const tipo = (await ask('Tipo (TEMPERATURA/BATERIA/INACTIVIDAD): ')).trim();
                  const condicion = (await ask(
                    'Condición (MAYOR_QUE/MAYOR_IGUAL_QUE/MENOR_QUE/MENOR_IGUAL_QUE/IGUAL_QUE, ENTER según tipo): '
                  )).trim() || undefined;
                  const umbral = (await ask('Umbral: ')).trim();
                  const severidad = (await ask('Severidad (BAJA/MEDIA/ALTA/CRITICA): ')).trim() || 'MEDIA';
                  const descripcion = (await ask('Descripción: ')).trim() || undefined;
                  const regla = await AlertaRepository.crearRegla({
                    id_regla,
                    tipo,
                    condicion,
                    umbral,
                    severidad,
                    descripcion
                  });
                  console.log('\nRegla creada:', regla);
                } else if (rOpt === '2') {
                  const reglas = await AlertaRepository.listarReglas();
                  if (reglas.length === 0) {
                    console.log('No hay reglas configuradas. Se aplican los umbrales por defecto.');
                  } else {
                    console.table(reglas.map(r => ({
                      ID: r.id_regla,
                      Tipo: r.tipo,
                      Condicion: r.condicion,
                      Umbral: r.umbral,
                      Severidad: r.severidad,
                      Activa: r.activa,
                      Descripcion: r.descripcion || '-'
                    })));
                  }
                } else if (rOpt === '3') {
                  const id_regla = await ask('ID Regla a modificar: ');
                  const regla = await AlertaRepository.obtenerReglaPorId(id_regla);
                  if (!regla) {
                    console.log('Regla no encontrada.');
                    continue;
                  }
                  console.log('Presione ENTER para mantener el valor actual:');
                  const condicion = (await ask(`Condición [${regla.condicion}]: `)).trim();
                  const umbral = (await ask(`Umbral [${regla.umbral}]: `)).trim();
                  const severidad = (await ask(`Severidad [${regla.severidad}]: `)).trim();
                  const descripcion = (await ask(`Descripción [${regla.descripcion || '-'}]: `)).trim();
                  const activa = (await ask(`Activa [${regla.activa}] (s/n): `)).trim();

                  const datos = {};
                  if (condicion) datos.condicion = condicion;
                  if (umbral) datos.umbral = Number(umbral);
                  if (severidad) datos.severidad = severidad;
                  if (descripcion) datos.descripcion = descripcion;
                  if (activa) datos.activa = activa.toLowerCase() === 's';

                  const actualizada = await AlertaRepository.actualizarRegla(id_regla, datos);
                  console.log(actualizada ? '\nRegla actualizada:' : '\nRegla no encontrada', actualizada || '');
                } else if (rOpt === '4') {
                  const id_regla = await ask('ID Regla a activar: ');
                  const res = await AlertaRepository.activarRegla(id_regla);
                  console.log(res ? '\nRegla activada' : '\nRegla no encontrada');
                } else if (rOpt === '5') {
                  const id_regla = await ask('ID Regla a desactivar: ');
                  const res = await AlertaRepository.desactivarRegla(id_regla);
                  console.log(res ? '\nRegla desactivada' : '\nRegla no encontrada');
                } else if (rOpt === '6') {
                  const id_regla = await ask('ID Regla a eliminar: ');
                  const conf = (await ask(`¿Eliminar la regla "${id_regla}"? (s/n): `)).trim().toLowerCase();
                  if (conf === 's') {
                    try {
                      const ok = await AlertaRepository.eliminarRegla(id_regla);
                      console.log(ok ? '\nRegla eliminada' : '\nRegla no encontrada');
                    } catch (error) {
                      console.log(`\n[No se pudo eliminar] ${error.message}`);
                    }
                  } else {
                    console.log('Operación cancelada.');
                  }
                } else if (rOpt === '7') {
                  const reglas = await AlertaRepository.listarReglasEfectivas();
                  console.log('\nReglas efectivas aplicadas por el monitoreo:');
                  console.table(reglas.map(r => ({
                    Tipo: r.tipo,
                    Condicion: r.condicion,
                    Umbral: r.umbral,
                    Severidad: r.severidad,
                    Activa: r.activa,
                    Origen: r.id_regla.startsWith('REG-DEF-')
                      ? 'DEFAULT'
                      : (r.id_regla.startsWith('REG-DESACTIVADA-') ? 'DESACTIVADA' : 'MONGODB'),
                    Descripcion: r.descripcion || '-'
                  })));
                } else if (rOpt === '8') {
                  const estado = (await ask('Estado (ABIERTA/PENDIENTE/CERRADA, ENTER todas): ')).trim() || null;
                  const tipo = (await ask(
                    'Tipo (TEMPERATURA/BATERIA/INACTIVIDAD/INCIDENTE, ENTER todos): '
                  )).trim() || null;
                  const id_sensor = (await ask('ID Sensor (opcional): ')).trim() || null;
                  const id_contenedor = (await ask('ID Contenedor (opcional): ')).trim() || null;
                  const id_incidente = (await ask('ID Incidente (opcional): ')).trim() || null;
                  const alertas = await AlertaRepository.listarAlertas({
                    estado,
                    tipo,
                    id_sensor,
                    id_contenedor,
                    id_incidente,
                    limite: 100
                  });
                  if (alertas.length === 0) {
                    console.log('No se encontraron alertas con esos filtros.');
                  } else {
                    console.table(alertas.map(a => ({
                      ID: a.id_alerta,
                      Sensor: a.id_sensor || '-',
                      Contenedor: a.id_contenedor || '-',
                      Incidente: a.id_incidente || '-',
                      Tipo: a.tipo,
                      Severidad: a.severidad,
                      Estado: a.estado,
                      Mensaje: a.mensaje,
                      Fecha: a.fecha
                    })));
                  }
                } else if (rOpt === '9') {
                  const alertas = await AlertaRepository.listarAlertasAbiertas();
                  if (alertas.length === 0) {
                    console.log('No hay alertas abiertas.');
                  } else {
                    console.table(alertas);
                  }
                } else if (rOpt === '10') {
                  const id_alerta = await ask('ID Alerta a cerrar: ');
                  const res = await AlertaRepository.cerrarAlerta(id_alerta);
                  console.log(res ? '\nAlerta cerrada' : '\nAlerta no encontrada');
                } else {
                  console.log('Opción inválida.');
                }
              }
            } else if (subIoT === '6') {
              console.log('\nEjecutando monitoreo de sensores...');
              const monitoreo = await LogisticsService.ejecutarMonitoreoSensores();
              console.log(
                `Alertas generadas: ${monitoreo.alertas_generadas} | ` +
                `Incidentes generados: ${monitoreo.incidentes_generados}`
              );
              if (monitoreo.alertas.length > 0) {
                console.table(monitoreo.alertas.map(a => ({
                  ID: a.id_alerta,
                  Sensor: a.id_sensor,
                  Tipo: a.tipo,
                  Severidad: a.severidad,
                  Mensaje: a.mensaje
                })));
              }
              if (monitoreo.incidentes.length > 0) {
                console.table(monitoreo.incidentes.map(i => ({
                  ID: i.id_incidente,
                  Sensor: i.id_sensor,
                  Tipo: i.tipo,
                  Severidad: i.severidad,
                  Estado: i.estado,
                  Descripcion: i.descripcion
                })));
              }
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '5': {
          console.log('\n--- HISTÓRICO Y DETECCIÓN DE ANOMALÍAS (MongoDB) ---');
          console.log('1. Histórico por sensor');
          console.log('2. Histórico por contenedor');
          const modo = (await ask('Opción (1-2) [1]: ')).trim() || '1';
          const identificador = modo === '2'
            ? (await ask('ID Contenedor (ej: CONT-001): ')).trim()
            : (await ask('ID Sensor (ej: SENS-101): ')).trim();
          const desde = (await ask('Desde (YYYY-MM-DD, ENTER sin límite): ')).trim() || null;
          const hasta = (await ask('Hasta (YYYY-MM-DD, ENTER sin límite): ')).trim() || null;
          const limite = (await ask('Cantidad máxima de lecturas [10]: ')).trim() || '10';

          const lecturas = modo === '2'
            ? await LecturaRepository.consultarHistoricoPorContenedor(
                identificador,
                limite,
                { desde, hasta }
              )
            : await LecturaRepository.consultarHistoricoLecturas(
                identificador,
                limite,
                { desde, hasta }
              );

          console.log(`\nSe encontraron ${lecturas.length} lecturas:`);
          if (lecturas.length === 0) {
            console.log('No hay lecturas para los filtros indicados.');
          } else {
            console.table(lecturas.map(l => ({
              Sensor: l.id_sensor,
              Contenedor: l.id_contenedor || '-',
              Fecha: l.fecha_hora,
              Temperatura: l.temperatura !== null && l.temperatura !== undefined ? `${l.temperatura} °C` : '-',
              Humedad: l.humedad !== null && l.humedad !== undefined ? `${l.humedad} %` : '-',
              Bateria: l.nivel_bateria !== null && l.nivel_bateria !== undefined ? `${l.nivel_bateria} %` : '-',
              Coords: l.posicion_gps?.coordinates
                ? l.posicion_gps.coordinates.join(', ')
                : '-'
            })));
          }

          const reglaTemperatura = await AlertaRepository.obtenerReglaAplicable('TEMPERATURA');
          if (!reglaTemperatura) {
            console.log(
              '\nLa detección de anomalías de temperatura está desactivada: ' +
              'no hay una regla activa para ese tipo.'
            );
          } else {
            console.log(
              `\nBuscando anomalías de temperatura (${reglaTemperatura.condicion} ` +
              `${reglaTemperatura.umbral}°C según regla ${reglaTemperatura.id_regla})...`
            );
            const anomalias = await LecturaRepository.detectarAnomaliasTemperatura(
              reglaTemperatura.umbral,
              reglaTemperatura.condicion,
              { desde, hasta, limite }
            );
            console.log(`Se detectaron ${anomalias.length} lecturas anómalas:`);
            console.table(anomalias.map(a => ({
              Sensor: a.id_sensor,
              Fecha: a.fecha_hora,
              Temperatura: `${a.temperatura} °C (Alerta)`,
              Contenedor: a.id_contenedor || a.sensor_info?.id_contenedor || 'N/A'
            })));
          }
          break;
        }

        case '6': {
          let salirIncidentes = false;
          while (!salirIncidentes) {
            console.log('\n--- GESTIÓN DE INCIDENTES (MongoDB) ---');
            console.log('1. Listar incidentes con filtros');
            console.log('2. Registrar incidente manual (genera alerta)');
            console.log('3. Cerrar incidente y sus alertas');
            console.log('4. Incidentes agrupados por envío');
            console.log('0. Volver');
            const optIncidente = (await ask('Opción (0-4): ')).trim();

            if (optIncidente === '0') {
              salirIncidentes = true;
            } else if (optIncidente === '1') {
              const estado = (await ask(
                `Estado (${ESTADOS_INCIDENTE.join('/')}, ENTER todos): `
              )).trim() || null;
              const tipo = (await ask(
                `Tipo (${TIPOS_INCIDENTE.join('/')}, ENTER todos): `
              )).trim() || null;
              const id_envio = (await ask('ID Envío (opcional): ')).trim() || null;
              const id_sensor = (await ask('ID Sensor (opcional): ')).trim() || null;
              const id_contenedor = (await ask('ID Contenedor (opcional): ')).trim() || null;
              const limite = (await ask('Cantidad máxima [100]: ')).trim() || '100';

              const incidentes = await IncidenteRepository.listarIncidentes({
                estado,
                tipo,
                id_envio,
                id_sensor,
                id_contenedor,
                limite
              });
              if (incidentes.length === 0) {
                console.log('No se encontraron incidentes con esos filtros.');
              } else {
                console.table(incidentes.map(i => ({
                  ID: i.id_incidente,
                  Envio: i.id_envio || '-',
                  Sensor: i.id_sensor || '-',
                  Contenedor: i.id_contenedor || '-',
                  Tipo: i.tipo,
                  Severidad: i.severidad,
                  Estado: i.estado,
                  Descripcion: i.descripcion || '-',
                  Fecha: i.fecha
                })));
              }
            } else if (optIncidente === '2') {
              const id_incidente = (await ask(
                'ID Incidente (ENTER para generar automáticamente): '
              )).trim() || undefined;
              const id_envio = (await ask('ID Envío asociado (opcional): ')).trim() || null;
              const id_sensor = (await ask('ID Sensor asociado (opcional): ')).trim() || null;
              const id_contenedor = (await ask('ID Contenedor asociado (opcional): ')).trim() || null;
              const tipo = (await ask(
                `Tipo (${TIPOS_INCIDENTE.join('/')}) [OTRO]: `
              )).trim() || 'OTRO';
              const severidad = (await ask('Severidad (BAJA/MEDIA/ALTA/CRITICA) [MEDIA]: ')).trim() || 'MEDIA';
              const descripcion = (await ask('Descripción del incidente: ')).trim() || 'Incidente registrado por operador';
              const ubicacion = (await ask('Ubicación (opcional): ')).trim() || null;

              const resultado = await LogisticsService.registrarIncidenteManual({
                id_incidente,
                id_envio,
                id_sensor,
                id_contenedor,
                tipo,
                severidad,
                descripcion,
                ubicacion
              });
              console.log('\nIncidente registrado:', resultado.incidente);
              console.log(
                resultado.alerta
                  ? `Alerta ${resultado.alerta.id_alerta} generada para el incidente.`
                  : 'El incidente no generó una alerta nueva (ya existía una alerta abierta).'
              );
            } else if (optIncidente === '3') {
              const abiertos = await IncidenteRepository.listarIncidentes({
                estado: 'ABIERTO',
                limite: 100
              });
              if (abiertos.length > 0) {
                console.table(abiertos.map(i => ({
                  ID: i.id_incidente,
                  Tipo: i.tipo,
                  Severidad: i.severidad,
                  Envio: i.id_envio || '-',
                  Sensor: i.id_sensor || '-',
                  Fecha: i.fecha
                })));
              }
              const id_incidente = await ask('ID Incidente a cerrar: ');
              const resultado = await LogisticsService.cerrarIncidente(id_incidente);
              if (!resultado) {
                console.log('Incidente no encontrado o ya estaba cerrado.');
              } else {
                console.log('\nIncidente cerrado:', resultado.incidente);
                console.log(`Alertas cerradas: ${resultado.alertas_cerradas}`);
              }
            } else if (optIncidente === '4') {
              const agrupados = await IncidenteRepository.obtenerIncidentesPorEnvio();
              if (agrupados.length === 0) {
                console.log('No hay incidentes registrados.');
              } else {
                console.table(agrupados.map(g => ({
                  Envio: g._id || 'Sin envío',
                  Total: g.total_incidentes,
                  Criticos: g.criticos,
                  Leves: g.leves,
                  Abiertos: g.abiertos,
                  Tipos: (g.tipos || []).join(', ')
                })));
              }
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '7': {
          console.log('\n--- MENSAJERÍA Y CHAT (MongoDB) ---');
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
          console.log('\n--- CONSULTA DE POSICIONES GPS EN TIEMPO REAL (Redis) ---');
          console.log('1. Última posición de un contenedor');
          console.log('2. Listar todas las posiciones cacheadas');
          console.log('3. Contenedores cercanos a una coordenada');
          console.log('0. Volver');
          const optGps = (await ask('Opción (0-3): ')).trim();

          if (optGps === '0') {
            break;
          } else if (optGps === '1') {
            const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
            const pos = await RedisCacheRepository.obtenerUltimaPosicion(id_contenedor);
            if (pos) {
              console.log(`\nDatos en memoria caché para ${id_contenedor}:`);
              console.log(pos);
            } else {
              console.log(`No hay información en caché de Redis para el contenedor ${id_contenedor}.`);
            }
          } else if (optGps === '2') {
            const posiciones = await RedisCacheRepository.obtenerTodasPosiciones();
            if (posiciones.length === 0) {
              console.log('No hay posiciones de contenedores en caché.');
            } else {
              console.table(posiciones.map(p => ({
                Contenedor: p.id_contenedor,
                Latitud: p.latitud,
                Longitud: p.longitud,
                Envio: p.id_envio || '-',
                Sensor: p.id_sensor || '-',
                Actualizado: p.actualizado_en || '-'
              })));
            }
          } else if (optGps === '3') {
            const longitud = (await ask('Longitud de referencia (ej: -58.3816): ')).trim();
            const latitud = (await ask('Latitud de referencia (ej: -34.6037): ')).trim();
            const radioKm = (await ask('Radio en km [100]: ')).trim() || '100';
            const cercanos = await RedisCacheRepository.obtenerPosicionesCercanas(
              longitud,
              latitud,
              radioKm
            );
            if (cercanos.length === 0) {
              console.log('No se encontraron contenedores dentro del radio indicado.');
            } else {
              console.log(`\nContenedores a menos de ${radioKm} km:`);
              console.table(cercanos.map(p => ({
                Contenedor: p.id_contenedor,
                Latitud: p.latitud,
                Longitud: p.longitud,
                Envio: p.id_envio || '-',
                Sensor: p.id_sensor || '-',
                Actualizado: p.actualizado_en || '-'
              })));
            }
          } else {
            console.log('Opción inválida.');
          }
          break;
        }

        case '17': {
          if (!UsuarioRepository.esAdministrador(currentUser)) {
            console.log('\n[ACCESO DENEGADO] Solo usuarios administradores pueden acceder a Gestión de Usuarios, Roles y Sesiones.');
            break;
          }

          let salirSeguridad = false;
          while (!salirSeguridad) {
            console.log('\n--- SEGURIDAD: ABM USUARIOS, ROLES Y SESIONES ---');
            console.log('1. Gestionar Roles');
            console.log('2. Gestionar Usuarios');
            console.log('3. Gestionar Sesiones e Historial');
            console.log('0. Volver');
            const segOpt = (await ask('Opción (0-3): ')).trim();

            if (segOpt === '0') {
              salirSeguridad = true;
            } else if (segOpt === '1') {
              let salirRoles = false;
              while (!salirRoles) {
                console.log('\n--- GESTIÓN DE ROLES ---');
                console.log('1. Crear Rol');
                console.log('2. Listar Roles');
                console.log('3. Editar Rol (descripción, nivel y permisos)');
                console.log('4. Activar Rol');
                console.log('5. Desactivar Rol');
                console.log('6. Eliminar Rol');
                console.log('0. Volver');
                const rolOpt = (await ask('Opción (0-6): ')).trim();

                if (rolOpt === '0') {
                  salirRoles = true;
                } else if (rolOpt === '1') {
                  const descripcion = await ask('Descripción del Rol: ');
                  const nivel = await ask('Nivel de permisos (1-10) [1]: ') || '1';
                  const permisosStr = await ask('Permisos JSON (ej: {"envios":true,"alertas":true}) [ {} ]: ') || '{}';
                  const rol = await UsuarioRepository.crearRol({
                    descripcion,
                    nivel_permisos: Number(nivel),
                    permisos: permisosStr
                  });
                  console.log('\nRol creado:', rol);
                } else if (rolOpt === '2') {
                  const roles = await UsuarioRepository.listarRoles();
                  console.table(roles.map(r => ({
                    ID: r.id_rol,
                    Descripcion: r.descripcion,
                    Nivel: r.nivel_permisos,
                    Estado: r.estado,
                    Usuarios: r.cantidad_usuarios,
                    Permisos: JSON.stringify(r.permisos || {})
                  })));
                } else if (rolOpt === '3') {
                  const id_rol = await ask('ID Rol a editar: ');
                  const actual = await UsuarioRepository.obtenerRolPorId(Number(id_rol));
                  if (!actual) {
                    console.log('Rol no encontrado.');
                    continue;
                  }
                  console.log('Presione ENTER para mantener el valor actual:');
                  const descripcion = (await ask(`Descripción [${actual.descripcion}]: `)).trim();
                  const nivel = (await ask(`Nivel de permisos [${actual.nivel_permisos}]: `)).trim();
                  const permisosStr = (await ask(`Permisos JSON [${JSON.stringify(actual.permisos || {})}]: `)).trim();
                  const datos = {};
                  if (descripcion) datos.descripcion = descripcion;
                  if (nivel) datos.nivel_permisos = Number(nivel);
                  if (permisosStr) datos.permisos = permisosStr;
                  const rol = await UsuarioRepository.actualizarRol(Number(id_rol), datos);
                  console.log(rol ? '\nRol actualizado:' : '\nRol no encontrado', rol || '');
                } else if (rolOpt === '4') {
                  const id_rol = await ask('ID Rol a activar: ');
                  const rol = await UsuarioRepository.activarRol(Number(id_rol));
                  console.log(rol ? '\nRol activado:' : '\nRol no encontrado', rol || '');
                } else if (rolOpt === '5') {
                  const id_rol = await ask('ID Rol a desactivar: ');
                  const rol = await UsuarioRepository.desactivarRol(Number(id_rol));
                  console.log(rol ? '\nRol desactivado:' : '\nRol no encontrado', rol || '');
                } else if (rolOpt === '6') {
                  const id_rol = await ask('ID Rol a eliminar DEFINITIVAMENTE: ');
                  const conf = (await ask(`¿Eliminar el rol "${id_rol}"? No debe tener usuarios asignados. (s/n): `)).trim().toLowerCase();
                  if (conf === 's') {
                    try {
                      const rol = await UsuarioRepository.eliminarRol(Number(id_rol));
                      console.log(rol ? '\nRol eliminado:' : '\nRol no encontrado', rol || '');
                    } catch (error) {
                      console.log(`\n[No se pudo eliminar] ${error.message}`);
                    }
                  } else {
                    console.log('Operación cancelada.');
                  }
                } else {
                  console.log('Opción inválida.');
                }
              }
            } else if (segOpt === '2') {
              let salirUsuarios = false;
              while (!salirUsuarios) {
                console.log('\n--- GESTIÓN DE USUARIOS ---');
                console.log('1. Crear Usuario');
                console.log('2. Listar Usuarios');
                console.log('3. Editar Usuario (datos, rol, estado y contraseña)');
                console.log('4. Cambiar Rol');
                console.log('5. Bloquear Usuario');
                console.log('6. Activar Usuario');
                console.log('7. Eliminar Usuario');
                console.log('0. Volver');
                const usrOpt = (await ask('Opción (0-7): ')).trim();

                if (usrOpt === '0') {
                  salirUsuarios = true;
                } else if (usrOpt === '1') {
                  const roles = await UsuarioRepository.listarRoles({ soloActivos: true });
                  console.table(roles);
                  const nombre = await ask('Nombre: ');
                  const apellido = await ask('Apellido: ');
                  const email = await ask('Email: ');
                  const password = await ask('Contraseña (mínimo 6 caracteres): ');
                  const id_rol = await ask('ID Rol: ');
                  const id_cliente = await ask('ID Cliente (opcional, ENTER para omitir): ') || null;
                  const user = await UsuarioRepository.crearUsuario({
                    nombre, apellido, email, password,
                    id_rol: Number(id_rol),
                    id_cliente: id_cliente ? Number(id_cliente) : null
                  });
                  console.log('\nUsuario creado:', user);
                } else if (usrOpt === '2') {
                  const usuarios = await UsuarioRepository.listarUsuarios();
                  console.table(usuarios.map(u => ({
                    ID: u.id_usuario,
                    Nombre: `${u.nombre} ${u.apellido}`,
                    Email: u.email,
                    ID_Cliente: u.id_cliente || '-',
                    Rol: u.rol_descripcion,
                    Nivel: u.nivel_permisos,
                    Estado: u.estado,
                    Sesion_Activa: u.sesion_activa ? 'SI' : 'NO',
                    Ultimo_Acceso: u.fecha_ultimo_acceso || '-'
                  })));
                } else if (usrOpt === '3') {
                  const id_usuario = await ask('ID Usuario a editar: ');
                  const user = await UsuarioRepository.obtenerUsuarioPorId(Number(id_usuario));
                  if (!user) {
                    console.log('Usuario no encontrado.');
                    continue;
                  }
                  console.log('Presione ENTER para mantener el valor actual:');
                  const nombre = (await ask(`Nombre [${user.nombre}]: `)).trim();
                  const apellido = (await ask(`Apellido [${user.apellido}]: `)).trim();
                  const email = (await ask(`Email [${user.email}]: `)).trim();
                  const id_rol = (await ask(`ID Rol [${user.id_rol}]: `)).trim();
                  const id_cliente = (await ask(`ID Cliente [${user.id_cliente || '-'}] ("-" limpia): `)).trim();
                  const estado = (await ask(`Estado (ACTIVO/INACTIVO/BLOQUEADO) [${user.estado}]: `)).trim();
                  const password = (await ask('Nueva contraseña (ENTER para mantener): ')).trim();

                  const datos = {};
                  if (nombre) datos.nombre = nombre;
                  if (apellido) datos.apellido = apellido;
                  if (email) datos.email = email;
                  if (id_rol) datos.id_rol = Number(id_rol);
                  if (id_cliente === '-') datos.id_cliente = null;
                  else if (id_cliente) datos.id_cliente = Number(id_cliente);
                  if (estado) datos.estado = estado;
                  if (password) datos.password = password;

                  const actualizado = await UsuarioRepository.actualizarUsuario(Number(id_usuario), datos);
                  console.log(actualizado ? '\nUsuario actualizado:' : '\nUsuario no encontrado', actualizado || '');
                } else if (usrOpt === '4') {
                  const id_usuario = await ask('ID Usuario: ');
                  const roles = await UsuarioRepository.listarRoles({ soloActivos: true });
                  console.table(roles);
                  const id_rol = await ask('Nuevo ID Rol: ');
                  const user = await UsuarioRepository.cambiarRol(Number(id_usuario), Number(id_rol));
                  console.log(user ? '\nRol actualizado:' : '\nUsuario no encontrado', user || '');
                } else if (usrOpt === '5') {
                  const id_usuario = await ask('ID Usuario a bloquear: ');
                  const user = await UsuarioRepository.bloquearUsuario(Number(id_usuario));
                  console.log(user ? '\nUsuario bloqueado:' : '\nUsuario no encontrado', user || '');
                } else if (usrOpt === '6') {
                  const id_usuario = await ask('ID Usuario a activar: ');
                  const user = await UsuarioRepository.activarUsuario(Number(id_usuario));
                  console.log(user ? '\nUsuario activado:' : '\nUsuario no encontrado', user || '');
                } else if (usrOpt === '7') {
                  const id_usuario = await ask('ID Usuario a eliminar DEFINITIVAMENTE: ');
                  const conf = (await ask(
                    `¿Eliminar el usuario "${id_usuario}"? Se eliminará también su historial de sesiones por cascada. (s/n): `
                  )).trim().toLowerCase();
                  if (conf === 's') {
                    try {
                      if (currentUser && Number(currentUser.id_usuario) === Number(id_usuario)) {
                        throw new Error('No puede eliminar el usuario con el que está autenticado.');
                      }
                      const user = await UsuarioRepository.eliminarUsuario(Number(id_usuario));
                      console.log(user ? '\nUsuario eliminado:' : '\nUsuario no encontrado', user || '');
                    } catch (error) {
                      console.log(`\n[No se pudo eliminar] ${error.message}`);
                    }
                  } else {
                    console.log('Operación cancelada.');
                  }
                } else {
                  console.log('Opción inválida.');
                }
              }
            } else if (segOpt === '3') {
              let salirSesiones = false;
              while (!salirSesiones) {
                console.log('\n--- SESIONES E HISTORIAL ---');
                console.log('1. Listar sesiones activas (Redis con TTL)');
                console.log('2. Cerrar sesión específica');
                console.log('3. Cerrar todas las sesiones de un usuario');
                console.log('4. Cerrar todas las sesiones activas');
                console.log('5. Consultar historial de sesiones (PostgreSQL)');
                console.log('0. Volver');
                const sesOpt = (await ask('Opción (0-5): ')).trim();

                if (sesOpt === '0') {
                  salirSesiones = true;
                } else if (sesOpt === '1') {
                  const sesiones = await SesionRepository.listarSesionesActivas();
                  console.log(`\nSesiones activas: ${sesiones.length}`);
                  if (sesiones.length > 0) {
                    console.table(sesiones.map(s => ({
                      Token: s.token.substring(0, 8) + '...',
                      ID_Usuario: s.id_usuario,
                      Email: s.email,
                      ID_Rol: s.id_rol,
                      IP: s.ip || '-',
                      Inicio: s.fecha_inicio,
                      Ultimo_Acceso: s.ultimo_acceso,
                      TTL_seg: s.ttl_segundos
                    })));
                  }
                } else if (sesOpt === '2') {
                  const token = (await ask('Token completo o prefijo: ')).trim();
                  if (!token) {
                    console.log('Token requerido.');
                    continue;
                  }
                  const sesiones = await SesionRepository.listarSesionesActivas();
                  const encontrada = sesiones.find(s => s.token.startsWith(token) || s.token === token);
                  if (!encontrada) {
                    console.log('Sesión no encontrada.');
                    continue;
                  }
                  const res = await SesionRepository.cerrarSesion(encontrada.token);
                  console.log(res ? '\nSesión cerrada correctamente' : '\nNo se pudo cerrar la sesión');
                } else if (sesOpt === '3') {
                  const id_usuario = await ask('ID Usuario: ');
                  const cantidad = await SesionRepository.cerrarSesionesUsuario(Number(id_usuario));
                  console.log(`\nSesiones cerradas: ${cantidad}`);
                } else if (sesOpt === '4') {
                  const conf = (await ask('¿Confirma cerrar TODAS las sesiones activas? (s/n): ')).toLowerCase();
                  if (conf === 's') {
                    const cantidad = await SesionRepository.cerrarTodas();
                    console.log(`\nSesiones cerradas: ${cantidad}`);
                  } else {
                    console.log('Operación cancelada');
                  }
                } else if (sesOpt === '5') {
                  const id_usuario = (await ask('ID Usuario (opcional): ')).trim() || null;
                  const estado = (await ask('Estado (ACTIVA/CERRADA/EXPIRADA, ENTER todos): ')).trim() || null;
                  const limite = (await ask('Cantidad máxima de registros [50]: ')).trim() || '50';
                  const historial = await SesionRepository.listarHistorialSesiones({
                    id_usuario,
                    estado,
                    limite: Number(limite)
                  });
                  if (historial.length === 0) {
                    console.log('No se encontraron registros en el historial.');
                  } else {
                    console.table(historial.map(h => ({
                      ID: h.id_sesion,
                      Usuario: `${h.nombre} ${h.apellido}`,
                      Email: h.email,
                      Rol: h.rol_descripcion || '-',
                      Token: h.token ? h.token.substring(0, 8) + '...' : '-',
                      Inicio: h.fecha_inicio,
                      Fin: h.fecha_fin || '-',
                      Ultima_Actividad: h.fecha_ultima_actividad,
                      Estado: h.estado
                    })));
                  }
                } else {
                  console.log('Opción inválida.');
                }
              }
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '11': {
          let salirEnvios = false;
          while (!salirEnvios) {
            console.log('\n--- ABM DE ENVÍOS (PostgreSQL + Neo4j + MongoDB + Redis) ---');
            console.log('1. Listar envíos (con filtros)');
            console.log('2. Consultar envío por ID');
            console.log('3. Crear envío políglota');
            console.log('4. Modificar datos del envío');
            console.log('5. Cambiar estado del envío');
            console.log('6. Cancelar envío');
            console.log('7. Eliminar envío definitivamente');
            console.log('8. Asignar contenedor a envío');
            console.log('9. Asignar sensor a contenedor/envío');
            console.log('10. Ver eventos logísticos del envío (MongoDB)');
            console.log('0. Volver');
            const opEnv = (await ask('Opción (0-10): ')).trim();

            if (opEnv === '0') {
              salirEnvios = true;
            } else if (opEnv === '1') {
              const estado = (await ask('Estado (CREADO/EN_TRANSITO/ENTREGADO/RETRASADO/CANCELADO, ENTER todos): ')).trim() || null;
              const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
              const prioridad = (await ask('Prioridad (BAJA/MEDIA/ALTA/URGENTE, ENTER todas): ')).trim() || null;
              const envios = await EnvioRepository.listarTodos({
                estado,
                id_cliente: id_cliente ? Number(id_cliente) : null,
                prioridad
              });
              if (envios.length === 0) {
                console.log('No se encontraron envíos con esos filtros.');
              } else {
                console.table(envios.map(e => ({
                  ID: e.id_envio,
                  Cliente: e.cliente,
                  Origen: e.origen,
                  Destino: e.destino,
                  Estado: e.estado,
                  Prioridad: e.prioridad,
                  Tramos: e.cantidad_tramos,
                  Contenedores: `${e.cantidad_contenedores} (${e.contenedores_activos} activos)`,
                  Creacion: e.fecha_creacion,
                  Entrega: e.fecha_entrega || '-'
                })));
              }
            } else if (opEnv === '2') {
              const id_envio = await ask('ID Envío: ');
              const envio = await EnvioRepository.obtenerPorId(id_envio);
              if (!envio) {
                console.log('Envío no encontrado.');
              } else {
                console.log('\nDatos del envío:');
                console.table([{
                  ID: envio.id_envio,
                  Cliente: envio.cliente,
                  Origen: envio.origen,
                  Destino: envio.destino,
                  Estado: envio.estado,
                  Prioridad: envio.prioridad,
                  Creacion: envio.fecha_creacion,
                  Entrega: envio.fecha_entrega || '-'
                }]);
                if (envio.tramos.length > 0) {
                  console.log('\nTramos:');
                  console.table(envio.tramos);
                }
                if (envio.contenedores.length > 0) {
                  console.log('\nContenedores del envío:');
                  console.table(envio.contenedores.map(c => ({
                    ID: c.id_contenedor,
                    Tipo: c.tipo,
                    Estado: c.estado,
                    Asignado: c.fecha_asignacion,
                    Liberado: c.fecha_liberacion || '-'
                  })));
                } else {
                  console.log('\n[AVISO] El envío no tiene contenedores asociados.');
                }
              }
            } else if (opEnv === '3') {
              const id_envio = await ask('Código Envío (ej: ENV-2005): ') || `ENV-${Date.now().toString().slice(-6)}`;
              const id_cliente = await ask('ID Cliente (ej: 1): ') || '1';
              const origen = await ask('Ciudad Origen: ') || 'Buenos Aires';
              const destino = await ask('Ciudad Destino: ') || 'Montevideo';
              const prioridad = (await ask('Prioridad (BAJA/MEDIA/ALTA/URGENTE) [MEDIA]: ')).trim() || 'MEDIA';
              const operador = (await ask('Empresa Operadora (opcional): ')).trim() || null;
              const vehiculo = (await ask('Vehículo Patente (opcional): ')).trim() || null;
              const medio = (await ask('Medio de transporte del tramo principal [Terrestre]: ')).trim() || 'Terrestre';

              const contenedoresRegistrados = await ContenedorRepository.listarTodos();
              const contenedoresElegibles = contenedoresRegistrados
                .filter(c => c.estado === 'DISPONIBLE');
              if (contenedoresElegibles.length === 0) {
                console.log('\n[No se pudo crear el envío] No hay contenedores disponibles.');
                continue;
              }
              console.log('\nContenedores elegibles (el envío requiere al menos uno):');
              console.table(contenedoresElegibles.map(c => ({
                ID: c.id_contenedor,
                Tipo: c.tipo,
                Capacidad: c.capacidad,
                Estado: c.estado
              })));
              const contenedores = parsearIdsContenedores(
                await ask('IDs de contenedores separados por coma: ')
              );
              if (contenedores.length === 0) {
                console.log('\n[No se pudo crear el envío] Debe indicar al menos un contenedor.');
                continue;
              }

              try {
                const res = await LogisticsService.crearEnvioPoliglota({
                  id_envio,
                  id_cliente: Number(id_cliente),
                  origen,
                  destino,
                  prioridad,
                  operador,
                  vehiculo,
                  contenedores,
                  tramos: [{ desde: origen, hasta: destino, medio }]
                });
                console.log('\nEnvío creado y propagado exitosamente:');
                console.log(res);
              } catch (error) {
                console.log(`\n[No se pudo crear el envío] ${error.message}`);
              }
            } else if (opEnv === '4') {
              const id_envio = await ask('ID Envío a modificar: ');
              const envio = await EnvioRepository.obtenerPorId(id_envio);
              if (!envio) {
                console.log('Envío no encontrado.');
                continue;
              }
              console.log('Presione ENTER para mantener el valor actual (el estado se cambia en la opción 5):');
              const origen = (await ask(`Origen [${envio.origen}]: `)).trim();
              const destino = (await ask(`Destino [${envio.destino}]: `)).trim();
              const prioridad = (await ask(`Prioridad [${envio.prioridad}]: `)).trim();
              const fecha_entrega = (await ask(`Fecha entrega [${envio.fecha_entrega || '-'}] (YYYY-MM-DD, "-" limpia): `)).trim();

              const cambios = {};
              if (origen) cambios.origen = origen;
              if (destino) cambios.destino = destino;
              if (prioridad) cambios.prioridad = prioridad;
              if (fecha_entrega === '-') cambios.fecha_entrega = null;
              else if (fecha_entrega) cambios.fecha_entrega = fecha_entrega;

              if (Object.keys(cambios).length === 0) {
                console.log('No se indicaron cambios.');
                continue;
              }
              try {
                const res = await LogisticsService.actualizarEnvio(id_envio, cambios);
                console.log('\nEnvío actualizado:', res);
              } catch (error) {
                console.log(`\n[No se pudo actualizar] ${error.message}`);
              }
            } else if (opEnv === '5') {
              const id_envio = await ask('ID Envío: ');
              console.log('Estados válidos: CREADO, EN_TRANSITO, ENTREGADO, RETRASADO, CANCELADO');
              const estado = await ask('Nuevo estado: ');
              try {
                const res = await LogisticsService.cambiarEstadoEnvio(id_envio, estado);
                console.log('\nEstado actualizado:', res);
              } catch (error) {
                console.log(`\n[No se pudo cambiar el estado] ${error.message}`);
              }
            } else if (opEnv === '6') {
              const id_envio = await ask('ID Envío a cancelar: ');
              const conf = (await ask(
                `¿Cancelar el envío "${id_envio}"? Se liberarán sus contenedores. (s/n): `
              )).trim().toLowerCase();
              if (conf === 's') {
                try {
                  const res = await LogisticsService.cancelarEnvio(id_envio);
                  console.log('\nEnvío cancelado:', res);
                } catch (error) {
                  console.log(`\n[No se pudo cancelar] ${error.message}`);
                }
              } else {
                console.log('Operación cancelada.');
              }
            } else if (opEnv === '7') {
              const id_envio = await ask('ID Envío a eliminar DEFINITIVAMENTE: ');
              const conf = (await ask(
                `¿Eliminar físicamente el envío "${id_envio}"? No se permite si tiene facturas emitidas. (s/n): `
              )).trim().toLowerCase();
              if (conf === 's') {
                try {
                  const res = await LogisticsService.eliminarEnvio(id_envio);
                  console.log('\nEnvío eliminado:', res);
                } catch (error) {
                  console.log(`\n[No se pudo eliminar] ${error.message}`);
                }
              } else {
                console.log('Operación cancelada.');
              }
            } else if (opEnv === '8') {
              const id_envio = await ask('ID Envío: ');
              const contenedoresRegistrados = await ContenedorRepository.listarTodos();
              const contenedoresElegibles = contenedoresRegistrados
                .filter(c => c.estado === 'DISPONIBLE');
              if (contenedoresElegibles.length === 0) {
                console.log('\nNo hay contenedores DISPONIBLES para asignar.');
                continue;
              }
              console.log('\nContenedores elegibles:');
              console.table(contenedoresElegibles.map(c => ({
                ID: c.id_contenedor,
                Tipo: c.tipo,
                Capacidad: c.capacidad
              })));
              const id_contenedor = await ask('ID Contenedor: ');
              try {
                const res = await LogisticsService.asignarContenedorAEnvio({ id_envio, id_contenedor });
                console.log('\nContenedor asignado al envío:', res);
              } catch (error) {
                console.log(`\n[No se pudo asignar] ${error.message}`);
              }
            } else if (opEnv === '9') {
              const id_envio = await ask('ID Envío: ');
              const id_contenedor = await ask('ID Contenedor: ');
              const id_sensor = await ask('ID Sensor: ');
              try {
                const res = await LogisticsService.asignarSensorAContenedorEnvio({
                  id_envio,
                  id_contenedor,
                  id_sensor
                });
                console.log('\nSensor asignado a contenedor/envío:', res);
              } catch (error) {
                console.log(`\n[No se pudo asignar] ${error.message}`);
              }
            } else if (opEnv === '10') {
              const id_envio = await ask('ID Envío: ');
              const eventos = await MongoTelemetryRepository.listarEventosPorEnvio(id_envio, 100);
              if (eventos.length === 0) {
                console.log('No hay eventos logísticos registrados para ese envío.');
              } else {
                console.table(eventos.map(e => ({
                  ID: e.id_evento,
                  Fecha: e.fecha_hora,
                  Tipo: e.tipo_evento,
                  Ubicacion: e.ubicacion || '-',
                  Descripcion: e.descripcion || '-'
                })));
              }
            } else {
              console.log('Opción inválida.');
            }
          }
          break;
        }

        case '12': {
          console.log('\n--- PREDICCIÓN DE RIESGO DE DEMORA ---');
          const id_envio = await ask('ID Envío (ej: ENV-1001): ') || 'ENV-1001';
          const riesgo = await LogisticsService.obtenerOPredicirRiesgo(
            id_envio,
            currentUser?.email || 'sistema'
          );
          console.log('\nResultado de predicción:');
          console.log(riesgo);
          break;
        }

        case '13': {
          console.log('\n--- RANKING DE CLIENTES POR VOLUMEN TRANSPORTADO / FACTURADO (PostgreSQL) ---');
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
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
          } else if (opRep === '3') {
            console.log('\n--- TIEMPOS MÁXIMOS Y MÍNIMOS DE ENVÍO POR CLIENTE ---');
            const rep = await ReporteComercialRepository.tiemposEnvioPorCliente(
              currentUser?.email || 'sistema'
            );
            console.table(rep.datos);
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
          } else if (opRep === '4') {
            console.log('\n--- PROMEDIO DE INCIDENTES POR PAÍS/ESTADO/CLIENTE ---');
            const pais = (await ask('País (opcional): ')).trim() || null;
            const estado = (await ask('Estado (opcional): ')).trim() || null;
            const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
            const rep = await ReporteComercialRepository.promedioIncidentesPorPaisEstadoCliente({
              pais, estado, id_cliente: id_cliente ? Number(id_cliente) : null
            }, currentUser?.email || 'sistema');
            console.table(rep.datos);
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
          } else if (opRep === '5') {
            console.log('\n--- TIEMPOS PROMEDIO DE ENTREGA ---');
            const rep = await ReporteComercialRepository.tiemposPromedioEntrega(
              currentUser?.email || 'sistema'
            );
            console.table(rep.datos);
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
          } else if (opRep === '6') {
            console.log('\n--- COSTOS POR TIPO DE TRANSPORTE ---');
            const rep = await ReporteComercialRepository.costosPorTipoTransporte(
              currentUser?.email || 'sistema'
            );
            console.table(rep.datos);
            if (rep.id_reporte_mongo) console.log(`Guardado en MongoDB: ${rep.id_reporte_mongo}`);
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

        case '18': {
          const tokenActual = currentUser?.token;
          if (tokenActual) {
            try {
              await SesionRepository.cerrarSesion(tokenActual);
            } catch (error) {
              console.warn(`[Aviso] No se pudo cerrar la sesión en Redis/PostgreSQL: ${error.message}`);
            }
          }
          currentUser = null;
          console.log('\nSesión cerrada. Debe autenticarse nuevamente.\n');
          await login();
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

  if (currentUser && currentUser.token) {
    try {
      await SesionRepository.cerrarSesion(currentUser.token);
    } catch (error) {
      console.warn(`[Aviso] No se pudo cerrar la sesión al salir: ${error.message}`);
    }
    currentUser = null;
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

  await login();
  await menu();
}

main().catch(console.error);
