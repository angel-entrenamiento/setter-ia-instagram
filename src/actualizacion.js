// Actualizaciones automáticas: compara la versión desplegada con la última del repositorio de Ángel en GitHub
// y, si hay una nueva, le pide a Railway que despliegue esa versión (de madrugada, o al pulsar "Actualizar ahora").
// Necesita la variable TOKEN_RAILWAY (token del proyecto de Railway: Project Settings → Tokens).
// Lo que hay en /data (conocimiento, ajustes, conversaciones) no se toca al actualizar.
// Además avisa por email al dueño de lo que trae cada versión nueva (archivo NOVEDADES.md del repositorio).
import fs from "node:fs";
import path from "node:path";
import { config, RAIZ } from "./config.js";
import { negocio } from "./negocio.js";
import { licenciaPermite } from "./licencia.js";

export const REPOSITORIO = "angel-entrenamiento/setter-ia-instagram";
const API_RAILWAY = "https://backboard.railway.com/graphql/v2";
const API_GITHUB = `https://api.github.com/repos/${REPOSITORIO}`;
const CABECERAS_GITHUB = { Accept: "application/vnd.github+json", "User-Agent": "setter-ia" };

const estado = { ultima: null, comprobadaAt: null, error: "", novedades: [] };

export const versionActual = () => process.env.RAILWAY_GIT_COMMIT_SHA || "";
export const corta = (sha) => (sha ? sha.slice(0, 7) : "?");

/** Repositorio de GitHub desde el que Railway ha instalado este setter ("dueño/nombre"; vacío si no viene de GitHub). */
export const repositorioInstalado = () =>
  process.env.RAILWAY_GIT_REPO_OWNER && process.env.RAILWAY_GIT_REPO_NAME
    ? `${process.env.RAILWAY_GIT_REPO_OWNER}/${process.env.RAILWAY_GIT_REPO_NAME}`.toLowerCase()
    : "";
/**
 * Copia propia del código (repositorio privado que Ángel da a un compañero para que haga sus cambios).
 * No se instala nada automáticamente: las novedades de la plantilla las trae su dueño con Claude Code.
 */
export const esCopiaPropia = () => Boolean(repositorioInstalado()) && repositorioInstalado() !== REPOSITORIO;

export const puedeActualizarse = () =>
  !esCopiaPropia() && Boolean(process.env.TOKEN_RAILWAY && process.env.RAILWAY_SERVICE_ID && process.env.RAILWAY_ENVIRONMENT_ID);

export function estadoActualizacion() {
  const actual = versionActual();
  const copiaPropia = esCopiaPropia();
  return {
    actual,
    ultima: estado.ultima,
    // En una copia propia los commits nunca coinciden con los de la plantilla: lo nuevo son las novedades que aún no tiene
    hayNueva: copiaPropia ? estado.novedades.length > 0 : Boolean(estado.ultima && actual && estado.ultima !== actual),
    comprobadaAt: estado.comprobadaAt,
    error: estado.error,
    configurada: puedeActualizarse(),
    copiaPropia,
    novedades: estado.novedades,
  };
}

// ---------- Novedades (NOVEDADES.md) ----------

/**
 * Cada entrada empieza por "## AAAA-MM-DD · Título" y sigue con su explicación (listas, párrafos…).
 * @returns {{ id: string, fecha: string, titulo: string, texto: string }[]} de la más nueva a la más antigua
 */
export function parsearNovedades(md) {
  const entradas = [];
  for (const bloque of String(md ?? "").split(/^## /m).slice(1)) {
    const [cabecera, ...resto] = bloque.split("\n");
    const id = cabecera.trim();
    const m = id.match(/^(\d{4}-\d{2}-\d{2})\s*[·\-–—:]?\s*(.*)$/);
    entradas.push({ id, fecha: m?.[1] ?? "", titulo: (m?.[2] || id).trim(), texto: resto.join("\n").trim() });
  }
  return entradas;
}

/**
 * Lo que trae la versión de GitHub y no tiene la instalada: las entradas que no están en su NOVEDADES.md.
 * Si la instalada aún no tenía ese archivo, se usan las fechas: entradas posteriores al día de la versión instalada.
 */
export function novedadesNuevas(remotas, locales, fechaInstalada = "") {
  if (locales) {
    const ids = new Set(locales.map((e) => e.id));
    return remotas.filter((e) => !ids.has(e.id));
  }
  if (!fechaInstalada) return [];
  return remotas.filter((e) => e.fecha && e.fecha > fechaInstalada.slice(0, 10));
}

function novedadesLocales() {
  const ruta = path.join(RAIZ, "NOVEDADES.md");
  return fs.existsSync(ruta) ? parsearNovedades(fs.readFileSync(ruta, "utf8")) : null;
}

async function leerNovedadesRemotas(pedir) {
  const r = await pedir(`https://raw.githubusercontent.com/${REPOSITORIO}/main/NOVEDADES.md`, { signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub ha respondido ${r.status}`);
  return parsearNovedades(await r.text());
}

async function fechaDeVersion(sha, pedir) {
  if (!sha) return "";
  const r = await pedir(`${API_GITHUB}/commits/${sha}`, { headers: CABECERAS_GITHUB, signal: AbortSignal.timeout(15000) });
  return r.ok ? ((await r.json()).commit?.committer?.date ?? "") : "";
}

/** Última versión (commit) de la rama main en GitHub y, si es nueva, lo que trae. */
export async function comprobarUltimaVersion({ pedir = fetch } = {}) {
  estado.comprobadaAt = new Date().toISOString();
  try {
    const r = await pedir(`${API_GITHUB}/commits/main`, { headers: CABECERAS_GITHUB, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`GitHub ha respondido ${r.status}`);
    estado.ultima = (await r.json()).sha ?? null;
    estado.error = "";
  } catch (error) {
    estado.error = `No se ha podido comprobar si hay versión nueva (${error.message}).`;
    return estadoActualizacion();
  }
  estado.novedades = [];
  if (esCopiaPropia() || estadoActualizacion().hayNueva) {
    try {
      const locales = novedadesLocales();
      const fecha = locales ? "" : await fechaDeVersion(versionActual(), pedir);
      estado.novedades = novedadesNuevas(await leerNovedadesRemotas(pedir), locales, fecha);
    } catch {
      // Sin la lista de novedades se puede actualizar igual; solo no se avisa por email
    }
  }
  return estadoActualizacion();
}

/** Email al dueño con lo que trae la versión nueva. */
export function construirEmailNovedades(novedades, { automatica, configurada, copiaPropia = false }) {
  const asistente = negocio.nombreAsistente;
  if (copiaPropia) {
    const bloques = novedades.map((n) => `${n.titulo.toUpperCase()}${n.fecha ? ` (${n.fecha})` : ""}\n${n.texto}`);
    return {
      etiqueta: "ACTUALIZACION",
      para: config.emailAvisos,
      asunto: `[ACTUALIZACIÓN] Novedades en la plantilla de Ángel: ${novedades[0].titulo}`,
      cuerpo: [
        `Ángel ha publicado mejoras en la plantilla del setter que tu copia de ${asistente} todavía no tiene.`,
        "Como tienes tu propia copia del código, no se instalan solas. Para traerlas: abre Claude Code en tu copia y dile «trae las novedades de la plantilla». Las juntará con tus cambios y, cuando las subas, se instalarán.",
        "",
        "QUÉ TRAEN",
        "",
        bloques.join("\n\n"),
      ].join("\n"),
    };
  }
  const como = !configurada
    ? `Para instalarla: en Railway añade la variable TOKEN_RAILWAY (lo explica tu panel → Ajustes → Actualizaciones) y luego pulsa «Actualizar ahora».`
    : automatica
      ? `Se instalará sola esta madrugada, entre las 3:00 y las 5:00. Si la quieres ya: panel → Ajustes → Actualizaciones → «Actualizar ahora».`
      : `Para instalarla: panel → Ajustes → Actualizaciones → «Actualizar ahora».`;
  const bloques = novedades.map((n) => `${n.titulo.toUpperCase()}${n.fecha ? ` (${n.fecha})` : ""}\n${n.texto}`);
  return {
    etiqueta: "ACTUALIZACION",
    para: config.emailAvisos,
    asunto: `[ACTUALIZACIÓN] Novedades para ${asistente}: ${novedades[0].titulo}`,
    cuerpo: [
      `Hay una versión nueva de tu setter ${asistente}.`,
      como,
      "Tu conocimiento, tus ajustes, tu CRM y tus conversaciones no se tocan al actualizar.",
      "",
      "QUÉ TRAE",
      "",
      bloques.join("\n\n"),
      "",
      `Tu panel: ${config.urlPublica}/panel/ajustes#actualizaciones`,
    ].join("\n"),
  };
}

// ---------- Instalar ----------

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
  if (esCopiaPropia()) throw new Error("Tienes tu propia copia del código: las novedades de la plantilla se traen con Claude Code («trae las novedades de la plantilla»).");
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
 * Se llama cada pocos minutos. Cada 6 h mira si hay versión nueva. Si la hay:
 * - avisa por email al dueño de sus novedades (una vez por novedad, aunque la versión se suba en varias tandas),
 * - y, si está activada la actualización automática, la instala entre las 3:00 y las 5:00 (hora del negocio).
 * @param {{ automatica: boolean, hora: number, avisar?: (email) => Promise, pedir?: typeof fetch }} op
 */
export async function revisarActualizaciones(almacen, { automatica, hora, avisar = null, pedir = fetch } = {}) {
  const hace = Date.now() - Date.parse(estado.comprobadaAt ?? 0);
  if (!(hace < 6 * 3600000)) await comprobarUltimaVersion({ pedir });
  const e = estadoActualizacion();

  // Aviso por email (solo setters con licencia válida y con el aviso activado)
  const ultimaNovedad = e.novedades[0]?.id;
  if (e.hayNueva && ultimaNovedad && avisar && negocio.avisarActualizaciones && licenciaPermite() && almacen.ajuste("novedades_avisadas") !== ultimaNovedad) {
    almacen.fijarAjuste("novedades_avisadas", ultimaNovedad);
    await Promise.resolve(avisar(construirEmailNovedades(e.novedades, { automatica, configurada: e.configurada, copiaPropia: e.copiaPropia }))).catch((error) =>
      console.error(`[actualizacion] aviso por email: ${error.message}`),
    );
  }

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
