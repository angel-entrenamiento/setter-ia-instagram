// Actualizaciones automáticas: compara la versión desplegada con la última del repositorio de Ángel en GitHub
// y, si hay una nueva, le pide a Railway que despliegue esa versión (de madrugada, o al pulsar "Actualizar ahora").
// Necesita la variable TOKEN_RAILWAY (token del proyecto de Railway: Project Settings → Tokens).
// Lo que hay en /data (conocimiento, ajustes, conversaciones) no se toca al actualizar.
export const REPOSITORIO = "angel-entrenamiento/setter-ia-instagram";
const API_RAILWAY = "https://backboard.railway.com/graphql/v2";

const estado = { ultima: null, comprobadaAt: null, error: "" };

export const versionActual = () => process.env.RAILWAY_GIT_COMMIT_SHA || "";
export const corta = (sha) => (sha ? sha.slice(0, 7) : "?");
export const puedeActualizarse = () =>
  Boolean(process.env.TOKEN_RAILWAY && process.env.RAILWAY_SERVICE_ID && process.env.RAILWAY_ENVIRONMENT_ID);

export function estadoActualizacion() {
  const actual = versionActual();
  return {
    actual,
    ultima: estado.ultima,
    hayNueva: Boolean(estado.ultima && actual && estado.ultima !== actual),
    comprobadaAt: estado.comprobadaAt,
    error: estado.error,
    configurada: puedeActualizarse(),
  };
}

/** Última versión (commit) de la rama main en GitHub. */
export async function comprobarUltimaVersion({ pedir = fetch } = {}) {
  estado.comprobadaAt = new Date().toISOString();
  try {
    const r = await pedir(`https://api.github.com/repos/${REPOSITORIO}/commits/main`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "setter-ia" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`GitHub ha respondido ${r.status}`);
    estado.ultima = (await r.json()).sha ?? null;
    estado.error = "";
  } catch (error) {
    estado.error = `No se ha podido comprobar si hay versión nueva (${error.message}).`;
  }
  return estadoActualizacion();
}

async function railway(query, variables, pedir) {
  const r = await pedir(API_RAILWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Project-Access-Token": process.env.TOKEN_RAILWAY },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.errors?.length) throw new Error(json.errors?.[0]?.message ?? `Railway ha respondido ${r.status}`);
  return json.data;
}

/** Pide a Railway que despliegue la última versión. El servidor se reinicia solo en 2-3 minutos. */
export async function actualizarAhora(almacen, { pedir = fetch } = {}) {
  if (!puedeActualizarse()) throw new Error("Falta la variable TOKEN_RAILWAY en Railway (mira la guía, apartado Actualizaciones).");
  const e = estado.ultima ? estadoActualizacion() : await comprobarUltimaVersion({ pedir });
  const variables = { serviceId: process.env.RAILWAY_SERVICE_ID, environmentId: process.env.RAILWAY_ENVIRONMENT_ID };
  try {
    if (!e.ultima) throw new Error("sin versión");
    await railway(
      "mutation ($serviceId: String!, $environmentId: String!, $commitSha: String) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha) }",
      { ...variables, commitSha: e.ultima },
      pedir,
    );
  } catch {
    // Alternativa: "desplegar el último commit" sin indicar cuál
    await railway(
      "mutation ($serviceId: String!, $environmentId: String!) { serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId, latestCommit: true) }",
      variables,
      pedir,
    );
  }
  almacen.fijarAjuste("actualizacion_pedida", JSON.stringify({ sha: e.ultima, fecha: new Date().toISOString() }));
  console.log(`[actualizacion] pedida la versión ${corta(e.ultima)} (actual ${corta(e.actual)})`);
  return e.ultima;
}

/**
 * Se llama cada pocos minutos. Cada 6 h mira si hay versión nueva y, si la hay y está activada la actualización
 * automática, la instala entre las 3:00 y las 5:00 (hora del negocio). No repite la petición de la misma versión en 6 h.
 */
export async function revisarActualizaciones(almacen, { automatica, hora, pedir = fetch } = {}) {
  const hace = Date.now() - Date.parse(estado.comprobadaAt ?? 0);
  if (!(hace < 6 * 3600000)) await comprobarUltimaVersion({ pedir });
  const e = estadoActualizacion();
  if (!e.hayNueva || !automatica || !e.configurada || hora < 3 || hora >= 5) return false;
  let pedida = {};
  try {
    pedida = JSON.parse(almacen.ajuste("actualizacion_pedida") ?? "{}");
  } catch {}
  if (pedida.sha === e.ultima && Date.now() - Date.parse(pedida.fecha) < 6 * 3600000) return false;
  await actualizarAhora(almacen, { pedir }).catch((error) => {
    estado.error = `La actualización automática ha fallado: ${error.message}`;
    console.error(`[actualizacion] ${error.message}`);
  });
  return true;
}

