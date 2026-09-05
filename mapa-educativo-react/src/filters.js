import { departamentos } from './data/sigmedData.js';
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
export function filterSchools(schools, filters) {
 const department=departamentos.find(d=>d.cod===filters.depto)?.nombre;
 const dre=departamentos.find(d=>d.cod===filters.dre)?.nombre;
 return schools.filter(s=>{
  if(filters.searchText&&!normalize([s.nombre,s.codigoInstitucion,s.codigoModular,s.codigoLocal].join(' ')).includes(normalize(filters.searchText)))return false;
  if(department&&normalize(s.departamento)!==normalize(department))return false;
  if(filters.prov&&s.provincia!==filters.prov)return false;
  if(filters.dist&&s.distrito!==filters.dist)return false;
  if(dre&&normalize(s.departamento)!==normalize(dre))return false;
  if(filters.ugel&&s.dreUgel!==filters.ugel)return false;
  if(filters.cpp&&!normalize(s.centroPoblado).includes(normalize(filters.cpp)))return false;
  if(filters.gestion&&s.gestion!==filters.gestion)return false;
  return !filters.selectedNiveles.length||filters.selectedNiveles.includes(s.nivel);
 }).sort(compareTerritory);
}

const territoryCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
export function compareTerritory(a,b) {
 for (const key of ['centroPoblado','distrito','provincia','departamento','nombre','codigoModular']) {
  const comparison=territoryCollator.compare(a[key] || '', b[key] || '');
  if(comparison) return comparison;
 }
 return 0;
}
