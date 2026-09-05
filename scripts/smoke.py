"""Integration checks against the local Docker stack; no third-party dependencies.
Reimports an existing record unchanged and verifies rollback of an invalid workbook.
"""
import base64
import io
import json
from pathlib import Path
import urllib.error
import urllib.request
import xml.sax.saxutils as xml
import zipfile

ROOT = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
BASE = 'http://127.0.0.1:' + env.get('WEB_PORT', '8090')

def request(path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, data=body, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def workbook(records):
    columns = list(records[0])
    rows = [columns] + [[record.get(key, '') for key in columns] for record in records]
    cells = []
    for index, row in enumerate(rows, 1):
        content = ''.join('<c t="inlineStr"><is><t>' + xml.escape(str(value)) + '</t></is></c>' for value in row)
        cells.append('<row r="%d">%s</row>' % (index, content))
    sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(cells) + '</sheetData></worksheet>'
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        z.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Servicios" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', sheet)
    return stream.getvalue()

def upload(records, authorized=True, password=None):
    boundary = 'GeolocalizacionSmokeBoundary'
    body = ('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="smoke.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n').encode() + workbook(records) + ('\r\n--' + boundary + '--\r\n').encode()
    headers = {'Content-Type': 'multipart/form-data; boundary=' + boundary}
    if authorized:
        credentials = ':' + (env['ADMIN_PASSWORD'] if password is None else password)
        headers['Authorization'] = 'Basic ' + base64.b64encode(credentials.encode()).decode()
    return request('/api/import', body, headers)

assert request('/')[0] == 200, 'Frontend unavailable'
assert json.loads(request('/api/health')[1])['status'] == 'ok'
status, body = request('/api/schools')
assert status == 200
before = json.loads(body)
assert before['total'] > 0
record = before['schools'][0]
assert upload([record], authorized=False)[0] == 401, 'Importer requires authentication'
assert upload([record], password='incorrect-password')[0] == 401, 'Incorrect password must be rejected'
status, body = request('/api/import/template')
assert status == 200 and zipfile.is_zipfile(io.BytesIO(body)), 'Template must be XLSX'
status, body = upload([record])
assert status == 200, body
assert json.loads(body)['imported'] == 1
changed = dict(record, nombre='ROLLBACK CHECK')
invalid = dict(record, codigoModular='SMOKE-INVALID', lat=999)
status, body = upload([changed, invalid])
assert status == 400, body
after = json.loads(request('/api/schools')[1])
assert before == after, 'Invalid import must roll back and valid reimport must not duplicate'
print('PASS: frontend, health, %d records, authentication, XLSX template, import, idempotency, transaction rollback.' % before['total'])
