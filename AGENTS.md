# Restricciones de este proyecto

- Por instrucción explícita del usuario, no asignar a este stack los puertos 4001, 5173, 5432 ni 80, tampoco como puertos internos de los servicios. Están reservados para otro proyecto.
- Puertos establecidos: web 8090, API 8091, PostgreSQL 5544, Vite 5190, preview 5191. Conservarlos al crear archivos de entorno o despliegue.
- Dominios exclusivos: mapa.vmbperu.com y mapabackend.vmbperu.com. No reutilizar los dominios ni el identificador del stack de trámites.
- Conservar las credenciales existentes y el volumen de datos; no imprimir secretos ni incluir archivos .env reales en Git.
