function RedisCacheView({ consultarCacheRedis, cachePos }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Caché en Memoria de Alto Rendimiento (Redis)</h3>
        <span className="badge badge-redis">Redis</span>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        Almacena en RAM la última coordenada GPS conocida de cada contenedor y las sesiones con TTL.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0' }}>
        <button onClick={() => consultarCacheRedis('CONT-001')}>Consultar Posición CONT-001</button>
        <button onClick={() => consultarCacheRedis('CONT-002')}>Consultar Posición CONT-002</button>
      </div>

      {cachePos && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Resultado en Caché ({cachePos.contenedor}):</h4>
          <pre>{JSON.stringify(cachePos.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

window.RedisCacheView = RedisCacheView;
