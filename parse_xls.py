import html
from html.parser import HTMLParser
import json
import re

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.is_header = False
        self.current_cell = ''
        self.current_row = []
        self.rows = []
        self.headers = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.in_table = True
        elif tag == 'tr' and self.in_table:
            self.in_row = True
            self.current_row = []
        elif tag in ('td', 'th') and self.in_row:
            self.in_cell = True
            self.is_header = (tag == 'th')
            self.current_cell = ''

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.in_cell:
            val = html.unescape(self.current_cell.strip())
            if val == '\xa0' or val == '&nbsp;':
                val = ''
            self.current_row.append(val)
            self.in_cell = False
        elif tag == 'tr' and self.in_row:
            if self.current_row:
                # First row with th elements = headers
                if not self.headers:
                    self.headers = self.current_row
                else:
                    self.rows.append(self.current_row)
            self.in_row = False
        elif tag == 'table':
            self.in_table = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell += data

# Read file
with open(r'C:/Users/drago/Downloads/listado_iiee.xls', 'r', encoding='utf-8') as f:
    content = f.read()

parser = TableParser()
parser.feed(content)

print(f'Headers ({len(parser.headers)}): {parser.headers}')
print(f'Total data rows: {len(parser.rows)}')

if parser.rows:
    print(f'First row: {parser.rows[0]}')
    print()

    # Map headers to indices
    h = {name: i for i, name in enumerate(parser.headers)}
    print(f'Header indices:')
    for name, idx in h.items():
        print(f'  {name}: {idx}')

    # Convert to JSON for the React app
    schools = []
    for row in parser.rows:
        if len(row) < len(parser.headers):
            continue
        try:
            lat_str = row[h['Latitud']].strip()
            lng_str = row[h['Longitud']].strip()
            lat = float(lat_str) if lat_str else 0
            lng = float(lng_str) if lng_str else 0
            if lat == 0 and lng == 0:
                continue

            school = {
                'codigoInstitucion': row[h['Código Institución']],
                'codigoModular': row[h['Código Modular']],
                'nombre': row[h['Nombre de SS.EE.']],
                'ubigeo': row[h['Ubigeo']],
                'departamento': row[h['Departamento']],
                'provincia': row[h['Provincia']],
                'distrito': row[h['Distrito']],
                'codigoDreUgel': row[h['Código DRE/UGEL']],
                'dreUgel': row[h['DRE / UGEL']],
                'centroPoblado': row[h['Centro Poblado']],
                'codigoLocal': row[h['Código Local']],
                'direccion': row[h['Dirección']],
                'nivel': row[h['Nivel / Modalidad']],
                'gestion': row[h['Gestion / Dependencia']],
                'lat': lat,
                'lng': lng,
                'altitud': row[h['Altitud']],
                'fuenteCoordenadas': row[h['Fuente de coordenadas']],
            }
            schools.append(school)
        except (ValueError, KeyError) as e:
            continue

    print(f'\nSchools with valid coordinates: {len(schools)}')

    # Stats by departamento
    deptos = {}
    for s in schools:
        d = s['departamento']
        deptos[d] = deptos.get(d, 0) + 1
    print(f'\nSchools by department:')
    for d, c in sorted(deptos.items(), key=lambda x: -x[1]):
        print(f'  {d}: {c}')

    # Stats by nivel
    niveles_stats = {}
    for s in schools:
        n = s['nivel']
        niveles_stats[n] = niveles_stats.get(n, 0) + 1
    print(f'\nSchools by nivel:')
    for n, c in sorted(niveles_stats.items(), key=lambda x: -x[1]):
        print(f'  {n}: {c}')

    # Write JSON
    output_path = r'C:/Users/drago/WorkBuddy AI/2026-09-05-02-18-01/mapa-educativo-react/src/data/escuelas.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schools, f, ensure_ascii=False)
    print(f'\nJSON written to: {output_path}')
    print(f'File size: {len(json.dumps(schools, ensure_ascii=False))} bytes')
