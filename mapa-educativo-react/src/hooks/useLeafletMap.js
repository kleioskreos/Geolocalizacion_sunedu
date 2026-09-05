import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { getColorForNivel } from "../data/sigmedData";

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createIcon(color) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="width:18px;height:18px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

function createPopupContent(s) {
  s = Object.fromEntries(Object.entries(s).map(([key,value])=>[key,typeof value==='string'?value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])):value]));
  return `
    <div class="school-popup">
      <h4>${s.nombre}</h4>
      <table>
        <tr><td>Codigo Institucion:</td><td>${s.codigoInstitucion || "-"}</td></tr>
        <tr><td>Codigo Modular:</td><td>${s.codigoModular || "-"}</td></tr>
        <tr><td>Nivel / Modalidad:</td><td>${s.nivel}</td></tr>
        <tr><td>Gestion / Dependencia:</td><td>${s.gestion}</td></tr>
        <tr><td>Departamento:</td><td>${s.departamento}</td></tr>
        <tr><td>Provincia:</td><td>${s.provincia}</td></tr>
        <tr><td>Distrito:</td><td>${s.distrito}</td></tr>
        <tr><td>DRE / UGEL:</td><td>${s.dreUgel || "-"}</td></tr>
        <tr><td>Centro Poblado:</td><td>${s.centroPoblado || "-"}</td></tr>
        <tr><td>Codigo Local:</td><td>${s.codigoLocal || "-"}</td></tr>
        <tr><td>Direccion:</td><td>${s.direccion || "-"}</td></tr>
        <tr><td>Altitud:</td><td>${s.altitud || "-"} msnm</td></tr>
        <tr><td>Latitud:</td><td>${s.lat.toFixed(6)}</td></tr>
        <tr><td>Longitud:</td><td>${s.lng.toFixed(6)}</td></tr>
        <tr><td>Fuente Coordenadas:</td><td>${s.fuenteCoordenadas || "-"}</td></tr>
      </table>
    </div>`;
}

export function useLeafletMap(mapContainerRef, { schools, onMapReady }) {
  const mapRef = useRef(null);
  const markerGroupRef = useRef(null);
  const baseLayersRef = useRef({});
  const drawnItemsRef = useRef(null);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-9.2, -75.0],
      zoom: 6,
      // En varias zonas del padrón el satélite de Esri deja de publicar
      // mosaicos al pasar este nivel y muestra "Map data not yet available".
      // Se limita el mapa para conservar siempre un fondo utilizable.
      maxZoom: 17,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;

    // Base layers
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 17,
    });
    const esriSatLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
      maxZoom: 17,
    });
    const esriStreetsLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
      maxZoom: 17,
    });

    baseLayersRef.current = {
      "Calles (OpenStreetMap)": osmLayer,
      "Imagen Satelital (ESRI)": esriSatLayer,
      "Calles (ESRI)": esriStreetsLayer,
    };

    esriSatLayer.addTo(map);

    // Layer control
    L.control.layers(baseLayersRef.current, null, { position: "topright", collapsed: true }).addTo(map);

    // Zoom control
    L.control.zoom({ position: "topright" }).addTo(map);

    // Scale bar
    L.control.scale({ position: "bottomleft", imperial: false, metric: true }).addTo(map);

    // Attribution
    map.attributionControl.setPrefix('Leaflet');

    // Marker cluster group
    const markerGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
    });
    map.addLayer(markerGroup);
    markerGroupRef.current = markerGroup;

    // Drawn items (for measurement tools)
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    if (onMapReady) onMapReady(map);

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
      markerGroupRef.current = null;
      drawnItemsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when schools change
  useEffect(() => {
    if (!markerGroupRef.current) return;
    markerGroupRef.current.clearLayers();

    const markers = schools.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).map((s) => {
      const marker = L.marker([s.lat, s.lng], { icon: createIcon(getColorForNivel(s.nivel)) });
      marker.bindPopup(createPopupContent(s));
      return marker;
    });
    markerGroupRef.current.addLayers(markers);

    // Fit bounds if few enough results
    if (schools.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(schools.map((s) => [s.lat, s.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [schools]);

  // Expose map methods
  const flyToDept = useCallback((depto) => {
    if (mapRef.current) {
      mapRef.current.flyTo([depto.lat, depto.lng], depto.zoom || 9, { duration: 1.5 });
    }
  }, []);

  const flyToDefault = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo([-9.2, -75], 6, { duration: 1.5 });
    }
  }, []);

  const invalidateSize = useCallback(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 250);
    }
  }, []);

  return { mapRef, markerGroupRef, drawnItemsRef, flyToDept, flyToDefault, invalidateSize };
}
