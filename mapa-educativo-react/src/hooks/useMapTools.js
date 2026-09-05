import { useRef, useCallback } from "react";
import L from "leaflet";

export function useMapTools(mapRef, drawnItemsRef) {
  const coordMarkerRef = useRef(null);
  const measurePointsRef = useRef([]);
  const measureLineRef = useRef(null);
  const measureMarkersRef = useRef([]);
  const clickHandlerRef = useRef(null);
  const dblClickHandlerRef = useRef(null);

  const clearToolHandlers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
    if (dblClickHandlerRef.current) {
      map.off("dblclick", dblClickHandlerRef.current);
      dblClickHandlerRef.current = null;
    }
    map.doubleClickZoom.enable();
  }, [mapRef]);

  const startCoordinatePicker = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    clearToolHandlers();

    const handler = (e) => {
      if (coordMarkerRef.current) map.removeLayer(coordMarkerRef.current);
      coordMarkerRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "coord-marker-icon",
          html: '<div style="font-size:18px;">📍</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map);
      coordMarkerRef.current.bindPopup(
        `<div style="font-family:Consolas,monospace;font-size:13px;"><b>Coordenadas:</b><br>Lat: ${e.latlng.lat.toFixed(6)}<br>Lng: ${e.latlng.lng.toFixed(6)}</div>`
      ).openPopup();
    };
    clickHandlerRef.current = handler;
    map.on("click", handler);
  }, [mapRef, clearToolHandlers]);

  const startDistanceMeasure = useCallback(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;

    clearToolHandlers();
    measurePointsRef.current = [];
    measureMarkersRef.current = [];

    const clickHandler = (e) => {
      measurePointsRef.current.push(e.latlng);

      const m = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "measure-point",
          html: '<div style="width:8px;height:8px;background:#11698e;border:2px solid #fff;border-radius:50%;"></div>',
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        }),
      }).addTo(drawnItems);
      measureMarkersRef.current.push(m);

      if (measurePointsRef.current.length >= 2) {
        if (measureLineRef.current) drawnItems.removeLayer(measureLineRef.current);
        measureLineRef.current = L.polyline(measurePointsRef.current, {
          color: "#11698e",
          weight: 3,
          dashArray: "5,8",
        }).addTo(drawnItems);

        let total = 0;
        for (let i = 1; i < measurePointsRef.current.length; i++) {
          total += map.distance(measurePointsRef.current[i - 1], measurePointsRef.current[i]);
        }
        m.bindPopup(`<b>Distancia total:</b><br>${total > 1000 ? (total / 1000).toFixed(2) + " km" : total.toFixed(1) + " m"}`).openPopup();
      }
    };

    const dblClickHandler = () => {
      clearToolHandlers();
    };

    clickHandlerRef.current = clickHandler;
    dblClickHandlerRef.current = dblClickHandler;
    map.doubleClickZoom.disable();
    map.on("click", clickHandler);
    map.on("dblclick", dblClickHandler);
  }, [mapRef, drawnItemsRef, clearToolHandlers]);

  const startAreaMeasure = useCallback(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;

    clearToolHandlers();
    let polyPoints = [];
    let polyLine = null;
    let polyMarkers = [];

    const clickHandler = (e) => {
      polyPoints.push(e.latlng);

      const m = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "measure-point",
          html: '<div style="width:8px;height:8px;background:#e91e63;border:2px solid #fff;border-radius:50%;"></div>',
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        }),
      }).addTo(drawnItems);
      polyMarkers.push(m);

      if (polyPoints.length >= 2) {
        if (polyLine) drawnItems.removeLayer(polyLine);
        polyLine = L.polygon(polyPoints, {
          color: "#e91e63",
          weight: 2,
          fillColor: "#e91e63",
          fillOpacity: 0.15,
        }).addTo(drawnItems);
      }
    };

    const dblClickHandler = () => {
      clearToolHandlers();
      if (polyPoints.length >= 3 && polyLine) {
        // Shoelace formula
        let a = 0;
        const p = polyPoints;
        for (let i = 0; i < p.length; i++) {
          const j = (i + 1) % p.length;
          a += p[i].lng * p[j].lat - p[j].lng * p[i].lat;
        }
        a = Math.abs(a) / 2;
        const areaM2 = a * 111320 * 111320 * Math.cos(polyPoints[0].lat * Math.PI / 180);
        const lastMarker = polyMarkers[polyMarkers.length - 1];
        lastMarker.bindPopup(`<b>Área aproximada:</b><br>${areaM2 > 1000000 ? (areaM2 / 1000000).toFixed(2) + " km²" : areaM2.toFixed(0) + " m²"}`).openPopup();
      }
    };

    clickHandlerRef.current = clickHandler;
    dblClickHandlerRef.current = dblClickHandler;
    map.doubleClickZoom.disable();
    map.on("click", clickHandler);
    map.on("dblclick", dblClickHandler);
  }, [mapRef, drawnItemsRef, clearToolHandlers]);

  const eraseAll = useCallback(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;
    drawnItems.clearLayers();
    if (coordMarkerRef.current) {
      map.removeLayer(coordMarkerRef.current);
      coordMarkerRef.current = null;
    }
    measurePointsRef.current = [];
    measureLineRef.current = null;
    measureMarkersRef.current = [];
    clearToolHandlers();
  }, [mapRef, drawnItemsRef, clearToolHandlers]);

  return {
    startCoordinatePicker,
    startDistanceMeasure,
    startAreaMeasure,
    eraseAll,
    clearToolHandlers,
  };
}
