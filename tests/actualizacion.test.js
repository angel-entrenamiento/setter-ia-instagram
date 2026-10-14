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
