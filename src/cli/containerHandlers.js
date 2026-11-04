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
import { formatNumber } from './cliFormatters.js';

export async function handleOption2({ ask, currentUser }) {
  let salirCont = false;
  while (!salirCont) {
    console.log('\n--- GESTIÓN DE CONTENEDORES ---');
    const contenedores = await ContenedorRepository.listarTodos();
    if (contenedores.length === 0) {
      console.log('No hay contenedores registrados.');
    } else {
      console.table(contenedores.map(c => ({
        ID: c.id_contenedor,
        Codigo_Int: c.codigo_internacional,
        Tipo: c.tipo,
        Capacidad: `${formatNumber(c.capacidad)} kg`,
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

      const modificado = await ContenedorAssignmentService.actualizar(id, {
        codigo_internacional,
        tipo,
        capacidad,
        estado
      });
      console.log('\nContenedor actualizado:', modificado);
    } else if (subOpt === '3') {
      const id = await ask('ID Contenedor a dar de baja: ');
      const res = await ContenedorAssignmentService.darDeBaja(id);
      console.log(res ? `\nContenedor ${id} dado de baja (estado FUERA_SERVICIO):` : '\nContenedor no encontrado.', res || '');
    } else if (subOpt === '4') {
      const id = await ask('ID Contenedor a activar: ');
      const res = await ContenedorAssignmentService.activar(id);
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
          const res = await ContenedorAssignmentService.eliminar(id);
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
}
