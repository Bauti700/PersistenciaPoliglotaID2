import { SesionRepository } from '../repositories/sesionRepository.js';
import { AuthenticationService } from '../services/authenticationService.js';
import { banner } from './cliHelpers.js';
import { handleOption1 } from './entityHandlers.js';
import { handleOption2 } from './containerHandlers.js';
import { handleOption3 } from './financeHandlers.js';
import { handleOption4 } from './telemetryHandlers.js';
import { handleOption5 } from './historyHandlers.js';
import { handleOption6 } from './incidentHandlers.js';
import { handleOption7 } from './messageHandlers.js';
import { handleOption8 } from './routeHandlers.js';
import { handleOption9 } from './networkHandlers.js';
import { handleOption10 } from './positionHandlers.js';
import { handleOption11 } from './shipmentHandlers.js';
import { handleOption12 } from './riskHandlers.js';
import { handleOption13 } from './commercialHandlers.js';
import { handleOption14 } from './reportHandlers.js';
import { handleOption15 } from './routeAnalyticsHandlers.js';
import { handleOption16 } from './performanceHandlers.js';
import { handleOption17 } from './securityHandlers.js';
import { login } from './authCli.js';

const handlers = {
  '1': handleOption1,
  '2': handleOption2,
  '3': handleOption3,
  '4': handleOption4,
  '5': handleOption5,
  '6': handleOption6,
  '7': handleOption7,
  '8': handleOption8,
  '9': handleOption9,
  '10': handleOption10,
  '17': handleOption17,
  '11': handleOption11,
  '12': handleOption12,
  '13': handleOption13,
  '14': handleOption14,
  '15': handleOption15,
  '16': handleOption16
};

export async function runMainMenu(context) {
  banner();
  let salir = false;
  while (!salir) {
    console.log(`
Seleccione una opción:
  1.  Gestionar Clientes, Proveedores y Operadores
  2.  Gestionar Contenedores
  3.  Gestión Comercial y Financiera
  4.  Telemetría IoT
  5.  Ver Histórico de Lecturas y Detectar Anomalías
  6.  Gestionar Incidentes y Alertas
  7.  Mensajería y Chat
  8.  Consultar Ruta Completa de un Envío
  9.  Ver Red de Relaciones
  10. Consultar Última Posición GPS en Caché
  11. ABM de Envíos
  12. Calcular / Consultar Predicción de Riesgo
  13. Ranking de Clientes
  14. Reportes Operativos y Analíticos
  15. Ranking de Rutas con Mayor Cantidad de Incidentes
  16. Análisis Histórico de Desempeño
${AuthenticationService.esAdministrador(context.currentUser) ? '  17. ABM Usuarios, Roles y Sesiones\n' : ''}  18. Cerrar sesión actual y volver a autenticarse
  0.  Salir
`);
    const opt = (await context.ask('Opción > ')).trim();
    try {
      if (handlers[opt]) await handlers[opt]({ ask: context.ask, currentUser: context.currentUser });
      else if (opt === '18') {
        if (context.currentUser?.token) await SesionRepository.cerrarSesion(context.currentUser.token);
        context.currentUser = null;
        console.log('\nSesión cerrada. Debe autenticarse nuevamente.\n');
        await login(context);
      } else if (opt === '0') salir = true;
      else console.log('Opción inválida.');
    } catch (error) {
      console.error(`\n[Error al ejecutar operación]: ${error.message}`);
    }
    if (!salir) await context.ask('\nPresione ENTER para continuar...');
  }
  if (context.currentUser?.token) await SesionRepository.cerrarSesion(context.currentUser.token);
  context.currentUser = null;
}
