const { useState, useEffect } = React;
const API_URL = '/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState({ postgres: false, mongo: false, neo4j: false, redis: false });
  const [clientes, setClientes] = useState([]);
  const [contenedores, setContenedores] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [sensores, setSensores] = useState([]);
  const [anomalias, setAnomalias] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [redGrafo, setRedGrafo] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estados de formularios
  const [nuevoCliente, setNuevoCliente] = useState({ razon_social: '', cuit: '', email: '', pais: 'Argentina' });
  const [formContenedor, setFormContenedor] = useState({ id_contenedor: '', codigo_internacional: '', tipo: '', capacidad: '', estado: 'DISPONIBLE' });
  const [contenedorEditando, setContenedorEditando] = useState(null);
  const [nuevaLectura, setNuevaLectura] = useState({ id_sensor: 'SENS-101', id_contenedor: 'CONT-001', id_envio: 'ENV-1001', temperatura: 4.5, humedad: 60, latitud: -34.6037, longitud: -58.3816 });
  const [nuevoEnvio, setNuevoEnvio] = useState({ id_envio: 'ENV-2001', id_cliente: 1, origen: 'Buenos Aires', destino: 'San Pablo', operador: 'Logística Express del Plata', vehiculo: 'AF-204-ZX' });
  const [cachePos, setCachePos] = useState(null);
  const [prediccion, setPrediccion] = useState(null);

  useEffect(() => {
    fetchStatus();
    cargarDatos();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      setDbStatus(data.engines || {});
    } catch (e) {
      console.warn("API offline");
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resCli, resCont, resEnv, resSen, resAnom, resRank, resRed] = await Promise.all([
        fetch(`${API_URL}/clientes`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/contenedores`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/envios`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/sensores`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/anomalias/temperatura`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/reportes/ranking-clientes`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/grafo/red`).then(r => r.json()).catch(() => [])
      ]);
      setClientes(resCli || []);
      setContenedores(Array.isArray(resCont) ? resCont : []);
      setEnvios(resEnv || []);
      setSensores(resSen || []);
      setAnomalias(resAnom || []);
      setRanking(resRank || []);
      setRedGrafo(resRed || []);
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormularioContenedor = () => {
    setContenedorEditando(null);
    setFormContenedor({ id_contenedor: '', codigo_internacional: '', tipo: '', capacidad: '', estado: 'DISPONIBLE' });
  };

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCliente)
      });
      if (res.ok) {
        alert("Cliente creado exitosamente en PostgreSQL!");
        setNuevoCliente({ razon_social: '', cuit: '', email: '', pais: 'Argentina' });
        cargarDatos();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleGuardarContenedor = async (e) => {
    e.preventDefault();
    try {
      const editando = Boolean(contenedorEditando);
      const url = editando
        ? `${API_URL}/contenedores/${encodeURIComponent(contenedorEditando)}`
        : `${API_URL}/contenedores`;
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formContenedor)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el contenedor.');

      alert(editando ? 'Contenedor actualizado.' : 'Contenedor registrado.');
      limpiarFormularioContenedor();
      await cargarDatos();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEditarContenedor = (contenedor) => {
    setContenedorEditando(contenedor.id_contenedor);
    setFormContenedor({
      id_contenedor: contenedor.id_contenedor,
      codigo_internacional: contenedor.codigo_internacional,
      tipo: contenedor.tipo,
      capacidad: contenedor.capacidad,
      estado: contenedor.estado
    });
  };

  const handleDarDeBajaContenedor = async (contenedor) => {
    if (!window.confirm(`¿Dar de baja el contenedor ${contenedor.id_contenedor}? Se conservará para mantener la trazabilidad.`)) return;
    try {
      const res = await fetch(`${API_URL}/contenedores/${encodeURIComponent(contenedor.id_contenedor)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo dar de baja el contenedor.');
      alert('Contenedor marcado FUERA_SERVICIO.');
      if (contenedorEditando === contenedor.id_contenedor) limpiarFormularioContenedor();
      await cargarDatos();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEnviarTelemetria = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/telemetria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaLectura)
      });
      if (res.ok) {
        alert("Telemetría registrada en MongoDB y guardada en caché Redis!");
        cargarDatos();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleCrearEnvio = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/envios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevoEnvio,
          tramos: [{ desde: nuevoEnvio.origen, hasta: nuevoEnvio.destino, medio: 'Terrestre' }]
        })
      });
      if (res.ok) {
        alert("Envío políglota creado en PostgreSQL, Neo4j y MongoDB!");
        cargarDatos();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const consultarCacheRedis = async (idContenedor) => {
    try {
      const res = await fetch(`${API_URL}/redis/posicion/${idContenedor}`);
      const data = await res.json();
      setCachePos({ contenedor: idContenedor, data });
    } catch (e) {
      alert("Error leyendo Redis: " + e.message);
    }
  };

  const consultarPrediccion = async (idEnvio) => {
    try {
      const res = await fetch(`${API_URL}/prediccion/${idEnvio}`);
      const data = await res.json();
      setPrediccion(data);
    } catch (e) {
      alert("Error calculando predicción: " + e.message);
    }
  };

  return (
    <div className="app-container">
      <window.Sidebar activeTab={activeTab} setActiveTab={setActiveTab} dbStatus={dbStatus} />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <window.DashboardView
            clientes={clientes}
            envios={envios}
            anomalias={anomalias}
            redGrafo={redGrafo}
            nuevoEnvio={nuevoEnvio}
            setNuevoEnvio={setNuevoEnvio}
            handleCrearEnvio={handleCrearEnvio}
            consultarPrediccion={consultarPrediccion}
            prediccion={prediccion}
            cargarDatos={cargarDatos}
          />
        )}

        {activeTab === 'clientes' && (
          <window.ClientesView
            clientes={clientes}
            ranking={ranking}
            nuevoCliente={nuevoCliente}
            setNuevoCliente={setNuevoCliente}
            handleCrearCliente={handleCrearCliente}
          />
        )}

        {activeTab === 'contenedores' && (
          <window.ContenedoresView
            contenedores={contenedores}
            form={formContenedor}
            setForm={setFormContenedor}
            contenedorEditando={contenedorEditando}
            onGuardar={handleGuardarContenedor}
            onEditar={handleEditarContenedor}
            onDarDeBaja={handleDarDeBajaContenedor}
            onCancelarEdicion={limpiarFormularioContenedor}
          />
        )}

        {activeTab === 'telemetria' && (
          <window.TelemetriaView
            nuevaLectura={nuevaLectura}
            setNuevaLectura={setNuevaLectura}
            handleEnviarTelemetria={handleEnviarTelemetria}
            contenedores={contenedores}
            anomalias={anomalias}
          />
        )}

        {activeTab === 'rutas' && (
          <window.RutasGrafoView redGrafo={redGrafo} />
        )}

        {activeTab === 'cache' && (
          <window.RedisCacheView
            consultarCacheRedis={consultarCacheRedis}
            cachePos={cachePos}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
