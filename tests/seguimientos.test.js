// Seguimientos automáticos (8 h y ~24 h) y contactos que llegan por un disparador de ManyChat. Sin servicios reales.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearTareas, ahoraLocal } from "../src/tareas.js";
import { crearOrquestador } from "../src/orquestador.js";
import { usarTextoDePrueba } from "../src/cerebro/llm.js";
import { revisarSeguimiento } from "../src/cerebro/reglas.js";

Object.assign(config, { modoPrueba: false, entrada: "manychat" });

const HORA = 3600000;
let almacen, enviados, etiquetas, tareas, orq, pedidos;
const manychat = {
  infoContacto: async (id) => ({ manychatId: String(id), nombre: "Laura Pérez", igUsuario: "laura", igId: "", etiquetas: etiquetas[id] ?? [], enlaceChat: "" }),
  enviarTextos: async (id, burbujas) => void enviados.push({ id, burbujas }),
};
const log = { info() {}, error() {} };

beforeEach(() => {
  almacen = new AlmacenSqlite(":memory:");
  enviados = [];
  etiquetas = {};
  pedidos = [];
  usarTextoDePrueba(async (mensajes) => (pedidos.push(mensajes[0].content), "Hola Laura, pudiste leer mi último mensaje?"));
  tareas = crearTareas({ almacen, manychat, enviarEmail: async () => {}, log });
  orq = crearOrquestador({ almacen, manychat, enviarEmail: async () => {}, log });
});

function conversacionSinRespuesta(horas, extra = {}) {
  const conv = almacen.obtenerOCrear({ id: "c1" });
  Object.assign(conv, { manychatId: "1", nombre: "Laura", estado: "descubriendo", ...extra });
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola, quería información" }, { rol: "bot", tipo: "texto", texto: "Hola Laura! Qué te ocurre?" });
  conv.ultimoMensajeLeadAt = new Date(Date.now() - horas * HORA).toISOString();
  almacen.guardar(conv);
  return conv;
}

const deDia = () => {
  const { hora } = ahoraLocal();
  return hora >= 9 && hora < 22;
};

test("a las 8 h sin respuesta envía el primer seguimiento (si es de día) y no lo repite", async (t) => {
  if (!deDia()) return t.skip("de noche no se envía el de las 8 h");
  conversacionSinRespuesta(8.2);
  await tareas.seguimientosAutomaticos();
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 1);
  assert.match(pedidos[0], /8 horas/);
  assert.ok(almacen.obtener("c1").seguimientos.s0);
});

test("antes de 8 h no envía nada", async () => {
  conversacionSinRespuesta(5);
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 0);
});

test("a las 22 h todavía no envía el de las 24 h (nunca antes de 23 h)", async () => {
  const conv = conversacionSinRespuesta(22.5);
  conv.seguimientos.s0 = new Date(Date.now() - 14 * HORA).toISOString();
  almacen.guardar(conv);
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 0);
});

test("a las 23 h envía el de las 24 h aunque ya se enviara el de las 8 h", async () => {
  const conv = conversacionSinRespuesta(23.1);
  conv.seguimientos.s0 = new Date(Date.now() - 14 * HORA).toISOString();
  almacen.guardar(conv);
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 1);
  assert.match(pedidos[0], /24 horas/);
});

test("pasadas 23,5 h ya no escribe (ventana de 24 h de Meta)", async () => {
  conversacionSinRespuesta(23.8);
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 0);
});

test("no escribe si en ManyChat tiene la etiqueta ALUMNO o IA_PAUSA", async (t) => {
  if (!deDia()) return t.skip("de noche no se envía el de las 8 h");
  conversacionSinRespuesta(8.5);
  etiquetas["1"] = ["IA_PAUSA"];
  await tareas.seguimientosAutomaticos();
  assert.equal(enviados.length, 0);
  assert.equal(almacen.obtener("c1").pausa.motivo, "etiqueta");
});

test("disparador de ManyChat: crea la conversación y programa los seguimientos", async () => {
  const conv = await orq.registrarContactoManychat({ subscriberId: "77", origen: "recurso", recurso: "GUIA" });
  assert.equal(conv.origen, "recurso");
  assert.equal(conv.historial.at(-1).tipo, "automatico");
  assert.match(conv.historial.at(-1).texto, /GUIA/);
  assert.ok(Date.now() - Date.parse(conv.ultimoMensajeLeadAt) < 5000);
  assert.deepEqual(conv.seguimientos, { s0: null, s1: null, s2: null, s3: null });
});

test("disparador de ManyChat a un ALUMNO: no se le hará seguimiento", async () => {
  etiquetas["78"] = ["ALUMNO"];
  const conv = await orq.registrarContactoManychat({ subscriberId: "78", origen: "recurso", recurso: "GUIA" });
  assert.equal(conv.pausa.motivo, "alumno");
});

test("disparador: el seguimiento habla del recurso y no entra en el email del dueño", async (t) => {
  const conv = await orq.registrarContactoManychat({ subscriberId: "79", origen: "recurso", recurso: "GUIA" });
  conv.ultimoMensajeLeadAt = new Date(Date.now() - 8.5 * HORA).toISOString();
  almacen.guardar(conv);
  if (deDia()) {
    await tareas.seguimientosAutomaticos();
    assert.match(pedidos[0], /solo le llegó el recurso automático/);
  }
  conv.ultimoMensajeLeadAt = new Date(Date.now() - 80 * HORA).toISOString();
  almacen.guardar(conv);
  assert.equal(await tareas.emailSeguimientos(), 0);
});

test("el seguimiento le dice a la IA el tiempo real que ha pasado", async (t) => {
  if (!deDia()) return t.skip("de noche no se envía el de las 8 h");
  conversacionSinRespuesta(8.3);
  await tareas.seguimientosAutomaticos();
  assert.match(pedidos[0], /han pasado 8 horas/);
  assert.match(pedidos[0], /NO uses "estos días"/);
});

test("informe de dudas: junta solo lo que escribieron los leads en 7 días, sin nombres", async () => {
  const { recogerMensajesSemana } = await import("../src/avisos/informeDudas.js");
  const ahora = Date.now();
  const convs = [
    { nombre: "Laura", igUsuario: "laura", ficha: { situacion: "quiere perder peso" }, historial: [
      { rol: "lead", tipo: "texto", texto: "Esto funciona si ya lo he probado todo?", fecha: new Date(ahora - 2 * 24 * HORA).toISOString() },
      { rol: "bot", tipo: "texto", texto: "Te cuento", fecha: new Date(ahora).toISOString() },
      { rol: "lead", tipo: "texto", texto: "Mensaje viejo", fecha: new Date(ahora - 9 * 24 * HORA).toISOString() },
    ] },
    { nombre: "Sin MD", historial: [{ rol: "bot", tipo: "automatico", texto: "[recurso]", fecha: new Date(ahora).toISOString() }] },
  ];
  const { texto, personas } = recogerMensajesSemana(convs, ahora);
  assert.equal(personas, 1);
  assert.match(texto, /Esto funciona si ya lo he probado todo\?/);
  assert.doesNotMatch(texto, /Mensaje viejo|Te cuento|Laura|laura/);
});

test("revisarSeguimiento: quita signos de apertura y descarta precios o enlaces", () => {
  assert.equal(revisarSeguimiento("¿Hola Laura, pudiste verlo?"), "Hola Laura, pudiste verlo?");
  assert.equal(revisarSeguimiento("Hola! El programa cuesta 900 €"), null);
  assert.equal(revisarSeguimiento("Mira esto https://ejemplo.com"), null);
});
