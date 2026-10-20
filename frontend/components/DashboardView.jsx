function DashboardView({
  clientes = [],
  envios = [],
  anomalias = [],
  redGrafo = [],
  nuevoEnvio,
  setNuevoEnvio,
  handleCrearEnvio,
  consultarPrediccion,
  prediccion,
  cargarDatos
}) {
  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">Centro de Control Logístico</h1>
          <p className="header-desc">Visión global de persistencia coordinada (Relacional + Documental + Grafo + Clave-Valor)</p>
        </div>
        <button onClick={cargarDatos}>🔄 Refrescar Datos</button>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid-cards">
        <div className="card">
          <div className="card-header">
            <span className="badge badge-pg">PostgreSQL</span>
            <span>👥</span>
          </div>
          <h3>{clientes.length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Clientes Activos Registrados</p>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="badge badge-pg">PostgreSQL</span>
            <span>📦</span>
          </div>
          <h3>{envios.length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Envíos en Tránsito</p>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="badge badge-mongo">MongoDB</span>
            <span>⚠️</span>
          </div>
          <h3 style={{ color: anomalias.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{anomalias.length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Anomalías de Temp. Detectadas</p>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="badge badge-neo">Neo4j</span>
            <span>🔗</span>
          </div>
          <h3>{redGrafo.length}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Conexiones de Ruta Mapeadas</p>
        </div>
      </div>

      {/* Formulario de Alta de Envío Políglota */}
      <div className="card">
        <div className="card-header">
          <h3>Nuevo Envío Políglota (Sincronización PG + Neo4j + Mongo)</h3>
          <span className="badge badge-pg">Orquestado</span>
        </div>
        <form onSubmit={handleCrearEnvio}>
          <div className="form-grid">
            <div className="input-group">
              <label>Código Envío</label>
              <input type="text" value={nuevoEnvio.id_envio} onChange={e => setNuevoEnvio({...nuevoEnvio, id_envio: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Cliente</label>
              <select value={nuevoEnvio.id_cliente} onChange={e => setNuevoEnvio({...nuevoEnvio, id_cliente: e.target.value})}>
                {clientes.map(c => <option key={c.id_actor} value={c.id_actor}>{c.razon_social}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Origen</label>
              <input type="text" value={nuevoEnvio.origen} onChange={e => setNuevoEnvio({...nuevoEnvio, origen: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Destino</label>
              <input type="text" value={nuevoEnvio.destino} onChange={e => setNuevoEnvio({...nuevoEnvio, destino: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Operador Asignado</label>
              <input type="text" value={nuevoEnvio.operador} onChange={e => setNuevoEnvio({...nuevoEnvio, operador: e.target.value})} />
            </div>
          </div>
          <button type="submit">🚀 Crear y Sincronizar en Todas las Bases</button>
        </form>
      </div>

      {/* Tabla de Envíos Registrados */}
      <div className="card">
        <h3>Envíos y Trazabilidad</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {envios.map(e => (
                <tr key={e.id_envio}>
                  <td><strong>{e.id_envio}</strong></td>
                  <td>{e.cliente_nombre}</td>
                  <td>{e.origen}</td>
                  <td>{e.destino}</td>
                  <td><span className="badge badge-pg">{e.estado}</span></td>
                  <td>{e.prioridad}</td>
                  <td>
                    <button style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => consultarPrediccion(e.id_envio)}>
                      🎯 Predecir Riesgo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {prediccion && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(11,15,25,0.7)', borderRadius: '10px' }}>
            <h4>Predicción para {prediccion.id_envio} ({prediccion.origen_datos}):</h4>
            <p>Probabilidad de demora: <strong>{(prediccion.probabilidad_demora * 100).toFixed(0)}%</strong> | Riesgo Climático: <strong>{prediccion.riesgo_climatico}</strong></p>
          </div>
        )}
      </div>
    </>
  );
}

window.DashboardView = DashboardView;
