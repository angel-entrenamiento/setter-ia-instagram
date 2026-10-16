// CRM del panel: lo que rellena el asistente solo y lo que edita la persona. Sin servicios reales.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearCrm, diaEn } from "../src/crm/index.js";
import { crearServidor } from "../src/servidor.js";
import { entrevistaDesdeConversacion, guardarListasCrm, listasCrm, cargarListasCrm, LISTAS_POR_DEFECTO } from "../src/crm/opciones.js";

const nuevoCrm = () => {
  const almacen = new AlmacenSqlite(":memory:");
  return { almacen, crm: crearCrm({ db: almacen.db, conversaciones: () => almacen.todas(), nombreAsistente: () => "Lucía", log: { error() {} } }) };
};
const hoy = diaEn("Europe/Madrid");
const conv = (extra = {}) => ({
  id: "c1",
  origen: "espontaneo",
  nombre: "Laura",
  igUsuario: "laura",
  historial: [{ rol: "lead", texto: "hola" }],
  ficha: { nombre: "Laura", situacion: "quiere perder 10 kg", objeciones: ["precio"], objetivo: "volver a ponerse sus vaqueros" },
  ...extra,
});

test("empieza vacío", () => {
  const { crm } = nuevoCrm();
  const d = crm.datos("2026");
  assert.deepEqual(d.kpis, {});
  assert.deepEqual(d.filas, []);
  assert.deepEqual(d.notas, {});
  assert.equal(d.asistente, "Lucía");
});

test("inbound y lead magnet suman en el día", () => {
  const { crm } = nuevoCrm();
  crm.registrar("inbound", conv(), { dia: "2026-10-15" });
  crm.registrar("inbound", conv({ id: "c2" }), { dia: "2026-10-15" });
  crm.registrar("lead_magnet", conv({ id: "c3" }), { dia: "2026-10-15" });
  assert.deepEqual(crm.datos("2026").kpis["2026-10-15"], { inbound: 2, lead_magnet: 1 });
});

test("agendada: crea la fila en Entrevistas una sola vez y suma agendada inbound/outbound", () => {
  const { crm } = nuevoCrm();
  crm.registrar("agendada", conv());
  crm.registrar("agendada", conv()); // repetida → no duplica
  crm.registrar("agendada", conv({ id: "c2", origen: "bienvenida" }));
  const d = crm.datos(hoy.slice(0, 4));
  assert.equal(d.kpis[hoy].agendadas_inbound, 1);
  assert.equal(d.kpis[hoy].agendadas_outbound, 1);
  const filas = d.filas.filter((f) => f.tabla === "entrevista");
  assert.equal(filas.length, 2);
  assert.equal(filas[0].origen, "asistente");
  assert.equal(filas[0].convId, "c1");
  assert.equal(filas[0].periodo, hoy.slice(0, 7));
  assert.equal(filas[0].nombre, "Laura @laura");
  assert.equal(filas[0].que_dice, "quiere perder 10 kg · Objetivo: volver a ponerse sus vaqueros");
  assert.equal(filas[1].procedencia, "Outbound");
});

test("entrevista: poner la fecha la mueve de mes; marcar Entra suma una cerrada y desmarcar la resta", () => {
  const { crm } = nuevoCrm();
  const f = crm.almacen.crearFila("entrevista", "2026-10", { nombre: "X" });
  let r = crm.actualizarEntrevista(f.id, { fecha_entrevista: "2026-11-03" });
  assert.equal(r.periodo, "2026-11");
  r = crm.actualizarEntrevista(f.id, { entra: 1 });
  assert.equal(crm.datos("2026").kpis["2026-11-03"].cerradas, 1);
  crm.actualizarEntrevista(f.id, { entra: 1 }); // sin cambio → no suma otra
  assert.equal(crm.datos("2026").kpis["2026-11-03"].cerradas, 1);
  crm.actualizarEntrevista(f.id, { entra: 0 });
  assert.equal(crm.datos("2026").kpis["2026-11-03"].cerradas, 0);
});

test("lead magnets (pestaña oculta): cuenta solicitudes, respuestas y agendadas por el recurso de ManyChat", () => {
  const { almacen, crm } = nuevoCrm();
  for (const [id, escribe] of [["a", true], ["b", false], ["c", true]]) {
    const c = almacen.obtenerOCrear({ id });
    c.recurso = "Guía gratis";
    if (escribe) c.historial.push({ rol: "lead", texto: "gracias" });
    almacen.guardar(c);
  }
  crm.registrar("agendada", { ...almacen.obtener("a"), ficha: {} });
  const lm = crm.almacen.crearFila("lead_magnet", "2026-T4", { titulo: "Guía", clave_manychat: "guía gratis" });
  assert.deepEqual(crm.datos("2026").autoLeadMagnet[lm.id], { solicitudes: 3, respuestas: 2, agendadas: 1 });
});

test("la fila del asistente resume la ficha sin inventar", () => {
  const e = entrevistaDesdeConversacion(conv({ origen: "historia", ficha: { objeciones: [], preferencia_franja: "tarde" } }));
  assert.equal(e.procedencia, "Inbound Historia");
  assert.equal(e.que_dice, "Prefiere tarde");
  assert.equal(e.objecion, "");
  assert.equal(e.modalidad, undefined, "no sabe si es online o presencial: lo deja vacío");
  assert.equal(e.servicio, undefined);
  assert.equal(e.que_le_ocurre, undefined);
});

test("los desplegables se cambian desde Ajustes y «Qué le ocurre» empieza vacío", () => {
  const almacen = new AlmacenSqlite(":memory:");
  assert.deepEqual(cargarListasCrm(almacen).que_le_ocurre, []);
  guardarListasCrm(almacen, new URLSearchParams({ lista_que_le_ocurre: "Perder peso\n  Ganar músculo \n\nPerder peso", lista_servicio: "Plan 12 semanas" }));
  assert.deepEqual(listasCrm().que_le_ocurre, ["Perder peso", "Ganar músculo"]);
  assert.deepEqual(listasCrm().servicio, ["Plan 12 semanas"]);
  assert.deepEqual(cargarListasCrm(almacen).que_le_ocurre, ["Perder peso", "Ganar músculo"], "se guarda en la base de datos");
  guardarListasCrm(almacen, Object.fromEntries(Object.entries(LISTAS_POR_DEFECTO).map(([k, v]) => [`lista_${k}`, v.join("\n")])));
});

// ---------- HTTP ----------
let srv, base;
const auth = { authorization: "Basic " + Buffer.from("admin:clave-panel").toString("base64") };
before(async () => {
  Object.assign(config, { panelUsuario: "admin", panelClave: "clave-panel" });
  srv = crearServidor({ almacen: new AlmacenSqlite(":memory:"), manychat: {}, enviarEmail: async () => {} });
  await new Promise((r) => srv.servidor.listen(0, r));
  base = `http://127.0.0.1:${srv.servidor.address().port}`;
});
after(() => srv.servidor.close());

test("el CRM necesita la contraseña del panel y sale en el panel", async () => {
  assert.equal((await fetch(`${base}/panel/crm`)).status, 401);
  assert.equal((await fetch(`${base}/panel/crm/api/datos?anio=2026`)).status, 401);
  const r = await fetch(`${base}/panel/crm`, { headers: auth });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /CRM/);
  assert.match(await (await fetch(`${base}/panel`, { headers: auth })).text(), /📊 Abrir el CRM/);
});

test("API: outbound a mano, notas y filas de ventas", async () => {
  const post = (ruta, cuerpo) => fetch(`${base}/panel/crm/api/${ruta}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  assert.equal((await post("kpi", { fecha: "2026-10-16", campo: "outbound", valor: "45" })).status, 200);
  assert.equal((await post("kpi", { fecha: "2026-10-16", campo: "inventado", valor: 1 })).status, 400);
  assert.equal((await post("nota", { clave: "objetivo:2026-10:outbound", texto: "500" })).status, 200);
  const venta = await (await post("fila", { tabla: "venta", periodo: "2026-10", datos: { nombre: "Cliente" } })).json();
  await post(`fila/${venta.id}`, { cambios: { realizada: 1, mail: "a@b.c" } });
  const d = await (await fetch(`${base}/panel/crm/api/datos?anio=2026`, { headers: auth })).json();
  assert.equal(d.kpis["2026-10-16"].outbound, 45);
  assert.equal(d.notas["objetivo:2026-10:outbound"], "500");
  assert.deepEqual({ ...d.filas[0], id: 0 }, { id: 0, tabla: "venta", periodo: "2026-10", convId: null, origen: "manual", nombre: "Cliente", realizada: 1, mail: "a@b.c" });
  await fetch(`${base}/panel/crm/api/fila/${venta.id}`, { method: "DELETE", headers: auth });
  assert.equal((await (await fetch(`${base}/panel/crm/api/datos?anio=2026`, { headers: auth })).json()).filas.length, 0);
});

test("Ajustes guarda los desplegables del CRM y la página del CRM los recibe", async () => {
  const r = await fetch(`${base}/panel/ajustes/crm`, {
    method: "POST",
    headers: auth,
    redirect: "manual",
    body: new URLSearchParams({ lista_que_le_ocurre: "Dolor de rodilla\nQuiere ganar fuerza", lista_hablar_por: "Instagram\nWhatsApp" }),
  });
  assert.equal(r.status, 303);
  const d = await (await fetch(`${base}/panel/crm/api/datos?anio=2026`, { headers: auth })).json();
  assert.deepEqual(d.opciones.LISTAS.que_le_ocurre, ["Dolor de rodilla", "Quiere ganar fuerza"]);
  assert.match(await (await fetch(`${base}/panel/ajustes`, { headers: auth })).text(), /Quiere ganar fuerza/);
});
