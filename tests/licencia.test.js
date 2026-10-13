// Licencia: estados, margen sin conexión y bloqueo del panel y de ManyChat. Sin servicios reales.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { comprobarLicencia, licenciaPermite, SERVIDOR_LICENCIAS } from "../src/licencia.js";
import { config } from "../src/config.js";
import { crearServidor } from "../src/servidor.js";

const responde = (cuerpo, status = 200) => async () => ({ ok: status < 400, status, json: async () => cuerpo });
const sinRed = async () => {
  throw new Error("sin red");
};
const reactivar = (almacen) => comprobarLicencia(almacen, { clave: "X", pedir: responde({ ok: true }) });
const almacenes = [];
const nuevo = () => {
  const a = new AlmacenSqlite(":memory:");
  almacenes.push(a);
  return a;
};
after(async () => reactivar(nuevo()));

test("sin clave → bloqueado; clave válida → permitido", async () => {
  const a = nuevo();
  assert.equal((await comprobarLicencia(a, { clave: "" })).estado, "sin_clave");
  assert.equal(licenciaPermite(), false);
  assert.equal((await reactivar(a)).estado, "ok");
  assert.equal(licenciaPermite(), true);
});

test("clave rechazada por el servidor → bloqueado con su motivo", async () => {
  const e = await comprobarLicencia(nuevo(), { clave: "X", pedir: responde({ ok: false, motivo: "Esta clave ya se está usando en otro setter." }) });
  assert.equal(e.estado, "invalida");
  assert.match(e.motivo, /otro setter/);
  assert.equal(licenciaPermite(), false);
});

test("si el servidor de licencias no responde: sigue 7 días desde la última comprobación correcta", async () => {
  const a = nuevo();
  assert.equal((await comprobarLicencia(a, { clave: "X", pedir: sinRed })).estado, "sin_conexion", "nunca validada → bloqueada");
  await reactivar(a);
  assert.equal((await comprobarLicencia(a, { clave: "X", pedir: sinRed })).estado, "ok");
  a.fijarAjuste("licencia_ultimo_ok", String(Date.now() - 8 * 24 * 3600 * 1000));
  assert.equal((await comprobarLicencia(a, { clave: "X", pedir: responde({}, 502) })).estado, "sin_conexion");
});

test("manda siempre el mismo ID de instalación al servidor de licencias", async () => {
  const a = nuevo();
  const ids = [];
  const pedir = async (url, opciones) => {
    assert.equal(url, `${SERVIDOR_LICENCIAS}/api/validar`);
    ids.push(JSON.parse(opciones.body).instalacion);
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  await comprobarLicencia(a, { clave: "X", pedir });
  await comprobarLicencia(a, { clave: "X", pedir });
  assert.equal(ids[0], ids[1]);
  assert.ok(ids[0].length >= 16);
});

test("de punta a punta con el servidor de licencias: una clave solo vale para un setter", async () => {
  const { abrirBaseDatos, crearServidor: servidorLicencias } = await import("../../setter-licencias/servidor.js").catch(() => ({}));
  if (!abrirBaseDatos) return; // el servidor de licencias es otro repositorio: esta prueba solo corre en el ordenador de Ángel
  const db = abrirBaseDatos(":memory:");
  db.prepare("INSERT INTO licencias (clave, nombre, creada) VALUES (?, ?, ?)").run("SETTER-AAAA-BBBB", "Marta", Date.now());
  const srv = servidorLicencias(db);
  await new Promise((r) => srv.listen(0, r));
  const local = `http://127.0.0.1:${srv.address().port}`;
  const pedir = (url, o) => fetch(url.replace(SERVIDOR_LICENCIAS, local), o);
  try {
    assert.equal((await comprobarLicencia(nuevo(), { clave: "setter-aaaa-bbbb", cuenta: "marta", pedir })).estado, "ok");
    const otro = await comprobarLicencia(nuevo(), { clave: "SETTER-AAAA-BBBB", pedir });
    assert.equal(otro.estado, "invalida");
    assert.equal(db.prepare("SELECT cuenta FROM licencias").get().cuenta, "marta");
  } finally {
    srv.close();
    await reactivar(nuevo());
  }
});

test("sin licencia: el panel muestra el bloqueo y ManyChat no guarda ni contesta nada", async () => {
  Object.assign(config, { panelClave: "clave", panelUsuario: "admin", tokenManychatEntrada: "tok" });
  const almacen = nuevo();
  const manychat = { infoContacto: async () => ({ manychatId: "1", igUsuario: "x", igId: "IG1", etiquetas: [] }) };
  const { servidor } = crearServidor({ almacen, manychat, enviarEmail: async () => {} });
  await new Promise((r) => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    await comprobarLicencia(almacen, { clave: "X", pedir: responde({ ok: false, motivo: "Esta licencia está desactivada." }) });
    const r = await fetch(`${base}/panel/ajustes`, { headers: { authorization: `Basic ${Buffer.from("admin:clave").toString("base64")}` } });
    assert.equal(r.status, 403);
    assert.match(await r.text(), /está desactivada/);
    await fetch(`${base}/manychat/mensaje`, { method: "POST", headers: { "x-token": "tok" }, body: JSON.stringify({ subscriber_id: 1, texto: "hola" }) });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(almacen.todas().length, 0);
  } finally {
    servidor.close();
    await reactivar(almacen);
  }
});
