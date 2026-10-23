function ContenedoresView({
  contenedores = [],
  form,
  setForm,
  contenedorEditando,
  onGuardar,
  onEditar,
  onDarDeBaja,
  onCancelarEdicion
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Gestión de Contenedores</h3>
        <span className="badge badge-pg">PostgreSQL</span>
      </div>
      <p>La baja es lógica para conservar la trazabilidad y las asociaciones con sensores.</p>

      <form onSubmit={onGuardar} style={{ marginBottom: '1.5rem' }}>
        <div className="form-grid">
          <div className="input-group">
            <label>ID del contenedor</label>
            <input
              type="text"
              value={form.id_contenedor}
              onChange={e => setForm({ ...form, id_contenedor: e.target.value })}
              disabled={Boolean(contenedorEditando)}
              required
            />
          </div>
          <div className="input-group">
            <label>Código internacional</label>
            <input
              type="text"
              value={form.codigo_internacional}
              onChange={e => setForm({ ...form, codigo_internacional: e.target.value })}
              required
            />
          </div>
          <div className="input-group">
            <label>Tipo</label>
            <input
              type="text"
              placeholder="Reefer (Refrigerado), Dry (Carga Seca)..."
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
              required
            />
          </div>
          <div className="input-group">
            <label>Capacidad (kg)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.capacidad}
              onChange={e => setForm({ ...form, capacidad: e.target.value })}
              required
            />
          </div>
          <div className="input-group">
            <label>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="DISPONIBLE">Disponible</option>
              <option value="EN_TRANSITO">En tránsito</option>
              <option value="FUERA_SERVICIO">Fuera de servicio</option>
            </select>
          </div>
        </div>
        <button type="submit">{contenedorEditando ? '💾 Guardar cambios' : '➕ Registrar contenedor'}</button>
        {contenedorEditando && (
          <button type="button" onClick={onCancelarEdicion} style={{ marginLeft: '0.5rem' }}>
            Cancelar
          </button>
        )}
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código internacional</th>
              <th>Tipo</th>
              <th>Capacidad (kg)</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contenedores.map(contenedor => (
              <tr key={contenedor.id_contenedor}>
                <td>{contenedor.id_contenedor}</td>
                <td>{contenedor.codigo_internacional}</td>
                <td>{contenedor.tipo}</td>
                <td>{Number(contenedor.capacidad).toLocaleString()}</td>
                <td>{contenedor.estado}</td>
                <td>
                  <button type="button" onClick={() => onEditar(contenedor)}>Editar</button>
                  {contenedor.estado !== 'FUERA_SERVICIO' && (
                    <button
                      type="button"
                      onClick={() => onDarDeBaja(contenedor)}
                      disabled={contenedor.estado === 'EN_TRANSITO'}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Dar de baja
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {contenedores.length === 0 && (
              <tr><td colSpan="6">No hay contenedores registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ContenedoresView = ContenedoresView;
