import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL || '/api',timeout:120000});
export const errorMessage=error=>error.response?.data?.error || 'No se pudo conectar con el servidor. Compruebe que los servicios Docker estén activos.';
