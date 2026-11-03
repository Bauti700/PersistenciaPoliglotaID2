import { getDb } from '../config/database.js';
import {
  textoRequerido,
  textoOpcional,
  numeroPositivo,
  enteroPositivo,
  unoDe,
  booleano,
  errorValidacion
} from '../utils/validation.js';

const TIPOS_REGLA = ['TEMPERATURA', 'BATERIA', 'INACTIVIDAD'];
const TIPOS_ALERTA = [...TIPOS_REGLA, 'INCIDENTE'];
const CONDICIONES = ['MAYOR_QUE', 'MAYOR_IGUAL_QUE', 'MENOR_QUE', 'MENOR_IGUAL_QUE', 'IGUAL_QUE'];
const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const ESTADOS_ALERTA = ['ABIERTA', 'PENDIENTE', 'CERRADA'];
const ESTADOS_ABIERTOS = ['ABIERTA', 'PENDIENTE'];

const REGLAS_POR_DEFECTO = {
  TEMPERATURA: {
    id_regla: 'REG-DEF-TEMPERATURA',
    tipo: 'TEMPERATURA',
    condicion: 'MAYOR_QUE',
    umbral: 8,
    severidad: 'ALTA',
    activa: true,
    descripcion: 'Temperatura máxima permitida para cadena de frío (°C).'
  },
  BATERIA: {
    id_regla: 'REG-DEF-BATERIA',
    tipo: 'BATERIA',
    condicion: 'MENOR_QUE',
    umbral: 20,
    severidad: 'MEDIA',
    activa: true,
    descripcion: 'Nivel mínimo de batería de un sensor (%).'
  },
  INACTIVIDAD: {
    id_regla: 'REG-DEF-INACTIVIDAD',
    tipo: 'INACTIVIDAD',
    condicion: 'MAYOR_QUE',
    umbral: 2,
    severidad: 'ALTA',
    activa: true,
    descripcion: 'Horas máximas sin lecturas antes de generar una alerta.'
  }
};

function condicionPorDefecto(tipo) {
  return tipo === 'BATERIA' ? 'MENOR_QUE' : 'MAYOR_QUE';
}

function validarRegla(data = {}, { parcial = false } = {}) {
  const regla = {};
  let cantidad = 0;

  if (data.id_regla !== undefined) {
    if (parcial) {
      throw errorValidacion('El ID de la regla no se puede modificar.');
    }
    regla.id_regla = textoRequerido(data.id_regla, 'id_regla', { max: 50 });
    cantidad++;
  }

  if (data.tipo !== undefined) {
    regla.tipo = unoDe(data.tipo, TIPOS_REGLA, 'tipo');
    cantidad++;
  } else if (!parcial) {
    throw errorValidacion('El campo tipo es obligatorio.');
  }

  if (data.condicion !== undefined) {
    regla.condicion = unoDe(data.condicion, CONDICIONES, 'condicion');
    cantidad++;
  } else if (!parcial) {
    regla.condicion = condicionPorDefecto(data.tipo);
  }

  if (data.umbral !== undefined) {
    const min = data.tipo === 'TEMPERATURA' ? -100 : 0;
    regla.umbral = numeroPositivo(data.umbral, 'umbral', { min, max: 100000 });
    cantidad++;
  } else if (!parcial) {
    throw errorValidacion('El campo umbral es obligatorio.');
  }

  if (data.severidad !== undefined) {
    regla.severidad = unoDe(data.severidad, SEVERIDADES, 'severidad');
    cantidad++;
  } else if (!parcial) {
    regla.severidad = 'MEDIA';
  }

  if (data.activa !== undefined) {
    regla.activa = booleano(data.activa, 'activa');
    cantidad++;
  } else if (!parcial) {
    regla.activa = true;
  }

  if (data.descripcion !== undefined) {
    regla.descripcion = textoOpcional(data.descripcion, 'descripcion', { max: 255 });
    cantidad++;
  } else if (!parcial) {
    regla.descripcion = null;
  }

  if (parcial && cantidad === 0) {
    throw errorValidacion('Debe indicar al menos un campo de la regla para actualizar.');
  }
  return regla;
}

function evaluarCondicion(valor, condicion, umbral) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return false;
  switch (condicion) {
    case 'MAYOR_QUE': return numero > umbral;
    case 'MAYOR_IGUAL_QUE': return numero >= umbral;
    case 'MENOR_QUE': return numero < umbral;
    case 'MENOR_IGUAL_QUE': return numero <= umbral;
    case 'IGUAL_QUE': return numero === umbral;
    default: return false;
  }
}

function etiquetaTipo(tipo) {
  return {
    TEMPERATURA: 'Temperatura',
    BATERIA: 'Batería',
    INACTIVIDAD: 'Inactividad'
  }[tipo] || tipo;
}

export class AlertaRepository {
  // --- REGLAS ---
  static async crearRegla(regla) {
    const datos = validarRegla(regla);
    const col = getDb().collection('reglas_alertas');
    const doc = {
      ...datos,
      id_regla: datos.id_regla || `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fecha_creacion: new Date()
    };

    const existente = await col.findOne({ id_regla: doc.id_regla });
    if (existente) {
      throw errorValidacion(`Ya existe una regla con el ID ${doc.id_regla}.`, 409);
    }
    if (doc.activa) {
      await AlertaRepository.validarReglaActivaUnica(doc.tipo);
    }
    await col.insertOne(doc);
    return doc;
  }

  static async validarReglaActivaUnica(tipo, exceptoId = null) {
    const filtro = { tipo, activa: true };
    if (exceptoId) filtro.id_regla = { $ne: exceptoId };
    const existente = await getDb().collection('reglas_alertas').findOne(filtro, { projection: { id_regla: 1 } });
    if (existente) {
      throw errorValidacion(
        `Ya existe la regla activa ${existente.id_regla} para el tipo ${tipo}. ` +
        'Desactívela antes de activar otra regla del mismo tipo.',
        409
      );
    }
  }

  static async listarReglas({ soloActivas = false } = {}) {
    const filtro = soloActivas ? { activa: true } : {};
    return await getDb().collection('reglas_alertas')
      .find(filtro)
      .sort({ tipo: 1, fecha_creacion: -1 })
      .toArray();
  }

  static async obtenerReglaPorId(id_regla) {
    const id = textoRequerido(id_regla, 'id_regla', { max: 50 });
    return await getDb().collection('reglas_alertas').findOne({ id_regla: id });
  }

  static async actualizarRegla(id_regla, datos) {
    const id = textoRequerido(id_regla, 'id_regla', { max: 50 });
    const actualizacion = validarRegla(datos, { parcial: true });
    const col = getDb().collection('reglas_alertas');
    const actual = await col.findOne({ id_regla: id });
    if (!actual) return null;

    if (actualizacion.activa === true) {
      const tipo = actualizacion.tipo || actual.tipo;
      await AlertaRepository.validarReglaActivaUnica(tipo, id);
    }

    const res = await col.updateOne(
      { id_regla: id },
      { $set: { ...actualizacion, fecha_actualizacion: new Date() } }
    );
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_regla: id });
  }

  static async activarRegla(id_regla) {
    const id = textoRequerido(id_regla, 'id_regla', { max: 50 });
    const col = getDb().collection('reglas_alertas');
    const actual = await col.findOne({ id_regla: id });
    if (!actual) return null;

    await AlertaRepository.validarReglaActivaUnica(actual.tipo, id);

    const res = await col.updateOne(
      { id_regla: id },
      { $set: { activa: true, fecha_reactivacion: new Date() }, $unset: { fecha_desactivacion: '' } }
    );
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_regla: id });
  }

  static async desactivarRegla(id_regla) {
    const id = textoRequerido(id_regla, 'id_regla', { max: 50 });
    const col = getDb().collection('reglas_alertas');
    const res = await col.updateOne(
      { id_regla: id },
      { $set: { activa: false, fecha_desactivacion: new Date() } }
    );
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_regla: id });
  }

  static async eliminarRegla(id_regla) {
    const id = textoRequerido(id_regla, 'id_regla', { max: 50 });
    const res = await getDb().collection('reglas_alertas').deleteOne({ id_regla: id });
    return res.deletedCount > 0;
  }

  /**
   * Devuelve un mapa tipo -> regla efectiva.
   *
   * Reglas de interpretación:
   * - Si no hay ninguna regla configurada para un tipo, se aplica el umbral
   *   por defecto para que la detección no quede deshabilitada silenciosamente.
   * - Si hay reglas configuradas pero todas están inactivas, el tipo queda
   *   explícitamente deshabilitado (null) y no se evalúa.
   * - Si hay varias activas (no debería ocurrir por la validación de unicidad),
   *   se toma la más reciente.
   */
  static async obtenerReglasActivas() {
    const reglas = await AlertaRepository.listarReglas();
    const mapa = {};

    for (const tipo of TIPOS_REGLA) {
      const delTipo = reglas
        .filter(r => String(r.tipo).toUpperCase() === tipo)
        .sort((a, b) => new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0));

      if (delTipo.length === 0) {
        mapa[tipo] = REGLAS_POR_DEFECTO[tipo];
      } else {
        mapa[tipo] = delTipo.find(r => r.activa === true) || null;
      }
    }
    return mapa;
  }

  static async obtenerReglaAplicable(tipo) {
    const tipoNormalizado = unoDe(tipo, TIPOS_REGLA, 'tipo');
    const reglas = await AlertaRepository.obtenerReglasActivas();
    return reglas[tipoNormalizado];
  }

  static async listarReglasEfectivas() {
    const mapa = await AlertaRepository.obtenerReglasActivas();
    return TIPOS_REGLA.map(tipo => {
      if (mapa[tipo]) return mapa[tipo];
      return {
        id_regla: `REG-DESACTIVADA-${tipo}`,
        tipo,
        condicion: condicionPorDefecto(tipo),
        umbral: REGLAS_POR_DEFECTO[tipo].umbral,
        severidad: REGLAS_POR_DEFECTO[tipo].severidad,
        activa: false,
        origen: 'DESACTIVADA',
        descripcion: `Detección de ${tipo} desactivada por configuración.`
      };
    });
  }

  // --- ALERTAS ---
  static async crearAlerta(alerta) {
    const idSensor = alerta.id_sensor
      ? textoRequerido(alerta.id_sensor, 'id_sensor', { max: 50 })
      : null;
    const tipo = unoDe(alerta.tipo || 'TEMPERATURA', TIPOS_ALERTA, 'tipo');
    const mensaje = textoRequerido(alerta.mensaje, 'mensaje', { max: 500 });
    const severidad = unoDe(alerta.severidad || 'ALTA', SEVERIDADES, 'severidad');
    const estado = unoDe(alerta.estado || 'ABIERTA', ESTADOS_ALERTA, 'estado');
    const idContenedor = alerta.id_contenedor
      ? textoRequerido(alerta.id_contenedor, 'id_contenedor', { max: 50 })
      : null;
    const idEnvio = alerta.id_envio
      ? textoRequerido(alerta.id_envio, 'id_envio', { max: 50 })
      : null;
    const idIncidente = alerta.id_incidente
      ? textoRequerido(alerta.id_incidente, 'id_incidente', { max: 100 })
      : null;
    const motivo = alerta.motivo
      ? textoRequerido(alerta.motivo, 'motivo', { max: 100 })
      : null;

    const doc = {
      id_alerta: alerta.id_alerta || `ALR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_sensor: idSensor,
      id_contenedor: idContenedor,
      id_envio: idEnvio,
      id_incidente: idIncidente,
      tipo,
      mensaje,
      severidad,
      estado,
      motivo,
      valor_detectado: alerta.valor_detectado !== undefined ? Number(alerta.valor_detectado) : null,
      umbral_aplicado: alerta.umbral_aplicado !== undefined ? Number(alerta.umbral_aplicado) : null,
      id_regla: alerta.id_regla || null,
      fecha: new Date()
    };
    await getDb().collection('alertas').insertOne(doc);
    return doc;
  }

  static async existeAlertaAbierta({ id_sensor, tipo }) {
    if (!id_sensor) return false;
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const tipoNormalizado = unoDe(tipo, TIPOS_ALERTA, 'tipo');
    const res = await getDb().collection('alertas').findOne({
      id_sensor: id,
      tipo: tipoNormalizado,
      estado: { $in: ESTADOS_ABIERTOS }
    }, { projection: { _id: 1 } });
    return Boolean(res);
  }

  static async existeAlertaPorIncidente(id_incidente) {
    const id = textoRequerido(id_incidente, 'id_incidente', { max: 100 });
    const res = await getDb().collection('alertas').findOne({
      id_incidente: id,
      estado: { $in: ESTADOS_ABIERTOS }
    }, { projection: { _id: 1 } });
    return Boolean(res);
  }

  static async listarAlertasAbiertas() {
    return await getDb().collection('alertas')
      .find({ estado: { $in: ESTADOS_ABIERTOS } })
      .sort({ fecha: -1 })
      .toArray();
  }

  static async listarAlertas({ estado = null, tipo = null, id_sensor = null, id_contenedor = null, id_incidente = null, limite = 100 } = {}) {
    const filtro = {};
    if (estado) filtro.estado = unoDe(estado, ESTADOS_ALERTA, 'estado');
    if (tipo) filtro.tipo = unoDe(tipo, TIPOS_ALERTA, 'tipo');
    if (id_sensor) filtro.id_sensor = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    if (id_contenedor) filtro.id_contenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    if (id_incidente) filtro.id_incidente = textoRequerido(id_incidente, 'id_incidente', { max: 100 });

    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('alertas')
      .find(filtro)
      .sort({ fecha: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async listarAlertasPorTipo(tipo) {
    const tipoNormalizado = unoDe(tipo, TIPOS_ALERTA, 'tipo');
    return await getDb().collection('alertas')
      .find({ tipo: tipoNormalizado, estado: { $in: ESTADOS_ABIERTOS } })
      .sort({ fecha: -1 })
      .toArray();
  }

  static async cerrarAlerta(id_alerta) {
    const id = textoRequerido(id_alerta, 'id_alerta', { max: 100 });
    const col = getDb().collection('alertas');
    const res = await col.updateOne(
      { id_alerta: id, estado: { $ne: 'CERRADA' } },
      { $set: { estado: 'CERRADA', fecha_cierre: new Date() } }
    );
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_alerta: id });
  }

  static evaluarLectura(lectura, reglas) {
    const disparos = [];
    if (lectura.temperatura !== undefined && lectura.temperatura !== null) {
      const regla = reglas.TEMPERATURA;
      if (regla && evaluarCondicion(lectura.temperatura, regla.condicion, regla.umbral)) {
        disparos.push({ tipo: 'TEMPERATURA', regla, valor: Number(lectura.temperatura) });
      }
    }
    if (lectura.nivel_bateria !== undefined && lectura.nivel_bateria !== null) {
      const regla = reglas.BATERIA;
      if (regla && evaluarCondicion(lectura.nivel_bateria, regla.condicion, regla.umbral)) {
        disparos.push({ tipo: 'BATERIA', regla, valor: Number(lectura.nivel_bateria) });
      }
    }
    return disparos;
  }

  static mensajeAlerta(tipo, valor, regla) {
    const unidad = tipo === 'TEMPERATURA' ? '°C' : tipo === 'BATERIA' ? '%' : ' h';
    const operador = {
      MAYOR_QUE: 'superior a',
      MAYOR_IGUAL_QUE: 'mayor o igual a',
      MENOR_QUE: 'inferior a',
      MENOR_IGUAL_QUE: 'menor o igual a',
      IGUAL_QUE: 'igual a'
    }[regla.condicion] || 'fuera del umbral de';
    return `${etiquetaTipo(tipo)} ${valor}${unidad} ${operador} ${regla.umbral}${unidad}`;
  }

  static async crearAlertaDesdeRegla({ tipo, regla, valor, id_sensor, id_contenedor = null, id_envio = null, motivo }) {
    if (await AlertaRepository.existeAlertaAbierta({ id_sensor, tipo })) {
      return null;
    }
    return AlertaRepository.crearAlerta({
      id_sensor,
      id_contenedor,
      id_envio,
      tipo,
      mensaje: AlertaRepository.mensajeAlerta(tipo, valor, regla),
      severidad: regla.severidad || 'MEDIA',
      estado: 'ABIERTA',
      motivo,
      valor_detectado: valor,
      umbral_aplicado: regla.umbral,
      id_regla: regla.id_regla || null
    });
  }

  /**
   * Genera una alerta asociada a un incidente. A diferencia de las alertas de
   * umbral, la deduplicación se hace por id_incidente, no por sensor + tipo,
   * porque un mismo sensor puede tener varios incidentes distintos.
   */
  static async crearAlertaDesdeIncidente(incidente) {
    const idIncidente = textoRequerido(incidente.id_incidente, 'id_incidente', { max: 100 });
    if (await AlertaRepository.existeAlertaPorIncidente(idIncidente)) {
      return null;
    }
    const descripcion = incidente.descripcion ? `: ${incidente.descripcion}` : '';
    return AlertaRepository.crearAlerta({
      id_sensor: incidente.id_sensor || null,
      id_contenedor: incidente.id_contenedor || null,
      id_envio: incidente.id_envio || null,
      id_incidente: idIncidente,
      tipo: 'INCIDENTE',
      mensaje: `Incidente ${incidente.tipo}${descripcion}`,
      severidad: incidente.severidad || 'MEDIA',
      estado: 'ABIERTA',
      motivo: `INCIDENTE_${incidente.tipo}`,
      valor_detectado: null,
      umbral_aplicado: null,
      id_regla: null
    });
  }

  static async cerrarAlertasPorIncidente(id_incidente) {
    const id = textoRequerido(id_incidente, 'id_incidente', { max: 100 });
    const res = await getDb().collection('alertas').updateMany(
      { id_incidente: id, estado: { $ne: 'CERRADA' } },
      { $set: { estado: 'CERRADA', fecha_cierre: new Date() } }
    );
    return res.modifiedCount;
  }

  static async detectarAlertasEstadoSensores() {
    const colSensores = getDb().collection('sensores');
    const colLecturas = getDb().collection('lecturas_sensores');
    const ahora = new Date();
    const alertasGeneradas = [];
    const reglas = await AlertaRepository.obtenerReglasActivas();
    const reglaInactividad = reglas.INACTIVIDAD;

    const sensores = await colSensores.find({ estado: 'ACTIVO' }).toArray();
    for (const sensor of sensores) {
      const ultimaLectura = await colLecturas.findOne(
        { id_sensor: sensor.id_sensor },
        { sort: { fecha_hora: -1 } }
      );

      if (!ultimaLectura) {
        if (reglaInactividad) {
          const alerta = await AlertaRepository.crearAlertaDesdeRegla({
            tipo: 'INACTIVIDAD',
            regla: reglaInactividad,
            valor: reglaInactividad.umbral,
            id_sensor: sensor.id_sensor,
            id_contenedor: sensor.id_contenedor || null,
            motivo: 'SIN_LECTURAS'
          });
          if (alerta) alertasGeneradas.push(alerta);
        }
        continue;
      }

      if (reglaInactividad) {
        const diffHoras = (ahora - new Date(ultimaLectura.fecha_hora)) / (1000 * 60 * 60);
        if (evaluarCondicion(diffHoras, reglaInactividad.condicion, reglaInactividad.umbral)) {
          const alerta = await AlertaRepository.crearAlertaDesdeRegla({
            tipo: 'INACTIVIDAD',
            regla: reglaInactividad,
            valor: Math.round(diffHoras * 100) / 100,
            id_sensor: sensor.id_sensor,
            id_contenedor: ultimaLectura.id_contenedor || sensor.id_contenedor || null,
            id_envio: ultimaLectura.id_envio || null,
            motivo: 'INACTIVO_SIN_TRANSMISION'
          });
          if (alerta) alertasGeneradas.push(alerta);
        }
      }

      for (const disparo of AlertaRepository.evaluarLectura(ultimaLectura, reglas)) {
        const alerta = await AlertaRepository.crearAlertaDesdeRegla({
          tipo: disparo.tipo,
          regla: disparo.regla,
          valor: disparo.valor,
          id_sensor: sensor.id_sensor,
          id_contenedor: ultimaLectura.id_contenedor || sensor.id_contenedor || null,
          id_envio: ultimaLectura.id_envio || null,
          motivo: `UMBRAL_${disparo.tipo}`
        });
        if (alerta) alertasGeneradas.push(alerta);
      }
    }
    return alertasGeneradas;
  }
}

export {
  AlertaRepository as alertaRepository,
  REGLAS_POR_DEFECTO,
  TIPOS_REGLA,
  TIPOS_ALERTA,
  SEVERIDADES,
  ESTADOS_ALERTA
};
