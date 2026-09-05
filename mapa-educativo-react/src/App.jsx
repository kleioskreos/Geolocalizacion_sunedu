import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { MapTools, ResultsInfo, LoadingOverlay, ExportButton, CoordDisplay } from "./components/MapTools";
import { useLeafletMap } from "./hooks/useLeafletMap";
import { useMapTools } from "./hooks/useMapTools";
import { api, errorMessage } from './api';
import { filterSchools } from './filters';
import { ImportDialog } from './components/ImportDialog';
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./App.css";

function App() {
  const mapContainerRef = useRef(null);
  const [schools,setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [error,setError] = useState('');
  const [showImport,setShowImport] = useState(false);
  const [tableOpen,setTableOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [coordDisplay, setCoordDisplay] = useState({ visible: false, lat: 0, lng: 0 });
  const toolRef=useRef(null);
  const loadSchools=useCallback(async()=>{
    setLoading(true);setError('');
    try {const {data}=await api.get('/schools');setSchools(data.schools);setFilteredSchools([]);setResultsVisible(false)}
    catch(err){setError(errorMessage(err))}finally{setLoading(false)}
  },[]);
  // Fetch the persisted dataset when the map mounts.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(()=>{loadSchools()},[loadSchools]);
  useEffect(()=>{toolRef.current=activeTool},[activeTool]);

  const onMapReady = useCallback((map) => {
    // Mouse coordinate tracking
    map.on("mousemove", (e) => {
      if (toolRef.current === "coord") {
        setCoordDisplay({ visible: true, lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });
  }, []);

  const { mapRef, drawnItemsRef, flyToDept, flyToDefault, invalidateSize } = useLeafletMap(mapContainerRef, {
    schools: filteredSchools,
    onMapReady,
  });

  const tools = useMapTools(mapRef, drawnItemsRef);

  const toolButtons = useMemo(() => [
    { id: "coord", title: "Obtener las coordenadas de un punto", icon: "pin", active: activeTool === "coord" },
    { id: "distance", title: "Calcular la distancia entre dos o más puntos", icon: "line", active: activeTool === "distance" },
    { id: "area", title: "Calcular el área de una superficie", icon: "polygon", active: activeTool === "area" },
    { id: "identify", title: "Ver información de un servicio", icon: "info", active: activeTool === "identify" },
    { id: "erase", title: "Borrar los elementos agregados", icon: "erase", active: activeTool === "erase" },
  ], [activeTool]);

  const handleToolClick = useCallback((toolId) => {
    // Toggle off if same tool
    if (activeTool === toolId) {
      setActiveTool(null);
      tools.clearToolHandlers();
      setCoordDisplay({ visible: false, lat: 0, lng: 0 });
      return;
    }

    setActiveTool(toolId);
    tools.clearToolHandlers();
    setCoordDisplay({ visible: toolId === "coord", lat: 0, lng: 0 });

    switch (toolId) {
      case "coord":
        tools.startCoordinatePicker();
        break;
      case "distance":
        tools.startDistanceMeasure();
        break;
      case "area":
        tools.startAreaMeasure();
        break;
      case "identify":
        break;
      case "erase":
        tools.eraseAll();
        setActiveTool(null);
        setCoordDisplay({ visible: false, lat: 0, lng: 0 });
        break;
      default:
        break;
    }
  }, [activeTool, tools]);

  const handleSearch = useCallback((filters) => {
    setFilteredSchools(filterSchools(schools,filters));
    setResultsVisible(true);
  }, [schools]);
  const handleClear = useCallback(() => {
    setFilteredSchools([]);
    flyToDefault();
    setResultsVisible(false);
    setTableOpen(false);
  }, [flyToDefault]);

  const handleDeptoSelect = useCallback((depto) => {
    flyToDept(depto);
  }, [flyToDept]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      invalidateSize();
      return next;
    });
  }, [invalidateSize]);

  const exportData = filteredSchools;

  return (
    <div className="app">
      <div className="main">
        <Sidebar
          onImport={()=>setShowImport(true)}
          schools={schools}
          loading={loading}
          onSearch={handleSearch}
          onClear={handleClear}
          onDeptoSelect={handleDeptoSelect}
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
        />
        <div className="map-wrapper">
          <div ref={mapContainerRef} className="map" />
          <MapTools tools={toolButtons} onToolClick={handleToolClick} />
          <ResultsInfo count={filteredSchools.length} visible={resultsVisible} />
          <LoadingOverlay visible={loading} />
          <CoordDisplay {...coordDisplay} />
          {resultsVisible&&<ExportButton data={exportData} onTable={()=>setTableOpen(v=>!v)} />}
          {error&&<div className="api-error" role="alert">{error} <button onClick={loadSchools}>Reintentar</button></div>}
          {activeTool&&<div className="tool-hint" role="status">{activeTool==='identify'?'Seleccione un marcador para consultar su ficha.':activeTool==='coord'?'Haga clic en el mapa para fijar las coordenadas.':'Haga clic para añadir puntos. Doble clic para terminar.'}</div>}
          {tableOpen&&<section className="results-table" aria-label="Resultados de búsqueda"><div className="table-heading"><strong>{filteredSchools.length} servicios educativos</strong><button onClick={()=>setTableOpen(false)} aria-label="Cerrar tabla">×</button></div><div className="table-scroll"><table><thead><tr>{['Código modular','Nombre','Nivel / Modalidad','Centro poblado','Distrito','Provincia','Departamento'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filteredSchools.slice(0,200).map((s,i)=><tr key={i} onClick={()=>mapRef.current?.flyTo([s.lat,s.lng],16)}><td><button onClick={()=>mapRef.current?.flyTo([s.lat,s.lng],16)}>{s.codigoModular}</button></td><td>{s.nombre}</td><td>{s.nivel}</td><td>{s.centroPoblado}</td><td>{s.distrito}</td><td>{s.provincia}</td><td>{s.departamento}</td></tr>)}</tbody></table>{filteredSchools.length===0&&<p className="p-4">No hay servicios con estos criterios.</p>}{filteredSchools.length>200&&<p className="p-3">Vista de los primeros 200 resultados. Exporte CSV o PDF para obtener todos.</p>}</div></section>}
        </div>
      </div>
      {showImport&&<ImportDialog onClose={()=>setShowImport(false)} onImported={loadSchools}/>}
    </div>
  );
}

export default App;
