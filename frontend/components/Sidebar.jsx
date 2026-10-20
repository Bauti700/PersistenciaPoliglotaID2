function Sidebar({ activeTab, setActiveTab, dbStatus }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">P12</div>
        <div>
          <div className="brand-title">Logística IoT</div>
          <div className="brand-subtitle">Persistencia Políglota</div>
        </div>
      </div>

      <nav className="nav-menu">
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span>📊 Dashboard General</span>
        </div>
        <div className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}>
          <span>🏢 Clientes & Cuentas (PG)</span>
        </div>
        <div className={`nav-item ${activeTab === 'telemetria' ? 'active' : ''}`} onClick={() => setActiveTab('telemetria')}>
          <span>📡 Telemetría & IoT (Mongo)</span>
        </div>
        <div className={`nav-item ${activeTab === 'rutas' ? 'active' : ''}`} onClick={() => setActiveTab('rutas')}>
          <span>🕸️ Rutas & Grafo (Neo4j)</span>
        </div>
        <div className={`nav-item ${activeTab === 'cache' ? 'active' : ''}`} onClick={() => setActiveTab('cache')}>
          <span>⚡ Caché en Tiempo Real (Redis)</span>
        </div>
      </nav>

      {/* Monitor de Estado de los 4 Motores de Bases de Datos */}
      <div className="db-status-panel">
        <div className="db-status-title">Estado de Motores</div>
        <div className="db-indicator-row">
          <span>PostgreSQL</span>
          <span><span className={`dot ${dbStatus?.postgres ? 'online' : 'offline'}`}></span>{dbStatus?.postgres ? 'OK' : 'OFF'}</span>
        </div>
        <div className="db-indicator-row">
          <span>MongoDB</span>
          <span><span className={`dot ${dbStatus?.mongo ? 'online' : 'offline'}`}></span>{dbStatus?.mongo ? 'OK' : 'OFF'}</span>
        </div>
        <div className="db-indicator-row">
          <span>Neo4j</span>
          <span><span className={`dot ${dbStatus?.neo4j ? 'online' : 'offline'}`}></span>{dbStatus?.neo4j ? 'OK' : 'OFF'}</span>
        </div>
        <div className="db-indicator-row">
          <span>Redis</span>
          <span><span className={`dot ${dbStatus?.redis ? 'online' : 'offline'}`}></span>{dbStatus?.redis ? 'OK' : 'OFF'}</span>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
