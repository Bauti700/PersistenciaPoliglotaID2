function RutasGrafoView({ redGrafo = [] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Topología de Rutas y Redes de Transporte (Neo4j Cypher)</h3>
        <span className="badge badge-neo">Neo4j</span>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Navegación eficiente entre nodos y relaciones sin JOINs pesados: (Cliente) ➔ [:SOLICITA] ➔ (Envio) ➔ [:ASIGNADO_A] ➔ (Operador).
      </p>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Envío</th>
              <th>Operador Logístico</th>
              <th>Vehículo Asignado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {redGrafo.map((r, i) => (
              <tr key={i}>
                <td><strong>{r.cliente_nombre || 'Cliente ' + r.cliente_id}</strong></td>
                <td>{r.envio_id}</td>
                <td>{r.operador || 'Directo'}</td>
                <td><code>{r.vehiculo || 'Sin asignar'}</code></td>
                <td><span className="badge badge-pg">{r.envio_estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.RutasGrafoView = RutasGrafoView;
