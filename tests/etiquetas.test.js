// Etiquetas de ManyChat a las que el asistente no contesta (ALUMNO por defecto; cada uno añade las suyas en Ajustes).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearOrquestador } from "../src/orquestador.js";
import { crearTareas } from "../src/tareas.js";
import { negocio, NEGOCIO_POR_DEFECTO, etiquetasNoResponder, tieneEtiquetaNoResponder } from "../src/negocio.js";
import { usarGeneradorDePrueba, usarTextoDePrueba } from "../src/cerebro/llm.js";
import { FICHA_VACIA } from "../src/cerebro/esquema.js";

Object.assign(config, { modoPrueba: false, entrada: "manychat" });
const log = { info() {}, error() {} };
let almacen, enviados, emails, etiquetas, orq;
const manychat = {
  infoContacto: async (id) => ({ manychatId: String(id), igUsuario: `u${id}`, igId: `IG${id}`, etiquetas: etiquetas[id] ?? [], enlaceChat: "" }),
  enviarTextos: async (id, b) => void enviados.push({ id, b }),
};
usarGeneradorDePrueba(async () => ({ mensajes: ["Hola!"], estado: "descubriendo", accion: "ninguna", ficha: { ...FICHA_VACIA }, nota_interna: "" }));

beforeEach(() => {
  Object.assign(negocio, NEGOCIO_POR_DEFECTO, { nombreAsistente: "Alex", etiquetasNoResponder: "ALUMNO, (CLIENTES), amigos" });
  almacen = new AlmacenSqlite(":memory:");
  enviados = [];
  emails = [];
  etiquetas = {};
  orq = crearOrquestador({ almacen, manychat, enviarEmail: async (e) => void emails.push(e), log });
});

async function escribe(id, texto = "Hola!") {
  await orq.recibirMensajeManychat({ subscriberId: id, texto });
  const c = almacen.obtener(`IG${id}`);
  c.procesarEn = Date.now();
  almacen.guardar(c);
  await orq.procesarVencidos({ esperar: true });
  return almacen.obtener(`IG${id}`);
}

test("la lista se escribe a mano: mayúsculas, comas y sin paréntesis", () => {
  assert.deepEqual(etiquetasNoResponder(), ["ALUMNO", "CLIENTES", "AMIGOS"]);
  assert.equal(tieneEtiquetaNoResponder(["VIP", "AMIGOS"]), true);
  assert.equal(tieneEtiquetaNoResponder(["VIP"]), false);
});

test("a quien tiene AMIGOS o CLIENTES no le contesta y avisa una vez; al resto sí", async () => {
  etiquetas[1] = ["AMIGOS"];
  etiquetas[2] = ["CLIENTES"];
  const c1 = await escribe(1);
  await escribe(2);
  await escribe(3);
  assert.deepEqual(enviados.map((e) => e.id), ["3"]);
  assert.equal(c1.pausa.motivo, "alumno");
  assert.equal(emails.filter((e) => e.etiqueta === "HUMANO").length, 2);
  await escribe(1, "otra cosa");
  assert.equal(emails.filter((e) => e.etiqueta === "HUMANO").length, 2, "no repite el aviso en 12 h");
});

test("si se quita la etiqueta en ManyChat, vuelve a contestar; y el aviso se puede desactivar", async () => {
  negocio.avisarEtiquetasNoResponder = false;
  etiquetas[4] = ["AMIGOS"];
  await escribe(4);
  assert.equal(enviados.length, 0);
  assert.equal(emails.length, 0, "aviso desactivado");
  etiquetas[4] = [];
  await escribe(4, "hola de nuevo");
  assert.equal(enviados.length, 1);
});

test("tampoco le hace seguimientos", async () => {
  usarTextoDePrueba(async () => "Hola, pudiste verlo?");
  try {
    const c = almacen.obtenerOCrear({ id: "IG5" });
    Object.assign(c, { manychatId: "5", estado: "descubriendo", ultimoMensajeLeadAt: new Date(Date.now() - 23.2 * 3600000).toISOString() });
    c.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" }, { rol: "bot", tipo: "texto", texto: "Hola! Qué tal?" });
    almacen.guardar(c);
    etiquetas[5] = ["CLIENTES"];
    await crearTareas({ almacen, manychat, enviarEmail: async () => {}, log }).seguimientosAutomaticos();
    assert.equal(enviados.length, 0);
    assert.equal(almacen.obtener("IG5").pausa.motivo, "alumno");
  } finally {
    usarTextoDePrueba(null);
  }
});

test("con etiquetas propias para pausar y reactivar (PAUSAR_BOT / ACTIVAR_BOT) funciona igual", async () => {
  const quitadas = [];
  manychat.quitarEtiqueta = async (id, e) => void quitadas.push(e);
  Object.assign(negocio, { etiquetaPausa: "pausar_bot", etiquetaReactivar: "(ACTIVAR_BOT)" });
  etiquetas[6] = ["IA_PAUSA"]; // la de por defecto ya no cuenta
  await escribe(6);
  assert.equal(enviados.length, 1);
  etiquetas[6] = ["PAUSAR_BOT"];
  await escribe(6, "sigo aquí");
  assert.equal(enviados.length, 1, "pausado con su etiqueta");
  assert.equal(almacen.obtener("IG6").pausa.motivo, "etiqueta");
  etiquetas[6] = ["PAUSAR_BOT", "ACTIVAR_BOT"];
  await escribe(6, "hola?");
  assert.equal(enviados.length, 2, "reactivado con su etiqueta");
  assert.deepEqual(quitadas.sort(), ["ACTIVAR_BOT", "PAUSAR_BOT"], "quita las dos en ManyChat con sus nombres");
});