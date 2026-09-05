# Mapa de Escuelas — Geolocalización

Aplicación local inspirada en [Mapa Educativo SIGMED](https://sigmed.minedu.gob.pe/mapaeducativo/). Conserva el padrón incluido en el proyecto y lo almacena en PostgreSQL. No se conecta automáticamente al padrón nacional.

## Iniciar con Docker

Requisito: Docker Desktop con contenedores Linux y Docker Compose.

Desde la raíz del proyecto, en PowerShell:

```powershell
./scripts/setup.ps1
docker compose up -d --build
```

Abra [http://localhost:8090](http://localhost:8090). El script genera contraseñas aleatorias en `.env` y conserva cualquier configuración existente. Para importar, consulte `ADMIN_PASSWORD` en ese archivo. Las contraseñas se almacenan con bcrypt en PostgreSQL; la contraseña configurada se aplica al iniciar la API, también sobre una base existente.

En Linux/macOS, copie `.env.example` a `.env`, asigne contraseñas aleatorias distintas (use valores hexadecimales para `POSTGRES_PASSWORD`) y ejecute `docker compose up -d --build`.

Solo se publica el puerto web en la interfaz local `127.0.0.1`. PostgreSQL y la API se comunican dentro de la red del proyecto. No hay nombres globales de contenedores ni puertos de base de datos que interfieran con otros proyectos. Cambie `WEB_PORT` si 8090 está ocupado. Para una segunda instancia independiente, use otro puerto y `docker compose -p otro-mapa up -d --build`.

```powershell
docker compose ps                  # Estado
docker compose logs --tail=100 api # Diagnóstico
docker compose stop               # Detener para trabajar en otro proyecto
docker compose start              # Reanudar
docker compose down               # Quitar contenedores, conservando el volumen
```

El volumen `postgres_data` conserva las importaciones. No use `down -v` si desea mantener los datos. Copiar únicamente el repositorio a otro equipo conserva el padrón inicial, pero no las importaciones posteriores: estas requieren un respaldo de PostgreSQL.

## Stack

### Puertos y dominios exclusivos del mapa

No utilizar los puertos del proyecto de trámites: `4001`, `5173`, `5432` ni `80` como puertos de los servicios de este stack. El proxy HTTPS externo puede gestionar los puertos públicos habituales de forma independiente.

| Servicio | Puerto del mapa |
| --- | --- |
| Web Nginx, interno y local | 8090 |
| Backend Go, interno | 8091 |
| PostgreSQL, interno y sin publicación al host | 5544 |
| Vite desarrollo | 5190 |
| Vite preview | 5191 |

Dominios de producción: `https://mapa.vmbperu.com` y `https://mapabackend.vmbperu.com`. No se utilizan dominios, credenciales ni identificadores del sistema de trámites.

Para producción, copie `.env.prod.example` a `.env.prod` y complete contraseñas propias del mapa:

```powershell
docker compose --env-file .env.prod -f compose.prod.yaml up -d --build
```

Este comando crea el stack independiente `mapa-prod`, con su propio volumen. En Dokploy o el proxy inverso, configure `mapa.vmbperu.com` hacia el servicio `web`, puerto **8090**, y `mapabackend.vmbperu.com` hacia `api`, puerto **8091**. Configure DNS y certificados HTTPS para ambos dominios. Si el proxy corre en otro contenedor, debe tener acceso a la red del stack; no utilice su propio localhost como destino. No se modifican las redes ni las rutas del otro proyecto.

El frontend de producción se compila con `https://mapabackend.vmbperu.com/api`; el backend permite CORS únicamente desde `https://mapa.vmbperu.com`. En desarrollo local se mantiene `/api` a través de Nginx. Los dominios quedan preparados en los archivos, pero DNS, certificados y despliegue en el servidor no se configuran automáticamente.

### Dependencias

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, axios |
| Mapa | Leaflet, agrupación de marcadores, fondos Esri y OpenStreetMap |
| Exportación | CSV, jsPDF + jspdf-autotable |
| Backend | Go 1.25, Fiber v3, pgx, bcrypt, excelize |
| Persistencia | PostgreSQL 16; registros JSONB e índice por departamento |
| Contenedores | Compilaciones multietapa, Nginx, comprobaciones de salud |

## Comparación con la referencia

| Elemento | Implementación local |
| --- | --- |
| Cabecera | Eliminada por solicitud del usuario; el mapa ocupa toda la altura |
| Navegación | Sin franja superior; importación XLSX en el panel lateral |
| Panel de búsqueda | Azul marino VMB, campos celestes y secciones plegables; tipografías locales Inter y Playfair Display |
| Vista inicial | Perú sobre imágenes satelitales, sin resultados hasta buscar |
| Filtros | Nombre/códigos, departamento, provincia, distrito, DRE por departamento, UGEL, centro poblado, nivel y gestión |
| Catálogos | Provincias, distritos, UGEL, niveles y gestión se obtienen de los registros cargados; no se inventan distritos |
| Consulta | Marcadores agrupados, ficha y tabla de resultados; selección de una fila centra el mapa |
| Herramientas | Coordenadas, distancia, área aproximada, consulta y borrado |
| Exportación | CSV/PDF del resultado filtrado; se deshabilita si no hay resultados |
| Datos | Padrón local de Puno; puede ampliarse con XLSX |
| Centros poblados | Filtro por los datos del padrón local; sin enlace en la cabecera |
| Capas oficiales | No se incluyen límites censales ni la capa nacional de centros poblados de SIGMED |
| Actualización | Importación local explícita; no se muestra como propia la fecha del portal oficial |

Los logotipos en `public/reference` proceden de los recursos visibles del sitio de referencia. Su uso aquí identifica la adaptación visual; esta aplicación no es una publicación oficial de MINEDU. Los fondos cartográficos requieren Internet y conservan sus atribuciones.

## Importar XLSX

1. Abra **Importar XLSX** y descargue la plantilla.
2. Complete la primera hoja. `codigoModular`, `nombre`, `nivel`, `lat` y `lng` son obligatorios. Para disponer de filtros territoriales complete también departamento, provincia, distrito, UBIGEO y UGEL.
3. Mantenga los identificadores como texto, incluyendo sus ceros iniciales. Las coordenadas deben ser grados decimales WGS84.
4. Ingrese únicamente la contraseña de importación (`ADMIN_PASSWORD` en `.env`) y seleccione el archivo.

Se admiten los encabezados de la plantilla y los equivalentes del padrón original, como `Código Modular`, `Nombre de SS.EE.`, `Nivel / Modalidad` y `Latitud`. Se preservan acentos y códigos. Los archivos `.xls` antiguos o HTML con extensión `.xls` deben convertirse a `.xlsx` antes de importar.

Límites: 20 MB comprimidos, 100 MB descomprimidos y 100 000 filas. Una fila inválida o un duplicado dentro del archivo rechaza la operación completa. La combinación código modular + nivel + código local identifica un servicio: reimportarla actualiza ese servicio sin duplicarlo. Los registros ausentes del XLSX no se eliminan. La importación recarga el padrón y limpia los resultados; vuelva a pulsar Buscar.

La semilla `mapa-educativo-react/src/data/escuelas.json` se carga únicamente cuando la tabla está vacía. El frontend obtiene el padrón de la API y aplica los filtros en memoria; para padrones nacionales grandes conviene introducir paginación y búsqueda por extensión de mapa en el servidor.

## Desarrollo y verificación

Puede mantener la API y PostgreSQL en Docker y ejecutar Vite con recarga automática:

```powershell
cd mapa-educativo-react
npm ci
npm run dev
```

El proxy de Vite apunta a `http://127.0.0.1:8090`; si cambia el puerto Docker, actualice `vite.config.js`.

```powershell
# Desde mapa-educativo-react
npm run build
npm run lint
node --test src/filters.test.js

# Desde backend
go test ./...
go vet ./...

# Desde la raíz, con Docker iniciado y Python 3 disponible
python scripts/smoke.py
```

La prueba de integración verifica HTTP, salud de PostgreSQL, lectura del padrón, autenticación, plantilla XLSX, reimportación sin duplicados y reversión de una importación inválida. Usa un registro existente y comprueba que el contenido final del padrón permanezca igual.

API: `GET /api/health`, `GET /api/schools`, `GET /api/import/template`, `POST /api/import` (multipart `file`, autenticación Basic). Las credenciales solo se envían al servicio local; para publicar fuera de este equipo se debe configurar HTTPS.

Los archivos anteriores `mapa-educativo.html` y `parse_xls.py` se conservan como antecedentes y no forman parte del despliegue Docker.

La bienvenida automática está desactivada. La apariencia VMB se adaptó de la captura aportada: azul marino, campos celestes, acentos azules y títulos serif. Las fuentes Inter y Playfair Display se sirven localmente.

La importación no solicita usuario. El servidor valida la contraseña con bcrypt y mantiene el límite de intentos. `ADMIN_USER` es un identificador interno; no se introduce en la interfaz.


## Desplegar en Dokploy

`compose.yaml` es el despliegue local. `compose.prod.yaml` es ahora autónomo y contiene db, api y web; no se deben combinar los dos archivos.

1. Suba los archivos modificados a la rama que Dokploy utiliza.
2. Configure la ruta Compose como `./compose.prod.yaml`.
3. En Environment, pegue las variables de `.env.prod` (archivo privado) o complete `.env.prod.example`. Dokploy no lee automáticamente un archivo llamado `.env.prod`; sus variables deben estar en Environment. En terminal sí se utiliza `--env-file .env.prod`.
4. `compose.prod.yaml` configura las rutas Traefik y HTTPS directamente. Verifique que los registros A de `mapa.vmbperu.com` y `mapabackend.vmbperu.com` apunten a la IP pública del servidor antes de desplegar. No añada un dominio duplicado en la pestaña Domains de Dokploy.
5. Despliegue y espere a que la base de datos y la API estén saludables.

Producción no publica puertos en el host. El compose une únicamente `web` y `api` a `dokploy-network` y declara rutas Traefik explícitas, con redirección HTTPS y certificados Let's Encrypt. La base de datos se conserva aislada de esa red. El archivo de semilla se incluye en la imagen de la API, evitando depender de montajes de archivos del repositorio en el servidor.

Mantenga el nombre de aplicación/proyecto que Dokploy ya asignó (`vmb-mapa-fon9ee`) para conservar el volumen `postgres_data` asociado. No elimine volúmenes ni cambie POSTGRES_PASSWORD de una base ya inicializada: cambiar la variable no modifica la contraseña almacenada en PostgreSQL.

`ADMIN_USER` es interno y el formulario pide solo `ADMIN_PASSWORD`. `FRONTEND_DOMAIN`, `BACKEND_DOMAIN` y `STACK_NAME` del entorno local eran informativos; no crean dominios ni sustituyen el nombre `-p` de Dokploy. No son necesarios en producción. `WEB_PORT` se utiliza únicamente para el acceso local.

Referencia: https://docs.dokploy.com/docs/core/docker-compose/domains
