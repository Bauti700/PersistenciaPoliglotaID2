// =============================================================================
// SCRIPT DE INICIALIZACIÓN MONGODB - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
// Colecciones: sensores, lecturas_sensores, incidentes, eventos_logisticos,
//              reglas_alertas, alertas, mensajes, grupos_trabajo, predicciones_riesgo
// =============================================================================

db = db.getSiblingDB('tpo_telemetria');

// Sensores
db.sensores.drop();
db.sensores.createIndex({ id_sensor: 1 }, { unique: true });
db.sensores.createIndex({ id_contenedor: 1 });

db.sensores.insertMany([
  {
    id_sensor: "SENS-101",
    tipo: "Temperatura/Humedad/GPS",
    fabricante: "IoTCorp Tech",
    fecha_instalacion: new Date("2024-01-10T08:00:00Z"),
    estado: "ACTIVO",
    id_contenedor: "CONT-001"
  },
  {
    id_sensor: "SENS-102",
    tipo: "Vibración/Impacto/GPS",
    fabricante: "SafeCargo Sensors",
    fecha_instalacion: new Date("2024-02-15T10:00:00Z"),
    estado: "ACTIVO",
    id_contenedor: "CONT-001"
  },
  {
    id_sensor: "SENS-103",
    tipo: "Temperatura/GPS",
    fabricante: "ColdChain Pro",
    fecha_instalacion: new Date("2024-03-01T12:00:00Z"),
    estado: "INACTIVO",
    id_contenedor: "CONT-002"
  },
  {
    id_sensor: "SENS-104",
    tipo: "Temperatura/Humedad/GPS",
    fabricante: "ColdChain Pro",
    fecha_instalacion: new Date("2024-04-12T09:00:00Z"),
    estado: "ACTIVO",
    id_contenedor: "CONT-006"
  },
  {
    id_sensor: "SENS-105",
    tipo: "GPS/Vibración",
    fabricante: "SafeCargo Sensors",
    fecha_instalacion: new Date("2024-05-20T11:00:00Z"),
    estado: "ACTIVO",
    id_contenedor: "CONT-007"
  },
  {
    id_sensor: "SENS-106",
    tipo: "Temperatura/GPS",
    fabricante: "IoTCorp Tech",
    fecha_instalacion: new Date("2024-06-08T14:00:00Z"),
    estado: "ACTIVO",
    id_contenedor: "CONT-008"
  }
]);

// Lecturas Sensores (Telemetría como colección time-series)
// El metaField id_sensor agrupa las mediciones por sensor; fecha_hora es el
// campo temporal. MongoDB 6 permite índices secundarios (incluido 2dsphere)
// sobre colecciones time-series.
db.lecturas_sensores.drop();
db.createCollection('lecturas_sensores', {
  timeseries: {
    timeField: 'fecha_hora',
    metaField: 'id_sensor',
    granularity: 'seconds'
  }
});
db.lecturas_sensores.createIndex({ id_sensor: 1, fecha_hora: -1 });
db.lecturas_sensores.createIndex({ id_contenedor: 1, fecha_hora: -1 });
db.lecturas_sensores.createIndex({ posicion_gps: "2dsphere" });

db.lecturas_sensores.insertMany([
  {
    id_lectura: "LEC-001",
    id_sensor: "SENS-101",
    id_contenedor: "CONT-001",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 3600000 * 3),
    temperatura: 4.1,
    humedad: 62.5,
    vibracion: 0.08,
    posicion_gps: { type: "Point", coordinates: [-58.3816, -34.6037] }, // Buenos Aires
    nivel_bateria: 95
  },
  {
    id_lectura: "LEC-002",
    id_sensor: "SENS-101",
    id_contenedor: "CONT-001",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 3600000 * 2),
    temperatura: 8.9, // Anomalía leve de temperatura en contenedor refrigerado
    humedad: 68.0,
    vibracion: 0.12,
    posicion_gps: { type: "Point", coordinates: [-58.2000, -34.4000] },
    nivel_bateria: 94
  },
  {
    id_lectura: "LEC-003",
    id_sensor: "SENS-101",
    id_contenedor: "CONT-001",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 3600000),
    temperatura: 4.3,
    humedad: 61.2,
    vibracion: 0.09,
    posicion_gps: { type: "Point", coordinates: [-57.8000, -34.1000] },
    nivel_bateria: 93
  },
  {
    id_lectura: "LEC-004",
    id_sensor: "SENS-102",
    id_contenedor: "CONT-001",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 3600000 * 1.5),
    temperatura: null,
    humedad: null,
    vibracion: 0.85, // Impacto registrado durante el transporte terrestre
    posicion_gps: { type: "Point", coordinates: [-57.9500, -34.2500] },
    nivel_bateria: 91
  },
  {
    id_lectura: "LEC-005",
    id_sensor: "SENS-103",
    id_contenedor: "CONT-002",
    id_envio: "ENV-1002",
    fecha_hora: new Date(Date.now() - 3600000 * 5),
    temperatura: 10.4, // Ruptura de cadena de frío en contenedor reefer
    humedad: 71.0,
    vibracion: 0.05,
    posicion_gps: { type: "Point", coordinates: [-56.1645, -34.9011] }, // Montevideo
    nivel_bateria: 88
  },
  {
    id_lectura: "LEC-006",
    id_sensor: "SENS-104",
    id_contenedor: "CONT-006",
    id_envio: "ENV-1006",
    fecha_hora: new Date(Date.now() - 3600000 * 6),
    temperatura: 3.8,
    humedad: 58.2,
    vibracion: 0.06,
    posicion_gps: { type: "Point", coordinates: [-68.8458, -32.8895] },
    nivel_bateria: 87
  },
  {
    id_lectura: "LEC-007",
    id_sensor: "SENS-104",
    id_contenedor: "CONT-006",
    id_envio: "ENV-1006",
    fecha_hora: new Date(Date.now() - 3600000 * 4),
    temperatura: 4.2,
    humedad: 60.1,
    vibracion: 0.07,
    posicion_gps: { type: "Point", coordinates: [-68.7000, -31.9500] },
    nivel_bateria: 86
  },
  {
    id_lectura: "LEC-008",
    id_sensor: "SENS-105",
    id_contenedor: "CONT-007",
    id_envio: "ENV-1007",
    fecha_hora: new Date(Date.now() - 3600000 * 2),
    temperatura: 6.1,
    humedad: 64.0,
    vibracion: 0.11,
    posicion_gps: { type: "Point", coordinates: [-77.0428, -12.0464] },
    nivel_bateria: 92
  },
  {
    id_lectura: "LEC-009",
    id_sensor: "SENS-106",
    id_contenedor: "CONT-008",
    id_envio: "ENV-1008",
    fecha_hora: new Date(Date.now() - 3600000 * 8),
    temperatura: 5.0,
    humedad: 55.0,
    vibracion: 0.04,
    posicion_gps: { type: "Point", coordinates: [-71.6127, -33.0472] },
    nivel_bateria: 89
  }
]);

// Eventos Logísticos
db.eventos_logisticos.drop();
db.eventos_logisticos.createIndex({ id_evento: 1 }, { unique: true });
db.eventos_logisticos.createIndex({ id_envio: 1, fecha_hora: -1 });

db.eventos_logisticos.insertMany([
  {
    id_evento: "EVT-001",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 86400000 * 2),
    tipo_evento: "Carga iniciada",
    ubicacion: "Terminal Puerto Buenos Aires",
    descripcion: "Contenedor cargado y sellado en origen."
  },
  {
    id_evento: "EVT-002",
    id_envio: "ENV-1001",
    fecha_hora: new Date(Date.now() - 86400000),
    tipo_evento: "En tránsito",
    ubicacion: "Ruta Nacional 14",
    descripcion: "Transporte en marcha sin anomalías mecánicas."
  },
  {
    id_evento: "EVT-003",
    id_envio: "ENV-1006",
    fecha_hora: new Date(Date.now() - 86400000 * 2),
    tipo_evento: "Control fronterizo",
    ubicacion: "Paso Internacional",
    descripcion: "Documentación validada y carga liberada para continuar hacia Lima."
  },
  {
    id_evento: "EVT-004",
    id_envio: "ENV-1008",
    fecha_hora: new Date(Date.now() - 86400000 * 15),
    tipo_evento: "Entrega confirmada",
    ubicacion: "Asunción",
    descripcion: "Contenedor descargado y recepción firmada por el cliente."
  }
]);

// Incidentes y Alertas
db.incidentes.drop();
db.incidentes.createIndex({ id_incidente: 1 }, { unique: true });
db.incidentes.createIndex({ id_envio: 1, estado: 1 });
db.incidentes.createIndex({ id_sensor: 1, tipo: 1, estado: 1 });
db.incidentes.createIndex({ fecha: -1 });

db.incidentes.insertMany([
  {
    id_incidente: "INC-201",
    id_envio: "ENV-1001",
    id_sensor: "SENS-101",
    id_contenedor: "CONT-001",
    tipo: "EXCESO_TEMPERATURA",
    severidad: "ALTA",
    estado: "ABIERTO",
    descripcion: "Pico de temperatura superior a 8°C registrado por SENS-101.",
    fecha: new Date(Date.now() - 3600000 * 2)
  },
  {
    id_incidente: "INC-202",
    id_envio: "ENV-1001",
    id_sensor: null,
    id_contenedor: null,
    tipo: "DEMORA",
    severidad: "MEDIA",
    estado: "CERRADO",
    descripcion: "Retención de documentación en frontera Paso de los Libres.",
    fecha: new Date(Date.now() - 86400000 * 2)
  },
  {
    id_incidente: "INC-203",
    id_envio: "ENV-1001",
    id_sensor: "SENS-102",
    id_contenedor: "CONT-001",
    tipo: "VIBRACION_EXCESIVA",
    severidad: "BAJA",
    estado: "CERRADO",
    descripcion: "Vibración de 0.85g registrada por sensor en bacheo Ruta 14.",
    fecha: new Date(Date.now() - 86400000 * 1.5)
  },
  {
    id_incidente: "INC-204",
    id_envio: "ENV-1003",
    id_sensor: null,
    id_contenedor: null,
    tipo: "CONDICIONES_CLIMATICAS",
    severidad: "ALTA",
    estado: "CERRADO",
    descripcion: "Paso Cristo Redentor cerrado preventivamente por temporal de nieve.",
    fecha: new Date(Date.now() - 86400000 * 9)
  },
  {
    id_incidente: "INC-205",
    id_envio: "ENV-1003",
    id_sensor: null,
    id_contenedor: null,
    tipo: "DESVIO_RUTA",
    severidad: "MEDIA",
    estado: "CERRADO",
    descripcion: "Desvío obligatorio por mantenimiento de calzada RN 7.",
    fecha: new Date(Date.now() - 86400000 * 8.5)
  },
  {
    id_incidente: "INC-206",
    id_envio: "ENV-1004",
    id_sensor: null,
    id_contenedor: null,
    tipo: "DEMORA",
    severidad: "BAJA",
    estado: "CERRADO",
    descripcion: "Demora en atraque de buque en Terminal Santos.",
    fecha: new Date(Date.now() - 86400000 * 14)
  },
  {
    id_incidente: "INC-207",
    id_envio: "ENV-1005",
    id_sensor: "SENS-103",
    id_contenedor: "CONT-002",
    tipo: "RUPTURA_CADENA_FRIO",
    severidad: "CRITICA",
    estado: "ABIERTO",
    descripcion: "Alarma de temperatura 10.4°C en contenedor reefer durante escala.",
    fecha: new Date(Date.now() - 3600000 * 5)
  },
  {
    id_incidente: "INC-208",
    id_envio: "ENV-1006",
    id_sensor: "SENS-104",
    id_contenedor: "CONT-006",
    tipo: "DEMORA",
    severidad: "MEDIA",
    estado: "ABIERTO",
    descripcion: "Demora preventiva en control fronterizo del corredor andino.",
    fecha: new Date(Date.now() - 3600000 * 3)
  },
  {
    id_incidente: "INC-209",
    id_envio: "ENV-1007",
    id_sensor: "SENS-105",
    id_contenedor: "CONT-007",
    tipo: "VIBRACION_EXCESIVA",
    severidad: "BAJA",
    estado: "CERRADO",
    descripcion: "Vibración elevada durante maniobra de carga portuaria.",
    fecha: new Date(Date.now() - 86400000)
  }
]);

// Reglas de alerta configurables (umbrales dinámicos)
db.reglas_alertas.drop();
db.reglas_alertas.createIndex({ id_regla: 1 }, { unique: true });
db.reglas_alertas.createIndex({ tipo: 1, activa: 1 });

db.reglas_alertas.insertMany([
  {
    id_regla: "REG-TEMP-01",
    tipo: "TEMPERATURA",
    condicion: "MAYOR_QUE",
    umbral: 8,
    severidad: "ALTA",
    activa: true,
    descripcion: "Temperatura máxima permitida para cadena de frío (°C).",
    fecha_creacion: new Date()
  },
  {
    id_regla: "REG-BAT-01",
    tipo: "BATERIA",
    condicion: "MENOR_QUE",
    umbral: 20,
    severidad: "MEDIA",
    activa: true,
    descripcion: "Nivel mínimo de batería de un sensor (%).",
    fecha_creacion: new Date()
  },
  {
    id_regla: "REG-INACT-01",
    tipo: "INACTIVIDAD",
    condicion: "MAYOR_QUE",
    umbral: 2,
    severidad: "ALTA",
    activa: true,
    descripcion: "Horas máximas sin lecturas antes de generar una alerta.",
    fecha_creacion: new Date()
  },
  {
    id_regla: "REG-VIB-01",
    tipo: "VIBRACION",
    condicion: "MAYOR_QUE",
    umbral: 0.1,
    severidad: "BAJA",
    activa: true,
    descripcion: "Nivel de vibración que requiere revisar una maniobra de carga.",
    fecha_creacion: new Date()
  }
]);

db.alertas.drop();
db.alertas.createIndex({ id_alerta: 1 }, { unique: true });
db.alertas.createIndex({ id_sensor: 1, tipo: 1, estado: 1 });
db.alertas.createIndex({ id_incidente: 1, estado: 1 });
db.alertas.createIndex({ id_contenedor: 1, estado: 1 });

db.alertas.insertMany([
  {
    id_alerta: "ALT-501",
    id_sensor: "SENS-101",
    id_contenedor: "CONT-001",
    id_envio: "ENV-1001",
    tipo: "TEMPERATURA",
    severidad: "ALTA",
    estado: "ABIERTA",
    motivo: "UMBRAL_TEMPERATURA",
    valor_detectado: 8.9,
    umbral_aplicado: 8,
    id_regla: "REG-TEMP-01",
    mensaje: "Temperatura 8.9°C superior a 8°C",
    fecha: new Date(Date.now() - 3600000 * 2)
  },
  {
    id_alerta: "ALT-502",
    id_sensor: "SENS-104",
    id_contenedor: "CONT-006",
    id_envio: "ENV-1006",
    tipo: "INACTIVIDAD",
    severidad: "ALTA",
    estado: "ABIERTA",
    motivo: "SIN_LECTURAS_RECIENTES",
    valor_detectado: 3.5,
    umbral_aplicado: 2,
    id_regla: "REG-INACT-01",
    mensaje: "Más de dos horas sin una lectura confirmada en el corredor andino.",
    fecha: new Date(Date.now() - 3600000 * 3)
  },
  {
    id_alerta: "ALT-503",
    id_sensor: "SENS-105",
    id_contenedor: "CONT-007",
    id_envio: "ENV-1007",
    tipo: "VIBRACION",
    severidad: "BAJA",
    estado: "CERRADA",
    motivo: "UMBRAL_VIBRACION",
    valor_detectado: 0.11,
    umbral_aplicado: 0.1,
    id_regla: "REG-VIB-01",
    mensaje: "Vibración registrada durante la carga portuaria.",
    fecha: new Date(Date.now() - 86400000)
  }
]);

// Mensajes y Grupos de Trabajo (Comunicación)
db.mensajes.drop();
db.mensajes.createIndex({ id_mensaje: 1 }, { unique: true });
db.mensajes.createIndex({ tipo: 1, fecha: 1 });
db.mensajes.createIndex({ id_grupo: 1, fecha: 1 });
db.mensajes.createIndex({ remitente: 1, destinatario: 1, fecha: 1 });

db.mensajes.insertMany([
  {
    id_mensaje: "MSG-1",
    remitente: "admin@logistica.com",
    destinatario: "carlos@expressplata.com",
    id_grupo: null,
    contenido: "Carlos, por favor verificar el equipo de frío de CONT-001.",
    tipo: "PRIVADO",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000 * 4)
  },
  {
    id_mensaje: "MSG-2",
    remitente: "carlos@expressplata.com",
    destinatario: "admin@logistica.com",
    id_grupo: null,
    contenido: "Recibido. Ya solicité el diagnóstico del sensor SENS-101.",
    tipo: "PRIVADO",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000 * 3)
  },
  {
    id_mensaje: "MSG-3",
    remitente: "lucia@andina.com",
    destinatario: "admin@logistica.com",
    id_grupo: null,
    contenido: "Adjunto el parte de novedades del tramo andino.",
    tipo: "PRIVADO",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000 * 2)
  },
  {
    id_mensaje: "MSG-4",
    remitente: "admin@logistica.com",
    destinatario: null,
    id_grupo: "GRP-01",
    contenido: "Equipo, el envío ENV-1005 presenta una alerta crítica de cadena de frío.",
    tipo: "GRUPAL",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000)
  },
  {
    id_mensaje: "MSG-5",
    remitente: "carlos@expressplata.com",
    destinatario: null,
    id_grupo: "GRP-01",
    contenido: "Confirmado. Coordinamos la revisión del contenedor CONT-002 en la próxima escala.",
    tipo: "GRUPAL",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 1800000)
  },
  {
    id_mensaje: "MSG-6",
    remitente: "admin@logistica.com",
    destinatario: "lucia@andina.com",
    id_grupo: null,
    contenido: "ENV-1006 quedó demorado en el control fronterizo; revisar ETA.",
    tipo: "PRIVADO",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000 * 2)
  },
  {
    id_mensaje: "MSG-7",
    remitente: "admin@logistica.com",
    destinatario: null,
    id_grupo: "GRP-01",
    contenido: "La entrega ENV-1008 fue confirmada en Asunción.",
    tipo: "GRUPAL",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date(Date.now() - 3600000)
  }
]);

db.grupos_trabajo.drop();
db.grupos_trabajo.createIndex({ id_grupo: 1 }, { unique: true });
db.grupos_trabajo.createIndex({ integrantes: 1 });
db.grupos_trabajo.insertOne({
  id_grupo: "GRP-01",
  nombre: "Comité de Monitoreo Mercosur",
  integrantes: ["admin@logistica.com", "carlos@expressplata.com", "lucia@andina.com"]
});

// Predicciones de Riesgo Históricas
db.predicciones_riesgo.drop();
db.predicciones_riesgo.createIndex({ id_envio: 1 });

db.predicciones_riesgo.insertOne({
  id_prediccion: "PRED-1001",
  id_envio: "ENV-1001",
  riesgo_climatico: "MODERADO",
  riesgo_operativo: "BAJO",
  probabilidad_demora: 0.22,
  factores: ["Lluvia leve en paso fronterizo", "Tráfico normal en aduana"],
  fecha_calculo: new Date()
});
db.predicciones_riesgo.insertMany([
  {
    id_prediccion: "PRED-1006",
    id_envio: "ENV-1006",
    riesgo_climatico: "ALTO",
    riesgo_operativo: "MODERADO",
    probabilidad_demora: 0.61,
    factores: ["Paso fronterizo congestionado", "Pronóstico de nieve en altura"],
    fecha_calculo: new Date()
  },
  {
    id_prediccion: "PRED-1008",
    id_envio: "ENV-1008",
    riesgo_climatico: "BAJO",
    riesgo_operativo: "BAJO",
    probabilidad_demora: 0.08,
    factores: ["Ruta despejada", "Entrega ya confirmada"],
    fecha_calculo: new Date(Date.now() - 86400000 * 2)
  }
]);

// Reportes comerciales / contables / analíticos (histórico documental)
db.reportes.drop();
db.reportes.aggregate([
  { $match: { id_reporte: { $type: "string" } } },
  { $sort: { fecha_generacion: -1, _id: -1 } },
  { $group: { _id: "$id_reporte", ids: { $push: "$_id" }, total: { $sum: 1 } } },
  { $match: { total: { $gt: 1 } } }
]).forEach(function (grupo) {
  grupo.ids.slice(1).forEach(function (id) { db.reportes.deleteOne({ _id: id }); });
});
db.reportes.createIndex({ id_reporte: 1 }, { unique: true, sparse: true, name: 'uq_reporte_id' });
db.reportes.createIndex({ fecha_generacion: -1 }, { name: 'idx_reporte_fecha' });
db.reportes.createIndex({ categoria: 1, tipo: 1 }, { name: 'idx_reporte_categoria_tipo' });

// Reportes históricos de demostración. Se usa upsert para que el seed sea
// idempotente y no duplique documentos al ejecutarse más de una vez.
[
  {
    id_reporte: "REP-SEED-COM-001",
    usuario: "admin@logistica.com",
    tipo: "REPORTE_COMERCIAL_PARAMETRIZADO",
    categoria: "COMERCIAL",
    parametros: {
      tipo_actor: "TODOS",
      tipo_factura: "TODAS",
      estado_factura: "TODAS"
    },
    resumen: {
      total_facturas: 4,
      total_facturado: 222000.00,
      total_pagado: 125000.00,
      saldo_pendiente: 97000.00
    },
    fecha_generacion: new Date(Date.now() - 86400000 * 3)
  },
  {
    id_reporte: "REP-SEED-OPE-001",
    usuario: "admin@logistica.com",
    tipo: "REPORTE_OPERATIVO_ENVIOS",
    categoria: "OPERATIVO",
    parametros: {
      estado: "TODOS",
      id_cliente: null
    },
    resumen: {
      total_envios: 5,
      entregados: 2,
      en_transito: 3,
      con_incidentes: 4
    },
    fecha_generacion: new Date(Date.now() - 86400000 * 2)
  },
  {
    id_reporte: "REP-SEED-ANA-001",
    usuario: "admin@logistica.com",
    tipo: "RANKING_RUTAS_INCIDENTES",
    categoria: "INTELIGENCIA_ANALITICA",
    parametros: {
      forzar_recalculo: false
    },
    resumen: {
      total_rutas_evaluadas: 5,
      ruta_mas_critica: "Buenos Aires, Argentina ➔ San Pablo, Brasil",
      total_incidentes: 7
    },
    fecha_generacion: new Date(Date.now() - 86400000)
  },
  {
    id_reporte: "REP-SEED-OPE-002",
    usuario: "admin@logistica.com",
    tipo: "REPORTE_OPERATIVO_ENVIOS",
    categoria: "OPERATIVO",
    parametros: { estado: "EN_TRANSITO", id_cliente: 3 },
    resumen: {
      total_envios: 1,
      entregados: 0,
      en_transito: 1,
      con_incidentes: 1
    },
    fecha_generacion: new Date(Date.now() - 3600000 * 6)
  }
].forEach(function (reporte) {
  db.reportes.updateOne(
    { id_reporte: reporte.id_reporte },
    { $set: reporte },
    { upsert: true }
  );
});

print("MongoDB inicializado exitosamente para tpo_telemetria");
