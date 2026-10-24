// =============================================================================
// SCRIPT DE INICIALIZACIÓN MONGODB - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
// Colecciones: sensores, lecturas_sensores, incidentes, eventos_logisticos,
//              alertas, mensajes, grupos_trabajo, predicciones_riesgo
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
  }
]);

// Lecturas Sensores (Telemetría con índices temporales y geoespaciales)
db.lecturas_sensores.drop();
db.lecturas_sensores.createIndex({ id_sensor: 1, fecha_hora: -1 });
db.lecturas_sensores.createIndex({ posicion_gps: "2dsphere" });

db.lecturas_sensores.insertMany([
  {
    id_sensor: "SENS-101",
    fecha_hora: new Date(Date.now() - 3600000 * 3),
    temperatura: 4.1,
    humedad: 62.5,
    vibracion: 0.08,
    posicion_gps: { type: "Point", coordinates: [-58.3816, -34.6037] }, // Buenos Aires
    nivel_bateria: 95
  },
  {
    id_sensor: "SENS-101",
    fecha_hora: new Date(Date.now() - 3600000 * 2),
    temperatura: 8.9, // Anomalía leve de temperatura en contenedor refrigerado
    humedad: 68.0,
    vibracion: 0.12,
    posicion_gps: { type: "Point", coordinates: [-58.2000, -34.4000] },
    nivel_bateria: 94
  },
  {
    id_sensor: "SENS-101",
    fecha_hora: new Date(Date.now() - 3600000),
    temperatura: 4.3,
    humedad: 61.2,
    vibracion: 0.09,
    posicion_gps: { type: "Point", coordinates: [-57.8000, -34.1000] },
    nivel_bateria: 93
  }
]);

// Eventos Logísticos
db.eventos_logisticos.drop();
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
  }
]);

// Incidentes y Alertas
db.incidentes.drop();
db.incidentes.createIndex({ id_envio: 1, estado: 1 });

db.incidentes.insertMany([
  {
    id_incidente: "INC-201",
    id_envio: "ENV-1001",
    tipo: "Temperatura fuera de rango",
    severidad: "ALTA",
    estado: "ABIERTO",
    descripcion: "Pico de temperatura superior a 8°C registrado por SENS-101.",
    fecha: new Date(Date.now() - 3600000 * 2)
  },
  {
    id_incidente: "INC-202",
    id_envio: "ENV-1001",
    tipo: "Demora Aduanera",
    severidad: "MEDIA",
    estado: "CERRADO",
    descripcion: "Retención de documentación en frontera Paso de los Libres.",
    fecha: new Date(Date.now() - 86400000 * 2)
  },
  {
    id_incidente: "INC-203",
    id_envio: "ENV-1001",
    tipo: "Vibración Excesiva",
    severidad: "BAJA",
    estado: "CERRADO",
    descripcion: "Vibración de 0.85g registrada por sensor en bacheo Ruta 14.",
    fecha: new Date(Date.now() - 86400000 * 1.5)
  },
  {
    id_incidente: "INC-204",
    id_envio: "ENV-1003",
    tipo: "Condiciones Climáticas Adversas",
    severidad: "ALTA",
    estado: "CERRADO",
    descripcion: "Paso Cristo Redentor cerrado preventivamente por temporal de nieve.",
    fecha: new Date(Date.now() - 86400000 * 9)
  },
  {
    id_incidente: "INC-205",
    id_envio: "ENV-1003",
    tipo: "Desvío de Ruta",
    severidad: "MEDIA",
    estado: "CERRADO",
    descripcion: "Desvío obligatorio por mantenimiento de calzada RN 7.",
    fecha: new Date(Date.now() - 86400000 * 8.5)
  },
  {
    id_incidente: "INC-206",
    id_envio: "ENV-1004",
    tipo: "Demora Portuaria",
    severidad: "BAJA",
    estado: "CERRADO",
    descripcion: "Demora en atraque de buque en Terminal Santos.",
    fecha: new Date(Date.now() - 86400000 * 14)
  },
  {
    id_incidente: "INC-207",
    id_envio: "ENV-1005",
    tipo: "Ruptura de Cadena de Frío",
    severidad: "CRITICA",
    estado: "ABIERTO",
    descripcion: "Alarma de temperatura 10.4°C en contenedor reefer durante escala.",
    fecha: new Date(Date.now() - 3600000 * 5)
  }
]);

db.alertas.drop();
db.alertas.insertMany([
  {
    id_alerta: "ALT-501",
    id_sensor: "SENS-101",
    evento: "Alerta de Temperatura",
    mensaje: "Temperatura por encima del límite de refrigeración (8.9°C)",
    tipo: "CRITICA",
    fecha: new Date(Date.now() - 3600000 * 2),
    estado: "PENDIENTE"
  }
]);

// Mensajes y Grupos de Trabajo (Comunicación)
db.mensajes.drop();
db.mensajes.createIndex({ id_grupo: 1, fecha: 1 });
db.mensajes.createIndex({ remitente: 1, destinatario: 1 });

db.mensajes.insertMany([
  {
    id_mensaje: "MSG-1",
    remitente: "admin@logistica.com",
    destinatario: "carlos@expressplata.com",
    contenido: "Carlos, por favor verificar el equipo de frío de CONT-001.",
    tipo: "PRIVADO",
    formato: "TEXTO",
    estado: "ENVIADO",
    fecha: new Date()
  }
]);

db.grupos_trabajo.drop();
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

print("MongoDB inicializado exitosamente para tpo_telemetria");
