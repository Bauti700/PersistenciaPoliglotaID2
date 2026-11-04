export function calcularRiesgoEnvio({
  id_envio,
  estado,
  prioridad,
  fecha_entrega,
  fecha_entrega_estimada,
  incidentes
}) {
  const totalIncidentes = incidentes.length;
  const incidentesCriticos = incidentes
    .filter(i => ['ALTA', 'CRITICA'].includes(i.severidad))
    .length;
  const fechaEstimada = fecha_entrega_estimada ? new Date(fecha_entrega_estimada) : null;
  const demoraEstimada = Boolean(
    fechaEstimada &&
    !fecha_entrega &&
    estado !== 'ENTREGADO' &&
    fechaEstimada < new Date()
  );

  let probabilidad = 10;
  if (totalIncidentes > 0) probabilidad += totalIncidentes * 15;
  if (incidentesCriticos > 0) probabilidad += incidentesCriticos * 20;
  if (prioridad === 'ALTA') probabilidad += 10;
  if (estado === 'EN_TRANSITO') probabilidad += 5;
  if (demoraEstimada) probabilidad += 15;
  probabilidad = Math.min(probabilidad, 95);

  return {
    id_envio,
    probabilidad_demora: `${probabilidad}%`,
    nivel_riesgo: probabilidad > 70 ? 'ALTO' : probabilidad > 40 ? 'MEDIO' : 'BAJO',
    factores: {
      incidentes_totales: totalIncidentes,
      incidentes_criticos: incidentesCriticos,
      prioridad,
      estado,
      demora_estimada: demoraEstimada ? 'SI' : 'NO'
    },
    fecha_calculo: new Date().toISOString(),
    origen: 'CALCULADO'
  };
}
