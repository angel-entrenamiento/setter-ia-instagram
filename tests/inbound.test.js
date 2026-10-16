// Conteo automático de INBOUND en el CRM y detección de la bienvenida manual por el alta en ManyChat.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearTareas, altaPrevia, ahoraLocal } from "../src/tareas.js";
import { crearCrm } from "../src/crm/index.js";
import { crearOrquestador } from "../src/orquestador.js";

Object.assign(config, { modoPrueba: false, listaBlanca: ["cuenta.prueba"], entrada: "manychat" });
const log = { info() {}, error() {} };
let almacen, crm, tareas;
const ahora = Date.now();
const iso = (minAntes) => new Date(ahora - minAntes * 60_000).toISOString();

beforeEach(() => {
  almacen = new AlmacenSqlite(":memory:");
  almacen.fijarAjuste("crm_desde", iso(60 * 24));
  crm = crearCrm({ db: almacen.db, zonaHoraria: () => config.zonaHoraria, conversaciones: () => almacen.todas(), log });
  tareas = crearTareas({ almacen, manychat: {}, enviarEmail: async () => {}, crm, log });
});

function nueva(id, { origen = "espontaneo", primero = "lead", presentado = true, ...extra } = {}) {
  const c = almacen.obtenerOCrear({ id });
  Object.assign(c, { origen, presentado, igUsuario: id, ...extra });
  if (primero === "bot") c.historial.push({ rol: "bot", tipo: "automatico", texto: "[recurso]", fecha: iso(1) });
  c.historial.push({ rol: "lead", tipo: "texto", texto: "Hola, quería información", fecha: iso(0) }, { rol: "bot", tipo: "texto", texto: "Hola!", fecha: iso(0) });
  almacen.guardar(c);
}
const inbound = () => crm.datos(ahoraLocal().dia.slice(0, 4)).kpis[ahoraLocal().dia]?.inbound ?? 0;

test("altaPrevia: el alta en ManyChat más de 5 min antes del primer mensaje = el dueño escribió antes", () => {
  const primero = { fecha: iso(0) };
  assert.equal(altaPrevia({ altaManychat: iso(1) }, primero), false, "escribe él: alta en el mismo minuto");
  assert.equal(altaPrevia({ altaManychat: iso(3), primerMensajeAt: iso(2) }, { fecha: iso(0) }), false, "se mide con la hora de llegada");
  assert.equal(altaPrevia({ altaManychat: iso(9 * 60) }, primero), true, "bienvenida 9 h antes");
  assert.equal(altaPrevia({ altaManychat: iso(-60) }, primero), false, "alta posterior (contacto rehecho) → cuenta");
  assert.equal(altaPrevia({}, primero), false, "sin dato de alta → cuenta");
});

test("cuenta a quien abre la conversación, una vez y en el día de su primer mensaje", () => {
  nueva("a");
  nueva("b", { origen: "historia" });
  nueva("c", { origen: "bienvenida" }); // contestó a la bienvenida → no
  nueva("d", { origen: "recurso", primero: "bot" }); // disparador de ManyChat → no
  nueva("cuenta.prueba"); // cuenta de pruebas → no
  nueva("e", { presentado: false }); // el asistente aún no le ha contestado → todavía no
  tareas.kpiInbound();
  tareas.kpiInbound();
  assert.equal(inbound(), 2);
  assert.ok(almacen.obtener("a").kpiInbound);
  assert.equal(almacen.obtener("c").kpiInbound, undefined);
});

test("no cuenta a quien ya estaba dado de alta en ManyChat (bienvenida escrita a mano)", () => {
  nueva("nuevo", { altaManychat: iso(1) });
  nueva("bienvenida", { altaManychat: iso(300) });
  tareas.kpiInbound();
  assert.equal(inbound(), 1);
  assert.ok(almacen.obtener("nuevo").kpiInbound);
  assert.equal(almacen.obtener("bienvenida").kpiInbound, undefined);
});

test("no rellena días pasados: solo conversaciones desde que existe el CRM", () => {
  almacen.fijarAjuste("crm_desde", new Date(ahora + 60_000).toISOString());
  nueva("antigua");
  tareas.kpiInbound();
  assert.equal(inbound(), 0);
});

test("orquestador: el alta de ManyChat y la hora de llegada se guardan; un disparador suma lead magnet", async () => {
  const manychat = { infoContacto: async (id) => ({ manychatId: String(id), igUsuario: `u${id}`, igId: `IG${id}`, etiquetas: [], alta: iso(400) }) };
  const orq = crearOrquestador({ almacen, manychat, enviarEmail: async () => {}, crm, log });
  await orq.recibirMensajeManychat({ subscriberId: 7, texto: "Hola" });
  const c = almacen.obtener("IG7");
  assert.equal(c.altaManychat, iso(400));
  assert.ok(Date.now() - Date.parse(c.primerMensajeAt) < 5000);
  await orq.registrarContactoManychat({ subscriberId: 8, origen: "recurso", recurso: "Guía" });
  assert.equal(crm.datos(ahoraLocal().dia.slice(0, 4)).kpis[ahoraLocal().dia].lead_magnet, 1);
});

test("cuando el asistente agenda (traspaso_agendar), la persona aparece en Entrevistas y suma una agendada", async () => {
  const { usarGeneradorDePrueba } = await import("../src/cerebro/llm.js");
  const { FICHA_VACIA } = await import("../src/cerebro/esquema.js");
  usarGeneradorDePrueba(async () => ({
    mensajes: ["Es gratuita y sin compromiso", "Te viene mejor por la mañana o por la tarde?"],
    estado: "propuesta_llamada",
    accion: "traspaso_agendar",
    ficha: { ...FICHA_VACIA, nombre: "Sara", situacion: "quiere ganar fuerza", encaja_perfil: "si", objetivo: "subir escaleras sin cansarse", prioridad_1a10: 9, dispuesto_implicarse: "si", decisor_economico: "ella", decisor_en_llamada: "no_hace_falta" },
    nota_interna: "",
  }));
  try {
    const manychat = { infoContacto: async (id) => ({ manychatId: String(id), igUsuario: "sara", igId: "IGS", etiquetas: [] }), enviarTextos: async () => {} };
    const orq = crearOrquestador({ almacen, manychat, enviarEmail: async () => {}, crm, log });
    await orq.recibirMensajeManychat({ subscriberId: 9, texto: "Hola, quiero información" });
    const c = almacen.obtener("IGS");
    c.procesarEn = Date.now();
    almacen.guardar(c);
    await orq.procesarVencidos({ esperar: true });
    const d = crm.datos(ahoraLocal().dia.slice(0, 4));
    assert.equal(d.kpis[ahoraLocal().dia].agendadas_inbound, 1);
    const fila = d.filas.find((x) => x.tabla === "entrevista");
    assert.equal(fila.nombre, "Sara @sara");
    assert.equal(fila.origen, "asistente");
    assert.match(fila.que_dice, /quiere ganar fuerza · Objetivo: subir escaleras/);
  } finally {
    usarGeneradorDePrueba(null);
  }
});