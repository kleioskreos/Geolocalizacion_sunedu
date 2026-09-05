import test from 'node:test';
import assert from 'node:assert/strict';
import {mapBounds,schoolsWithCoordinates,splitMapPages} from './pdfMap.js';

const schools = [
  {nombre:'Uno',lat:-14.1,lng:-70.2},
  {nombre:'Dos',lat:'-14.2',lng:'-70.1'},
  {nombre:'Sin coordenadas',lat:'texto',lng:null},
];

test('solo conserva instituciones con coordenadas válidas',()=>{
  assert.equal(schoolsWithCoordinates(schools).length,2);
});

test('divide los puntos para que cada plano tenga una leyenda legible',()=>{
  assert.deepEqual(splitMapPages(schoolsWithCoordinates(schools),1).map(page=>page.length),[1,1]);
});

test('incluye un margen aunque las coordenadas sean iguales',()=>{
  const bounds=mapBounds([{lat:-14,lng:-70},{lat:-14,lng:-70}]);
  assert.ok(bounds.maxLat>bounds.minLat);
  assert.ok(bounds.maxLng>bounds.minLng);
});
