/**
 * Utilidad para construir URLs de la API de forma unificada.
 * Maneja la base remota o local según el entorno.
 */
export function apiUrl(path: string): string {
  // En producción, Render suele configurar las variables de entorno.
  // Si hay una base remota definida, la usamos; de lo contrario, usamos rutas relativas.
  const apiBase = import.meta.env.VITE_API_URL || "";
  
  // Asegurarse de que el path comience con /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  return `${apiBase}${normalizedPath}`;
}
