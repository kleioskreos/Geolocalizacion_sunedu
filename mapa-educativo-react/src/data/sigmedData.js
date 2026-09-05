// Data: 25 departamentos of Peru (from original SIGMED)
export const departamentos = [
  { cod: "01", nombre: "AMAZONAS", lat: -5.07016997, lng: -78.05431301, zoom: 9 },
  { cod: "02", nombre: "ANCASH", lat: -9.40704445, lng: -77.67006572, zoom: 9 },
  { cod: "03", nombre: "APURIMAC", lat: -14.02813576, lng: -72.97537943, zoom: 9 },
  { cod: "04", nombre: "AREQUIPA", lat: -15.8450092, lng: -72.47933253, zoom: 9 },
  { cod: "05", nombre: "AYACUCHO", lat: -14.08858017, lng: -74.08367893, zoom: 9 },
  { cod: "06", nombre: "CAJAMARCA", lat: -6.43154657, lng: -78.74505755, zoom: 9 },
  { cod: "07", nombre: "CALLAO", lat: -11.94082041, lng: -77.12601499, zoom: 9 },
  { cod: "08", nombre: "CUSCO", lat: -13.19150087, lng: -72.16797426, zoom: 9 },
  { cod: "09", nombre: "HUANCAVELICA", lat: -13.02439906, lng: -75.00270873, zoom: 9 },
  { cod: "10", nombre: "HUANUCO", lat: -9.41403051, lng: -76.02594904, zoom: 9 },
  { cod: "11", nombre: "ICA", lat: -14.23394546, lng: -75.57373206, zoom: 9 },
  { cod: "12", nombre: "JUNIN", lat: -11.53830789, lng: -74.88019196, zoom: 9 },
  { cod: "13", nombre: "LA LIBERTAD", lat: -7.92167326, lng: -78.36801675, zoom: 9 },
  { cod: "14", nombre: "LAMBAYEQUE", lat: -6.33611871, lng: -79.83036302, zoom: 9 },
  { cod: "15", nombre: "LIMA", lat: -11.78562646, lng: -76.62720646, zoom: 9 },
  { cod: "16", nombre: "LORETO", lat: -4.11977984, lng: -74.42635796, zoom: 7 },
  { cod: "17", nombre: "MADRE DE DIOS", lat: -11.98085376, lng: -70.53468574, zoom: 9 },
  { cod: "18", nombre: "MOQUEGUA", lat: -16.85981452, lng: -70.83839529, zoom: 9 },
  { cod: "19", nombre: "PASCO", lat: -10.3987541, lng: -75.30201173, zoom: 9 },
  { cod: "20", nombre: "PIURA", lat: -5.12384077, lng: -80.3374041, zoom: 9 },
  { cod: "21", nombre: "PUNO", lat: -14.92913265, lng: -69.95068167, zoom: 9 },
  { cod: "22", nombre: "SAN MARTIN", lat: -7.03408898, lng: -76.71503529, zoom: 9 },
  { cod: "23", nombre: "TACNA", lat: -17.64500273, lng: -70.2775841, zoom: 9 },
  { cod: "24", nombre: "TUMBES", lat: -3.85526527, lng: -80.54453701, zoom: 10 },
  { cod: "25", nombre: "UCAYALI", lat: -9.61991844, lng: -73.43336197, zoom: 8 },
];

// Provincias por departamento (from original SIGMED data)
export const provinciasPorDepto = {
  "01": ["BAGUA", "BONGARA", "CHACHAPOYAS", "CONDORCANQUI", "LUYA", "RODRIGUEZ DE MENDOZA", "UTCUBAMBA"],
  "02": ["AIJA", "ANTONIO RAYMONDI", "ASUNCION", "BOLOGNESI", "CARHUAS", "CARLOS FERMIN FITZCARRALD", "CASMA", "CORONGO", "HUARI", "HUARMEY", "HUAYLAS", "MARISCAL LUZURIAGA", "OCROS", "PALLASCA", "POMABAMBA", "RECUAY", "SANTA", "SIHUAS", "YUNGAY"],
  "03": ["ABANCAY", "ANDAHUAYLAS", "ANTABAMBA", "AYMARAES", "COTABAMBAS", "CHINCHEROS", "GRAU"],
  "04": ["AREQUIPA", "CAMANA", "CARAVELI", "CASTILLA", "CAYLOMA", "CONDESUYOS", "ISLAY", "LA UNION"],
  "05": ["CANGALLO", "HUAMANGA", "HUANCA SANCOS", "HUANTA", "LA MAR", "LUCANAS", "PARINACOCHAS", "PAUCAR DEL SARA SARA", "SUCRE", "VICTOR FAJARDO", "VILCAS HUAMAN"],
  "06": ["CAJABAMBA", "CAJAMARCA", "CELENDIN", "CHOTA", "CONTUMAZA", "CUTERVO", "HUALGAYOC", "JAEN", "SAN IGNACIO", "SAN MARCOS", "SAN MIGUEL", "SAN PABLO", "SANTA CRUZ"],
  "07": ["CALLAO"],
  "08": ["ACOMAYO", "ANTA", "CALCA", "CANAS", "CANCHIS", "CHUMBIVILCAS", "CUSCO", "ESPINAR", "LA CONVENCION", "PARURO", "PAUCARTAMBO", "QUISPICANCHI", "URUBAMBA"],
  "09": ["ACOBAMBA", "ANGARAES", "CASTROVIRREYNA", "CHURCAMPA", "HUANCAVELICA", "HUAYTARA", "TAYACAJA"],
  "10": ["AMBO", "HUANUCO", "LA UNION", "MARAÑON", "PACHITEA", "PUERTO INCA", "HUACAYBAMBA", "DOS DE MAYO", "YAROWILCA", "LEONCIO PRADO"],
  "11": ["ICA", "CHINCHA", "NASCA", "PALPA", "PISCO"],
  "12": ["CHANCHAMAYO", "CHUPACA", "CONCEPCION", "HUANCAYO", "JAUJA", "JUNIN", "SATIPO", "TARMA", "YALI", "CHILCA"],
  "13": ["GRAN CHIMU", "JULCAN", "OTUZCO", "PACASMAYO", "PATAZ", "SANCHEZ CARRION", "SANTIAGO DE CHUCO", "ASCOPES", "VIRU", "TRUJILLO", "BOLIVAR", "PALLASCA"],
  "14": ["CHICLAYO", "FERREÑAFE", "LAMBAYEQUE"],
  "15": ["BARRANCA", "CAJATAMBO", "CANTA", "HUARAL", "HUAROCHIRI", "HUAURA", "LIMA", "OYON", "YAUYOS"],
  "16": ["MAYNAS", "ALTO AMAZONAS", "LORETO", "MARISCAL RAMON CASTILLA", "REQUENA", "UCAYALI", "DATEM DEL MARAÑON"],
  "17": ["TAMBOPATA", "MANU", "TAHUAMANU"],
  "18": ["MARISCAL NIETO", "GENERAL SANCHEZ CERRO", "ILO"],
  "19": ["PASCO", "DANIEL ALCIDES CARRION", "OXAPAMPA"],
  "20": ["PIURA", "AYABACA", "HUANCABAMBA", "MORROPON", "PAITA", "SULLANA", "TALARA", "SECHURA"],
  "21": ["PUNO", "AZANGARO", "CARABAYA", "CHUCUITO", "EL COLLAO", "HUANCANE", "LAMPA", "MELGAR", "MOHO", "SAN ANTONIO DE PUTINA", "SANDIA", "SAN ROMAN", "YUNGUYO"],
  "22": ["MOYOBAMBA", "BELLAVISTA", "HUALLAGA", "MARISCAL CACERES", "PICOTA", "RIOJA", "SAN MARTIN", "TOCACHE", "LAMAS", "EL DORADO", "SAN PABLO"],
  "23": ["TACNA", "CANDARAVE", "JORGE BASADRE", "TARATA"],
  "24": ["TUMBES", "CONTRALMIRANTE VILLAR", "SARUMILLA", "ZARUMILLA"],
  "25": ["CORONEL PORTILLO", "ATALAYA", "PADRE ABAD", "PURUS", "AGUAYTIA"],
};

// Niveles educativos reales del padron MINEDU (from listado_iiee.xls)
export const niveles = [
  { nombre: "Inicial - Jardin", color: "#2196F3" },
  { nombre: "Inicial No Escolarizado", color: "#00BCD4" },
  { nombre: "Inicial - Cuna", color: "#00ACC1" },
  { nombre: "Inicial - Cuna Jardin", color: "#26C6DA" },
  { nombre: "Primaria", color: "#4CAF50" },
  { nombre: "Secundaria", color: "#FF9800" },
  { nombre: "Basica Alternativa - Inicial e Intermedio", color: "#8BC34A" },
  { nombre: "Basica Alternativa - Avanzado", color: "#689F38" },
  { nombre: "Basica Especial - Inicial", color: "#7E57C2" },
  { nombre: "Basica Especial - Primaria", color: "#5E35B1" },
  { nombre: "Basica Especial - PRITE", color: "#9575CD" },
  { nombre: "Superior Pedagogica", color: "#9C27B0" },
  { nombre: "Escuela Superior Pedagogica", color: "#BA68C8" },
  { nombre: "Superior Tecnologica", color: "#E91E63" },
  { nombre: "Superior Formacion Artistica", color: "#F06292" },
  { nombre: "Tecnico Productiva - CETPRO", color: "#795548" },
  { nombre: "Instancia de Apoyo", color: "#607D8B" },
];

// Gestion / Dependencia options (from real data)
export const gestiones = [
  "Publica - Sector Educacion",
  "Publica - Otro sector (FF.AA.)",
  "Publica - Municipalidad",
  "Publica - Entidad en convenio",
  "Privada - Particular",
  "Privada - Cooperativo",
  "Privada - Comunidad religiosa",
  "Privada - Empresa",
  "Privada - Asociacion civil",
];

export function getColorForNivel(nivel) {
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const n = niveles.find((x) => norm(x.nombre) === norm(nivel));
  return n ? n.color : "#607D8B";
}
