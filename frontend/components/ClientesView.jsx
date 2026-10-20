function ClientesView({
  clientes = [],
  ranking = [],
  nuevoCliente,
  setNuevoCliente,
  handleCrearCliente
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Gestión de Clientes y Cuentas Corrientes (PostgreSQL ACID)</h3>
        <span className="badge badge-pg">PostgreSQL</span>
      </div>
      <form onSubmit={handleCrearCliente} style={{ marginBottom: '1.5rem' }}>
        <div className="form-grid">
          <div className="input-group">
            <label>Razón Social</label>
            <input type="text" value={nuevoCliente.razon_social} onChange={e => setNuevoCliente({...nuevoCliente, razon_social: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>CUIT</label>
            <input type="text" value={nuevoCliente.cuit} onChange={e => setNuevoCliente({...nuevoCliente, cuit: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={nuevoCliente.email} onChange={e => setNuevoCliente({...nuevoCliente, email: e.target.value})} required />
          </div>
          <div className="input-group">
            <label>País</label>
            <input type="text" value={nuevoCliente.pais} onChange={e => setNuevoCliente({...nuevoCliente, pais: e.target.value})} required />
          </div>
        </div>
        <button type="submit">➕ Registrar Cliente</button>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Razón Social</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>País</th>
              <th>Saldo Cuenta Corriente</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id_actor}>
                <td>{c.id_actor}</td>
                <td><strong>{c.razon_social}</strong></td>
                <td>{c.cuit}</td>
                <td>{c.email}</td>
                <td>{c.pais}</td>
                <td style={{ color: c.saldo < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  ${Number(c.saldo || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h4>Ranking de Clientes por Volumen</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Total Envíos</th>
                <th>Volumen Facturado</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(r => (
                <tr key={r.id_actor}>
                  <td>{r.razon_social}</td>
                  <td>{r.total_envios}</td>
                  <td>${Number(r.volumen_facturado).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.ClientesView = ClientesView;
