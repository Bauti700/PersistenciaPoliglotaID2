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

export async function handleOption1({ ask, currentUser }) {
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
                await menuABMEntidad('Clientes', 'Cliente', ClienteRepository, 'id_cliente', ask);
              } else if (subOpt === '2') {
                await menuABMEntidad('Proveedores', 'Proveedor', ProveedorRepository, 'id_proveedor', ask);
              } else if (subOpt === '3') {
                await menuABMEntidad('Operadores Logísticos', 'Operador', OperadorRepository, 'id_operador', ask);
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
                  console.log(`âš  Error al consultar cuenta corriente: ${e.message}`);
                }
              } else if (subOpt === '0') {
                volverSub = true;
              } else {
                console.log('Opción inválida.');
              }
            }
}

