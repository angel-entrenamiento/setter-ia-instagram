// Actualizaciones automáticas, con GitHub y Railway simulados.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { comprobarUltimaVersion, revisarActualizaciones, actualizarAhora, estadoActualizacion } from "../src/actualizacion.js";

let peticiones;
function simulado({ ultima = "nueva123", fallaV2 = false } = {}) {
  return async (url, opciones = {}) => {
    peticiones.push({ url, cuerpo: opciones.body ? JSON.parse(opciones.body) : null, cabeceras: opciones.headers });
    if (url.includes("api.github.com")) return { ok: true, status: 200, json: async () => ({ sha: ultima }) };
    const cuerpo = JSON.parse(opciones.body);
    if (fallaV2 && cuerpo.query.includes("DeployV2")) return { ok: true, status: 200, json: async () => ({ errors: [{ message: "no" }] }) };
    return { ok: true, status: 200, json: async () => ({ data: { ok: true } }) };
  };
}

beforeEach(() => {
  peticiones = [];
  Object.assign(process.env, { RAILWAY_GIT_COMMIT_SHA: "vieja456", TOKEN_RAILWAY: "tok", RAILWAY_SERVICE_ID: "srv", RAILWAY_ENVIRONMENT_ID: "env" });
});

test("detecta que hay una versión nueva en GitHub", async () => {
  const e = await comprobarUltimaVersion({ pedir: simulado() });
  assert.equal(e.hayNueva, true);
  assert.equal(e.ultima, "nueva123");
  await comprobarUltimaVersion({ pedir: simulado({ ultima: "vieja456" }) });
  assert.equal(estadoActualizacion().hayNueva, false);
});

test("actualizar ahora pide a Railway desplegar la versión exacta, con el token del proyecto", async () => {
  const almacen = new AlmacenSqlite(":memory:");
  await comprobarUltimaVersion({ pedir: simulado() });
  await actualizarAhora(almacen, { pedir: simulado() });
  const p = peticiones.find((x) => x.url.includes("railway"));
  assert.equal(p.cabeceras["Project-Access-Token"], "tok");
  assert.match(p.cuerpo.query, /serviceInstanceDeployV2/);
  assert.deepEqual(p.cuerpo.variables, { serviceId: "srv", environmentId: "env", commitSha: "nueva123" });
});

test("si Railway no acepta la primera forma, prueba con 'último commit'", async () => {
  const almacen = new AlmacenSqlite(":memory:");
  await comprobarUltimaVersion({ pedir: simulado() });
  await actualizarAhora(almacen, { pedir: simulado({ fallaV2: true }) });
  assert.ok(peticiones.some((p) => p.cuerpo?.query.includes("latestCommit: true")));
});

test("la automática solo actúa de madrugada, una vez por versión y si está activada", async () => {
  const almacen = new AlmacenSqlite(":memory:");
  await comprobarUltimaVersion({ pedir: simulado() });
  assert.equal(await revisarActualizaciones(almacen, { automatica: true, hora: 14, pedir: simulado() }), false, "de día no");
  assert.equal(await revisarActualizaciones(almacen, { automatica: false, hora: 4, pedir: simulado() }), false, "desactivada no");
  assert.equal(await revisarActualizaciones(almacen, { automatica: true, hora: 4, pedir: simulado() }), true);
  assert.equal(await revisarActualizaciones(almacen, { automatica: true, hora: 4, pedir: simulado() }), false, "no la repite");
});

test("sin TOKEN_RAILWAY no intenta nada y lo explica", async () => {
  delete process.env.TOKEN_RAILWAY;
  const almacen = new AlmacenSqlite(":memory:");
  await assert.rejects(actualizarAhora(almacen, { pedir: simulado() }), /TOKEN_RAILWAY/);
  assert.equal(await revisarActualizaciones(almacen, { automatica: true, hora: 4, pedir: simulado() }), false);
});

// ---------- Avisos por email de las novedades ----------
import fs from "node:fs";
import { parsearNovedades, novedadesNuevas } from "../src/actualizacion.js";
import { negocio } from "../src/negocio.js";
import { config as cfg } from "../src/config.js";

const LOCAL = fs.readFileSync(new URL("../NOVEDADES.md", import.meta.url), "utf8");
const conEntrada = (titulo, fecha = "2026-11-02") => LOCAL.replace("\n## ", `\n## ${fecha} · ${titulo}\n- Explicación de ${titulo}.\n\n## `);
function conNovedades(remoto, sha = "nueva123") {
  return async (url, opciones = {}) => {
    peticiones.push({ url });
    if (url.includes("raw.githubusercontent.com")) return { ok: true, status: 200, text: async () => remoto };
    if (url.includes("api.github.com")) return { ok: true, status: 200, json: async () => ({ sha }) };
    return { ok: true, status: 200, json: async () => ({ data: {} }) };
  };
}
const forzarComprobacion = async (pedir) => comprobarUltimaVersion({ pedir });

test("NOVEDADES.md: se leen las entradas y se detectan solo las que no tiene la versión instalada", () => {
  const locales = parsearNovedades(LOCAL);
  assert.ok(locales.length >= 5);
  assert.match(locales[0].fecha, /^\d{4}-\d{2}-\d{2}$/);
  const remotas = parsearNovedades(conEntrada("Buscador de conversaciones"));
  assert.deepEqual(novedadesNuevas(remotas, locales).map((n) => n.titulo), ["Buscador de conversaciones"]);
  assert.match(novedadesNuevas(remotas, locales)[0].texto, /Explicación de Buscador/);
  // Instalación antigua sin NOVEDADES.md: por fecha
  const masReciente = locales[0].fecha; // instalada el día de la última entrada que ya tenía
  assert.deepEqual(novedadesNuevas(remotas, null, `${masReciente}T15:58:13Z`).map((n) => n.titulo), ["Buscador de conversaciones"]);
  assert.deepEqual(novedadesNuevas(remotas, null, ""), []);
});

test("avisa por email una sola vez por novedad, aunque la versión se suba en varias tandas", async () => {
  Object.assign(cfg, { emailAvisos: "dueno@ejemplo.com" });
  negocio.avisarActualizaciones = true;
  const almacen = new AlmacenSqlite(":memory:");
  const emails = [];
  const avisar = async (e) => void emails.push(e);
  const remoto = conEntrada("Buscador de conversaciones");
  await forzarComprobacion(conNovedades(remoto, "subida1"));
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(remoto, "subida1") });
  await forzarComprobacion(conNovedades(remoto, "subida2")); // segunda tanda de la misma actualización
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(remoto, "subida2") });
  assert.equal(emails.length, 1);
  assert.match(emails[0].asunto, /\[ACTUALIZACIÓN\].*Buscador de conversaciones/);
  assert.match(emails[0].cuerpo, /Se instalará sola esta madrugada/);
  assert.match(emails[0].cuerpo, /Explicación de Buscador/);
  assert.equal(emails[0].para, "dueno@ejemplo.com");

  const otra = conEntrada("Otra mejora", "2026-11-05");
  // y otra entrada nueva encima
  const remoto2 = otra.replace("\n## 2026-11-05 · Otra mejora", "\n## 2026-11-06 · Mejora siguiente\n- Algo más.\n\n## 2026-11-05 · Otra mejora");
  await forzarComprobacion(conNovedades(remoto2, "subida3"));
  await revisarActualizaciones(almacen, { automatica: false, hora: 14, avisar, pedir: conNovedades(remoto2, "subida3") });
  assert.equal(emails.length, 2, "una entrada nueva sí avisa otra vez");
  assert.match(emails[1].cuerpo, /«Actualizar ahora»/);
});

test("no avisa si no hay entrada nueva en NOVEDADES, si está desactivado o sin versión nueva", async () => {
  const almacen = new AlmacenSqlite(":memory:");
  const emails = [];
  const avisar = async (e) => void emails.push(e);
  await forzarComprobacion(conNovedades(LOCAL, "cambio-pequeno")); // versión nueva sin novedades escritas
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(LOCAL, "cambio-pequeno") });
  negocio.avisarActualizaciones = false;
  await forzarComprobacion(conNovedades(conEntrada("X"), "otra"));
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(conEntrada("X"), "otra") });
  negocio.avisarActualizaciones = true;
  await forzarComprobacion(conNovedades(conEntrada("Y"), "vieja456")); // misma versión que la instalada
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(conEntrada("Y"), "vieja456") });
  assert.equal(emails.length, 0);
});
test("solo avisan los setters con licencia válida", async () => {
  const { comprobarLicencia } = await import("../src/licencia.js");
  const almacen = new AlmacenSqlite(":memory:");
  const emails = [];
  const avisar = async (e) => void emails.push(e);
  const respuesta = (cuerpo) => async () => ({ ok: true, status: 200, json: async () => cuerpo });
  await comprobarLicencia(almacen, { clave: "X", pedir: respuesta({ ok: false, motivo: "desactivada" }) });
  try {
    await forzarComprobacion(conNovedades(conEntrada("Z"), "con-licencia-mala"));
    await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(conEntrada("Z"), "con-licencia-mala") });
    assert.equal(emails.length, 0);
  } finally {
    await comprobarLicencia(almacen, { clave: "X", pedir: respuesta({ ok: true }) });
  }
  await revisarActualizaciones(almacen, { automatica: true, hora: 14, avisar, pedir: conNovedades(conEntrada("Z"), "con-licencia-mala") });
  assert.equal(emails.length, 1, "con la licencia ya válida, sí avisa");
});