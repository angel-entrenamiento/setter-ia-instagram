// Licencia de uso: cada setter necesita una clave personal (variable LICENCIA) que da Ángel López.
// Se comprueba al arrancar y cada 6 h. Si el servidor de licencias no responde, sigue funcionando hasta 7 días
// desde la última comprobación correcta. Ver el archivo LICENSE.
import crypto from "node:crypto";

export const SERVIDOR_LICENCIAS = "https://setter-licencias-angel.up.railway.app";
const MARGEN_SIN_CONEXION = 7 * 24 * 3600 * 1000;
const VERSION = "1.1.0";

// "pendiente" (aún no se ha comprobado: solo los primeros segundos tras arrancar) | "ok" | "sin_clave" | "invalida" | "sin_conexion"
const estado = { estado: "pendiente", motivo: "", comprobadaAt: null };

export const estadoLicencia = () => ({ ...estado });
export const licenciaPermite = () => estado.estado === "pendiente" || estado.estado === "ok";

function idInstalacion(almacen) {
  let id = almacen.ajuste("instalacion");
  if (!id) {
    id = crypto.randomBytes(16).toString("hex");
    almacen.fijarAjuste("instalacion", id);
  }
  return id;
}

/**
 * @param {object} almacen base de datos del setter (guarda el ID de instalación y la última comprobación correcta)
 * @param {{ clave?: string, cuenta?: string, url?: string, pedir?: typeof fetch }} datos
 */
export async function comprobarLicencia(almacen, { clave = process.env.LICENCIA, cuenta = "", url = "", pedir = fetch } = {}) {
  estado.comprobadaAt = new Date().toISOString();
  if (!String(clave ?? "").trim()) {
    Object.assign(estado, { estado: "sin_clave", motivo: "Falta tu clave de licencia (variable LICENCIA en Railway)." });
    return estadoLicencia();
  }
  try {
    const r = await pedir(`${SERVIDOR_LICENCIAS}/api/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, instalacion: idInstalacion(almacen), cuenta, url, version: VERSION }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`el servidor de licencias ha respondido ${r.status}`);
    const datos = await r.json();
    if (datos.ok) {
      almacen.fijarAjuste("licencia_ultimo_ok", String(Date.now()));
      Object.assign(estado, { estado: "ok", motivo: "" });
    } else {
      Object.assign(estado, { estado: "invalida", motivo: datos.motivo || "Licencia no válida." });
    }
  } catch (error) {
    const ultimoOk = Number(almacen.ajuste("licencia_ultimo_ok") ?? 0);
    if (Date.now() - ultimoOk < MARGEN_SIN_CONEXION) Object.assign(estado, { estado: "ok", motivo: "" });
    else
      Object.assign(estado, {
        estado: "sin_conexion",
        motivo: `No se ha podido comprobar la licencia (${error.message}). Se reintenta sola cada pocos minutos.`,
      });
  }
  return estadoLicencia();
}
