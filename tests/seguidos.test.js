// Personas a las que sigue el dueño: el asistente no les contesta ni les hace seguimientos. Sin servicios reales.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearOrquestador } from "../src/orquestador.js";
import { crearTareas } from "../src/tareas.js";
import { crearServidor } from "../src/servidor.js";
import { extraerUsuarios, guardarSeguidos, loSigue } from "../src/seguidos.js";
import { usarGeneradorDePrueba, usarTextoDePrueba } from "../src/cerebro/llm.js";
import { FICHA_VACIA } from "../src/cerebro/esquema.js";

Object.assign(config, { modoPrueba: false, entrada: "manychat", listaBlanca: ["mi.cuenta.pruebas"] });
const log = { info() {}, error() {} };
const HORA = 3600000;
let almacen, enviados, orq;
const usuarios = { 1: "ana.fit", 2: "lead_nuevo", 3: "mi.cuenta.pruebas" };
const manychat = {
  infoContacto: async (id) => ({ manychatId: String(id), igUsuario: usuarios[id], igId: `IG${id}`, etiquetas: [], enlaceChat: "" }),
  enviarTextos: async (id) => void enviados.push(String(id)),
};
usarGeneradorDePrueba(async () => ({ mensajes: ["Hola!"], estado: "descubriendo", accion: "ninguna", ficha: { ...FICHA_VACIA }, nota_interna: "" }));

beforeEach(() => {
  almacen = new AlmacenSqlite(":memory:");
  enviados = [];
  orq = crearOrquestador({ almacen, manychat, enviarEmail: async () => {}, log });
});

async function escribe(id, texto = "Hola, quería información") {
  await orq.recibirMensajeManychat({ subscriberId: id, texto });
  const c = almacen.obtener(`IG${id}`);
  if (c) {
    c.procesarEn = Date.now();
    almacen.guardar(c);
  }
  await orq.procesarVencidos({ esperar: true });
}

test("lee el archivo de Instagram en sus distintos formatos y también una lista pegada", () => {
  const antiguo = JSON.stringify({ relationships_following: [{ string_list_data: [{ href: "https://www.instagram.com/Ana.Fit", value: "Ana.Fit", timestamp: 1 }] }] });
  const nuevo = JSON.stringify([{ title: "pepe_88", string_list_data: [{ href: "https://www.instagram.com/_u/pepe_88", timestamp: 1 }] }]);
  assert.deepEqual(extraerUsuarios(antiguo), ["ana.fit"]);
  assert.deepEqual(extraerUsuarios(nuevo), ["pepe_88"]);
  assert.deepEqual(extraerUsuarios("@Ana.Fit, pepe_88\nlaura.g  no-vale!"), ["ana.fit", "laura.g", "pepe_88"]);
});

test("sin lista cargada, contesta a todos", async () => {
  await escribe(1);
  assert.deepEqual(enviados, ["1"]);
});

test("a quien sigues no le contesta ni guarda nada; a los demás y a la cuenta de pruebas sí", async () => {
  guardarSeguidos(almacen, ["ana.fit", "mi.cuenta.pruebas"]);
  await escribe(1);
  await escribe(2);
  await escribe(3);
  assert.deepEqual(enviados.sort(), ["2", "3"]);
  assert.equal(almacen.obtener("IG1"), null, "no se guarda la conversación de quien sigues");
  assert.equal(loSigue(almacen, "@Ana.Fit"), true);
});

test("si lo empiezas a seguir con una respuesta pendiente, ya no se le contesta", async () => {
  await orq.recibirMensajeManychat({ subscriberId: 1, texto: "Hola" });
  guardarSeguidos(almacen, ["ana.fit"]);
  const c = almacen.obtener("IG1");
  c.procesarEn = Date.now();
  almacen.guardar(c);
  await orq.procesarVencidos({ esperar: true });
  assert.deepEqual(enviados, []);
});

test("tampoco recibe el seguimiento de las 24 h", async () => {
  usarTextoDePrueba(async () => "Hola Ana, pudiste ver mi mensaje?");
  try {
    for (const id of [1, 2]) {
      const c = almacen.obtenerOCrear({ id: `IG${id}` });
      Object.assign(c, { manychatId: String(id), igUsuario: usuarios[id], estado: "descubriendo", ultimoMensajeLeadAt: new Date(Date.now() - 23.2 * HORA).toISOString() });
      c.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" }, { rol: "bot", tipo: "texto", texto: "Hola! Qué tal?" });
      almacen.guardar(c);
    }
    guardarSeguidos(almacen, ["ana.fit"]);
    await crearTareas({ almacen, manychat, enviarEmail: async () => {}, log }).seguimientosAutomaticos();
    assert.deepEqual(enviados, ["2"]);
  } finally {
    usarTextoDePrueba(null);
  }
});

test("la página del panel guarda la lista subida", async () => {
  Object.assign(config, { panelUsuario: "admin", panelClave: "clave-panel" });
  const { servidor } = crearServidor({ almacen, manychat, enviarEmail: async () => {} });
  await new Promise((r) => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const auth = { authorization: `Basic ${Buffer.from("admin:clave-panel").toString("base64")}` };
  const subir = (texto) => fetch(`${base}/panel/seguidos`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ texto }) });
  try {
    assert.equal((await fetch(`${base}/panel/seguidos`)).status, 401);
    const archivo = JSON.stringify({ relationships_following: [{ string_list_data: [{ value: "ana.fit" }] }, { string_list_data: [{ value: "otra.cuenta" }] }] });
    assert.deepEqual(await (await subir(archivo)).json(), { ok: true, total: 2 });
    assert.equal(loSigue(almacen, "otra.cuenta"), true);
    assert.match(await (await fetch(`${base}/panel/seguidos`, { headers: auth })).text(), /<b>2<\/b> cuentas/);
    assert.match(await (await fetch(`${base}/panel`, { headers: auth })).text(), /Personas que sigues/);
    assert.equal((await subir("!!!")).status, 400);
  } finally {
    servidor.close();
  }
});
