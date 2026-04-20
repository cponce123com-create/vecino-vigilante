import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

/**
 * Configura la URL base del API.
 *
 * - En desarrollo local: deja la URL vacía (usa el proxy de Vite o misma origin)
 * - En producción (Render): usa VITE_API_BASE_URL definida en variables
 *   de entorno del Static Site
 */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (apiBaseUrl && apiBaseUrl.trim() !== "") {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
