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
import { LogisticsService } from '../services/logisticsService.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';
import { formatDate, formatTableRows } from './cliFormatters.js';

export async function handleOption4({ ask, currentUser }) {
  let salirIoT = false;
  while (!salirIoT) {
    console.log('\n--- INGESTA DE TELEMETRÍA IOT ---');
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
      console.log('\nTelemetría registrada correctamente.');
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
            Instalacion: formatDate(s.fecha_instalacion)
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
          console.table(formatTableRows(lista));
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
        console.table(formatTableRows(sensores));
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
              Fecha: formatDate(a.fecha)
            })));
          }
        } else if (rOpt === '9') {
          const alertas = await AlertaRepository.listarAlertasAbiertas();
          if (alertas.length === 0) {
            console.log('No hay alertas abiertas.');
          } else {
            console.table(formatTableRows(alertas));
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
}
