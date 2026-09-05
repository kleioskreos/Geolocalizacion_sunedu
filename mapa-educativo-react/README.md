# Frontend del Mapa de Escuelas

React 19 + Vite + Tailwind CSS. La API se consume con axios; los PDF se generan con jsPDF y jspdf-autotable. Leaflet proporciona el mapa y las herramientas de medición.

Consulte el README de la raíz para iniciar el conjunto Docker, obtener las credenciales de importación y revisar las diferencias respecto a SIGMED.

Desarrollo: `npm ci` y `npm run dev`, con Docker en ejecución en el puerto 8090. El proxy se configura en `vite.config.js`.

Verificación: `npm run build`, `npm run lint` y `node --test src/filters.test.js`.
