function TelemetriaView({
  nuevaLectura,
  setNuevaLectura,
  handleEnviarTelemetria,
  contenedores = [],
  anomalias = []
}) {
  const contenedoresActivos = contenedores.filter(contenedor => contenedor.estado !== 'FUERA_SERVICIO');
  return (
    <div className="card">
      <div className="card-header">
        <h3>Ingesta de Telemetría IoT en Tiempo Real (MongoDB)</h3>
        <span className="badge badge-mongo">MongoDB</span>
      </div>
      <form onSubmit={handleEnviarTelemetria} style={{ marginBottom: '1.5rem' }}>
        <div className="form-grid">
          <div className="input-group">
            <label>ID Sensor</label>
            <input type="text" value={nuevaLectura.id_sensor} onChange={e => setNuevaLectura({...nuevaLectura, id_sensor: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Contenedor Asociado</label>
            <select
              value={nuevaLectura.id_contenedor}
              onChange={e => setNuevaLectura({...nuevaLectura, id_contenedor: e.target.value})}
              required
              disabled={contenedoresActivos.length === 0}
            >
              {contenedoresActivos.length === 0 && <option value="">No hay contenedores disponibles</option>}
              {contenedoresActivos.map(contenedor => (
                <option key={contenedor.id_contenedor} value={contenedor.id_contenedor}>
                  {contenedor.id_contenedor} — {contenedor.codigo_internacional}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Temperatura (°C)</label>
            <input type="number" step="0.1" value={nuevaLectura.temperatura} onChange={e => setNuevaLectura({...nuevaLectura, temperatura: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Humedad (%)</label>
            <input type="number" value={nuevaLectura.humedad} onChange={e => setNuevaLectura({...nuevaLectura, humedad: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Latitud GPS</label>
            <input type="number" step="0.0001" value={nuevaLectura.latitud} onChange={e => setNuevaLectura({...nuevaLectura, latitud: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Longitud GPS</label>
            <input type="number" step="0.0001" value={nuevaLectura.longitud} onChange={e => setNuevaLectura({...nuevaLectura, longitud: e.target.value})} required />
          </div>
        </div>
        <button type="submit" disabled={contenedoresActivos.length === 0}>📡 Emitir Lectura IoT</button>
      </form>

      <h4>Anomalías de Temperatura Detectadas (&gt; 8°C)</h4>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Temperatura</th>
              <th>Fecha / Hora</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {anomalias.map((a, i) => (
              <tr key={i}>
                <td>{a.id_sensor}</td>
                <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{a.temperatura} °C</td>
                <td>{new Date(a.fecha_hora).toLocaleString()}</td>
                <td><span className="badge badge-redis">ALERTA DISPARADA</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.TelemetriaView = TelemetriaView;
