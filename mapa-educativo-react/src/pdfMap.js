const PAGE_SIZE = 32;

const truncate = (value, length) => {
  const text = String(value || "Sin nombre").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const coordinate = (value) => Number(value);

export function schoolsWithCoordinates(schools) {
  return schools.filter((school) => Number.isFinite(coordinate(school.lat)) && Number.isFinite(coordinate(school.lng)));
}

export function splitMapPages(schools, pageSize = PAGE_SIZE) {
  const points = schoolsWithCoordinates(schools);
  return Array.from({ length: Math.ceil(points.length / pageSize) }, (_, page) => points.slice(page * pageSize, (page + 1) * pageSize));
}

export function mapBounds(schools, aspectRatio = 1.62) {
  const points = schoolsWithCoordinates(schools);
  if (!points.length) return null;

  let minLat = Math.min(...points.map((school) => coordinate(school.lat)));
  let maxLat = Math.max(...points.map((school) => coordinate(school.lat)));
  let minLng = Math.min(...points.map((school) => coordinate(school.lng)));
  let maxLng = Math.max(...points.map((school) => coordinate(school.lng)));
  const midLat = (minLat + maxLat) / 2;
  const minSpan = 0.02;

  if (maxLat - minLat < minSpan) {
    minLat -= minSpan / 2;
    maxLat += minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    minLng -= minSpan / 2;
    maxLng += minSpan / 2;
  }

  let latSpan = maxLat - minLat;
  let lngSpan = (maxLng - minLng) * Math.cos((midLat * Math.PI) / 180);
  if (lngSpan / latSpan < aspectRatio) {
    const extra = (latSpan * aspectRatio - lngSpan) / Math.cos((midLat * Math.PI) / 180) / 2;
    minLng -= extra;
    maxLng += extra;
  } else {
    const extra = (lngSpan / aspectRatio - latSpan) / 2;
    minLat -= extra;
    maxLat += extra;
  }

  const padding = 0.08;
  const latPadding = (maxLat - minLat) * padding;
  const lngPadding = (maxLng - minLng) * padding;
  return { minLat: minLat - latPadding, maxLat: maxLat + latPadding, minLng: minLng - lngPadding, maxLng: maxLng + lngPadding };
}

function project(school, bounds, area) {
  const lng = coordinate(school.lng);
  const lat = coordinate(school.lat);
  return {
    x: area.x + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * area.width,
    y: area.y + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * area.height,
  };
}

function drawScale(ctx, bounds, area) {
  const latitude = (bounds.minLat + bounds.maxLat) / 2;
  const widthKm = (bounds.maxLng - bounds.minLng) * 111.32 * Math.cos((latitude * Math.PI) / 180);
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const kilometres = candidates.find((value) => value >= widthKm / 5) || candidates.at(-1);
  const barWidth = (kilometres / widthKm) * area.width;
  const x = area.x + 22;
  const y = area.y + area.height - 28;
  ctx.strokeStyle = "#173d5e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barWidth, y);
  ctx.stroke();
  ctx.fillStyle = "#173d5e";
  ctx.font = "600 18px Arial";
  ctx.fillText(`${kilometres} km`, x, y - 10);
}

export function renderOfflineMapPage(allSchools, pageSchools, pageNumber, totalPages) {
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const bounds = mapBounds(allSchools, 1.53);
  const area = { x: 70, y: 165, width: 1230, height: 805 };
  const indexes = new Map(allSchools.map((school, index) => [school, index + 1]));

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#163f63";
  ctx.fillRect(0, 0, canvas.width, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 38px Georgia";
  ctx.fillText("Mapa de ubicación de servicios educativos", 70, 57);
  ctx.font = "400 22px Arial";
  ctx.fillText(`Plano sin conexión · página ${pageNumber} de ${totalPages} · ${allSchools.length.toLocaleString("es-PE")} instituciones`, 70, 94);

  ctx.fillStyle = "#dbeaf0";
  ctx.fillRect(area.x, area.y, area.width, area.height);
  ctx.strokeStyle = "#9cb8c8";
  ctx.lineWidth = 2;
  ctx.strokeRect(area.x, area.y, area.width, area.height);
  ctx.strokeStyle = "#b9cdd8";
  ctx.lineWidth = 1;
  for (let step = 1; step < 6; step += 1) {
    const x = area.x + (area.width * step) / 6;
    const y = area.y + (area.height * step) / 6;
    ctx.beginPath();
    ctx.moveTo(x, area.y);
    ctx.lineTo(x, area.y + area.height);
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#58798c";
  ctx.font = "400 16px Arial";
  for (let step = 0; step <= 6; step += 1) {
    const longitude = bounds.minLng + ((bounds.maxLng - bounds.minLng) * step) / 6;
    const latitude = bounds.maxLat - ((bounds.maxLat - bounds.minLat) * step) / 6;
    ctx.fillText(`${longitude.toFixed(3)}°`, area.x + (area.width * step) / 6 - 25, area.y - 12);
    ctx.fillText(`${latitude.toFixed(3)}°`, area.x + area.width + 10, area.y + (area.height * step) / 6 + 5);
  }

  for (const school of allSchools) {
    const point = project(school, bounds, area);
    ctx.fillStyle = "#7896a5";
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const school of pageSchools) {
    const point = project(school, bounds, area);
    const index = indexes.get(school);
    ctx.fillStyle = "#c8262d";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(index, point.x, point.y + 4);
    ctx.textAlign = "left";
  }

  drawScale(ctx, bounds, area);
  ctx.fillStyle = "#163f63";
  ctx.font = "700 26px Arial";
  ctx.fillText("N", area.x + area.width - 38, area.y + 40);
  ctx.beginPath();
  ctx.moveTo(area.x + area.width - 26, area.y + 48);
  ctx.lineTo(area.x + area.width - 38, area.y + 82);
  ctx.lineTo(area.x + area.width - 50, area.y + 48);
  ctx.closePath();
  ctx.fill();

  const legendX = 1350;
  ctx.fillStyle = "#163f63";
  ctx.font = "700 27px Georgia";
  ctx.fillText("Puntos de esta página", legendX, 174);
  ctx.font = "400 17px Arial";
  ctx.fillStyle = "#4b6273";
  ctx.fillText("Busque el nombre en el PDF y use", legendX, 208);
  ctx.fillText("su número para ubicar el marcador.", legendX, 230);
  const rowsPerColumn = Math.ceil(pageSchools.length / 2);
  for (const [position, school] of pageSchools.entries()) {
    const column = Math.floor(position / rowsPerColumn);
    const row = position % rowsPerColumn;
    const x = legendX + column * 215;
    const y = 270 + row * 43;
    const index = indexes.get(school);
    ctx.fillStyle = "#c8262d";
    ctx.beginPath();
    ctx.arc(x + 10, y - 6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(index, x + 10, y - 3);
    ctx.textAlign = "left";
    ctx.fillStyle = "#172f44";
    ctx.font = "600 14px Arial";
    ctx.fillText(truncate(school.nombre, 25), x + 27, y);
    ctx.fillStyle = "#58798c";
    ctx.font = "400 12px Arial";
    ctx.fillText(`${school.codigoModular || "Sin código"} · ${truncate(school.distrito, 12) || "Sin distrito"}`, x + 27, y + 17);
  }

  ctx.fillStyle = "#4b6273";
  ctx.font = "400 15px Arial";
  ctx.fillText("Rojo: instituciones de esta página", 70, 1022);
  ctx.fillText("Gris: resto de resultados del reporte", 470, 1022);
  ctx.fillText("Coordenadas WGS84 · Elaborado desde el padrón local", 70, 1050);
  return canvas.toDataURL("image/png");
}
