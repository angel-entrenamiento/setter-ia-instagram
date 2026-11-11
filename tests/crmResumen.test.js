// Resumen del CRM: semáforos, embudo, evolución semanal y botón de bienvenidas. Sin servicios reales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearCrm } from "../src/crm/index.js";
import { calcularMetricas, evolucionSemanal, registroDiario, semaforo, lunesDe, METAS } from "../src/crm/metricas.js";

const diaEn = (fecha) => fecha.toISOString().slice(0, 10);
const lead = (fecha, n = 1) => Array.from({ length: n }, () => ({ rol: "lead", texto: "hola", fecha }));
const conv = (id, origen, fecha, mensajes = 1, extra = {}) => ({ id, origen, estado: "descubriendo", historial: lead(fecha, mensajes), ...extra });

const base = {
  conversaciones: [
    conv("a", "bienvenida", "2026-11-03T10:00:00Z", 1),
    conv("b", "bienvenida", "2026-11-04T10:00:00Z", 4, { estado: "cualificado" }),
    conv("c", "bienvenida", "2026-11-05T10:00:00Z", 3, { estado: "propuesta_llamada" }),
    conv("d", "espontaneo", "2026-11-05T10:00:00Z", 5, { estado: "cualificado" }),
    conv("e", "bienvenida", "2026-10-01T10:00:00Z", 3), // fuera del periodo
    conv("panel:prueba", "bienvenida", "2026-11-05T10:00:00Z", 3), // simulador del panel
    conv("f", "bienvenida", "2026-11-05T10:00:00Z", 3, { igUsuario: "pruebas" }), // cuenta de prueba
    { id: "g", origen: "bienvenida", estado: "nuevo", historial: [{ rol: "dueno", texto: "¡Bienvenida!", fecha: "2026-11-05T10:00:00Z" }] }, // sin respuesta
  ],
  kpis: {
    "2026-11-03": { outbound: 10 },
    "2026-11-04": { outbound: 5, inbound: 2, agendadas_inbound: 1 },
    "2026-11-05": { agendadas_outbound: 1 },
    "2026-10-01": { outbound: 100 },
  },
  entrevistas: [
    { procedencia: "Outbound", fecha_entrevista: "2026-11-06", presentado: 1, entra: 1, periodo: "2026-11" },
    { procedencia: "Inbound MD", fecha_entrevista: "2026-11-07", presentado: 1, entra: 0, periodo: "2026-11" },
    { procedencia: "Outbound", periodo: "2026-09" }, // fuera del periodo
  ],
  diaEn,
  esPrueba: (c) => c.igUsuario === "pruebas",
};

test("semáforo frente a la meta", () => {
  assert.equal(semaforo(25, METAS.respuesta), "verde");
  assert.equal(semaforo(20, METAS.respuesta), "verde");
  assert.equal(semaforo(15, METAS.respuesta), "amarillo");
  assert.equal(semaforo(5, METAS.respuesta), "rojo");
  assert.equal(semaforo(null, METAS.respuesta), "sin_datos");
});

test("métricas del periodo: tarjetas, embudo y outbound frente a inbound", () => {
  const m = calcularMetricas({ ...base, gastoUsd: 3, desde: "2026-11-01", hasta: "2026-11-30" });
  assert.deepEqual(m.embudo.map((p) => p.valor), [15, 3, 2, 2, 1, 1, 1, 1]);
  assert.equal(m.tarjetas.respuesta.valor, 20);
  assert.equal(m.tarjetas.respuesta.semaforo, "verde");
  assert.equal(m.tarjetas.conversaciones.valor, 13.3);
  assert.equal(m.tarjetas.citas.valor, 6.7);
  assert.equal(m.tarjetas.cierre.valor, 50); // 1 cliente de 2 llamadas realizadas
  assert.deepEqual(m.origen.inbound, { entradas: 2, conversaciones: 1, cualificados: 1, propuestas: 1, citas: 1 });
  assert.equal(m.presentados, 2);
  assert.equal(m.costePorCita, 1.5);
});

test("más respuestas que bienvenidas apuntadas: aviso de que faltan bienvenidas, sin semáforo verde", () => {
  const m = calcularMetricas({ ...base, kpis: { "2026-11-02": { outbound: 1 } }, desde: "2026-11-01", hasta: "2026-11-30" });
  assert.ok(m.tarjetas.respuesta.a > m.tarjetas.respuesta.b);
  for (const k of ["respuesta", "conversaciones", "citas"]) {
    assert.equal(m.tarjetas[k].faltanBienvenidas, true);
    assert.equal(m.tarjetas[k].semaforo, "sin_datos");
  }
  assert.equal(m.tarjetas.citasInbound.faltanBienvenidas, undefined);
});

test("sin bienvenidas apuntadas, los porcentajes quedan sin datos (no 0 %)", () => {
  const m = calcularMetricas({ ...base, kpis: {}, desde: "2026-11-01", hasta: "2026-11-30" });
  assert.equal(m.tarjetas.respuesta.valor, null);
  assert.equal(m.tarjetas.respuesta.semaforo, "sin_datos");
});

test("registro diario por vía y panel lateral", () => {
  const entrevistas = [
    ...base.entrevistas,
    // propuesta por el setter el 3 de noviembre; Jorge puso la fecha el 4 (para el 20): aún no se ha hecho
    { procedencia: "Outbound", creada: Date.parse("2026-11-03T09:00:00Z"), _agendadaEn: "2026-11-04", fecha_entrevista: "2026-11-20", periodo: "2026-11" },
  ];
  const r = registroDiario({ ...base, entrevistas, mes: "2026-11", hoy: "2026-11-10" });
  const dia = (d) => r.dias.find((x) => x.dia === d);
  assert.deepEqual(dia("2026-11-03").bienvenida, { conversaciones: 10, respuesta: 10, respondieron: 1, contactos: 0, propuestas: 1, agendadas: 0 });
  assert.equal(dia("2026-11-04").bienvenida.agendadas, 1);
  assert.equal(dia("2026-11-04").inbound.conversaciones, 2);
  assert.equal(dia("2026-11-04").inbound.respuesta, null);
  assert.equal(r.total.bienvenida.conversaciones, 15);
  assert.equal(r.total.bienvenida.respuesta, 20);
  assert.equal(r.total.general.conversaciones, 17);
  assert.equal(r.total.general.agendadas, 3);
  const L = r.lateral.mensual;
  assert.deepEqual(L.outbound, { entradas: 15, agendadas: 2, induccion: 13.3 });
  assert.deepEqual(L.llamadas, { total: 2, realizadas: 2, cerradas: 1, cierre: 50, aparicion: 100, noPresentadas: 0, sinMarcar: 0, asistencia: 100 }); // la del día 20 aún no cuenta
  assert.equal(r.lateral.trimestral.nombre, "4º trimestre 2026");
  assert.equal(r.lateral.anual.outbound.entradas, 115);
});

test("evolución semanal: 12 semanas de lunes a domingo", () => {
  assert.equal(lunesDe("2026-11-08"), "2026-11-02"); // domingo → lunes anterior
  const s = evolucionSemanal({ ...base, hoy: "2026-11-08", semanas: 12 });
  assert.equal(s.length, 12);
  assert.equal(s.at(-1).semana, "2026-11-02");
  assert.equal(s.at(-1).bienvenidas, 15);
  assert.equal(s.at(-1).respuesta, 20);
  assert.equal(s.at(-1).citas, 2);
  assert.equal(s.at(-2).respuesta, null);
});

test("API: el botón suma bienvenidas al día y el resumen las usa", async () => {
  const almacen = new AlmacenSqlite(":memory:");
  const crm = crearCrm({ db: almacen.db, conversaciones: () => almacen.todas(), log: { error() {} } });
  const llamar = async (ruta, metodo = "GET", cuerpo) => {
    let salida;
    const url = new URL("http://x" + ruta);
    const req = { method: metodo };
    await crm.manejar(req, null, url.pathname, {
      url,
      leerCuerpo: async () => Buffer.from(cuerpo ? JSON.stringify(cuerpo) : ""),
      responder: (_res, codigo, datos) => (salida = { codigo, datos }),
    });
    return salida;
  };
  assert.equal((await llamar("/panel/crm/api/bienvenidas", "POST", { cantidad: 30, fecha: "2026-11-05" })).datos.outbound, 30);
  assert.equal((await llamar("/panel/crm/api/bienvenidas", "POST", { cantidad: 12, fecha: "2026-11-05" })).datos.outbound, 42);
  assert.equal((await llamar("/panel/crm/api/bienvenidas", "POST", { cantidad: "hola" })).codigo, 400);
  const r = await llamar("/panel/crm/api/resumen?desde=2026-11-01&hasta=2026-11-30");
  assert.equal(r.codigo, 200);
  assert.equal(r.datos.metricas.embudo[0].valor, 42);
  assert.equal(r.datos.semanal.length, 12);
  const reg = await llamar("/panel/crm/api/registro?mes=2026-11");
  assert.equal(reg.datos.total.bienvenida.conversaciones, 42);
});

test("poner la fecha de una entrevista la marca como agendada ese día", () => {
  const almacen = new AlmacenSqlite(":memory:");
  const crm = crearCrm({ db: almacen.db, log: { error() {} } });
  const f = crm.almacen.crearFila("entrevista", "2026-11", { procedencia: "Outbound" });
  const hoy = crm.datos("2026").hoy;
  assert.equal(crm.actualizarEntrevista(f.id, { fecha_entrevista: "2026-12-01" })._agendadaEn, hoy);
  assert.equal(crm.actualizarEntrevista(f.id, { fecha_entrevista: "2026-12-02" })._agendadaEn, hoy); // no cambia al mover la fecha
  assert.equal(crm.actualizarEntrevista(f.id, { fecha_entrevista: "" })._agendadaEn, null);
});

test("Te toca a ti: leads esperando, llamadas sin fecha, sin marcar y sin decidir", async () => {
  const { calcularPendientes } = await import("../src/crm/pendientes.js");
  const ahora = Date.parse("2026-11-10T18:00:00Z");
  const hace = (h) => new Date(ahora - h * 3600000).toISOString();
  const p = calcularPendientes({
    ahora,
    hoy: "2026-11-10",
    esPrueba: (c) => c.igUsuario === "pruebas",
    conversaciones: [
      { id: "a", nombre: "Ana", pausa: { motivo: "humano" }, ultimoMensajeLeadAt: hace(22), historial: [{ rol: "lead", texto: "¿Me llamas?" }] },
      { id: "b", nombre: "Bea", pausa: { motivo: "agendar" }, ultimoMensajeLeadAt: hace(2), historial: [{ rol: "lead", texto: "por la tarde" }] },
      { id: "c", nombre: "Carla", pausa: { motivo: "humano" }, historial: [{ rol: "lead", texto: "hola" }, { rol: "dueno", texto: "te llamo" }] }, // ya contestó el dueño
      { id: "d", nombre: "Dani", pausa: { motivo: "etiqueta" }, historial: [{ rol: "lead", texto: "hola" }] }, // pausada a propósito
      { id: "e", nombre: "Eva", pausa: null, historial: [{ rol: "lead", texto: "hola" }] }, // la atiende el asistente
      { id: "f", igUsuario: "pruebas", pausa: { motivo: "humano" }, historial: [{ rol: "lead", texto: "hola" }] },
    ],
    entrevistas: [
      { id: 1, nombre: "Bea", convId: "b", creada: ahora - 86400000 }, // ya sale arriba (esperando)
      { id: 2, nombre: "Fran", creada: ahora - 3 * 86400000 },
      { id: 3, nombre: "Gema", estado: "No hablar" },
      { id: 4, nombre: "Hugo", fecha_entrevista: "2026-11-09" },
      { id: 5, nombre: "Iris", fecha_entrevista: "2026-11-12" }, // aún no ha pasado
      { id: 6, nombre: "Juan", fecha_entrevista: "2026-11-08", presentado: 1 },
      { id: 7, nombre: "Kim", fecha_entrevista: "2026-11-08", presentado: 1, entra: 1 },
      { id: 8, nombre: "Luz", fecha_entrevista: "2026-11-07", no_presentado: 1 },
    ],
  });
  assert.deepEqual(p.esperan.map((e) => [e.convId, e.quedan]), [["a", 2], ["b", 22]]);
  assert.equal(p.esperan[1].que, "Quiere la llamada: proponle día y hora");
  assert.deepEqual(p.sinFecha.map((f) => [f.nombre, f.dias]), [["Fran", 3]]);
  assert.deepEqual(p.sinMarcar.map((f) => f.nombre), ["Hugo"]);
  assert.deepEqual(p.sinDecidir.map((f) => f.nombre), ["Juan"]);
  assert.equal(p.total, 5);
});

test("tablero de leads: cada persona en la etapa más avanzada a la que llegó", async () => {
  const { calcularLeads, etapaDe } = await import("../src/crm/leads.js");
  assert.equal(etapaDe({ historial: lead("x", 1) }), "respondieron");
  assert.equal(etapaDe({ historial: lead("x", 3) }), "conversaciones");
  assert.equal(etapaDe({ estado: "fuera_de_foco", historial: lead("x", 5) }), "descartados");
  assert.equal(etapaDe({}, { fecha_entrevista: "2026-11-20" }), "agendadas");
  assert.equal(etapaDe({}, { presentado: 1, entra: 1 }), "clientes");
  assert.equal(etapaDe({}, { no_presentado: 1 }), "descartados");
  const r = calcularLeads({ ...base, desde: "2026-11-01", hasta: "2026-11-30", ahora: Date.parse("2026-11-10T00:00:00Z"),
    entrevistas: [{ convId: "c", fecha_entrevista: "2026-11-20" }] });
  assert.deepEqual(Object.fromEntries(r.leads.map((l) => [l.convId, l.etapa])), { a: "respondieron", b: "cualificados", c: "agendadas", d: "cualificados" });
  assert.equal(r.porEtapa.cualificados, 2);
  assert.equal(r.leads.find((l) => l.convId === "a").via, "bienvenida");
});

test("registro: cada periodo trae el anterior para comparar", () => {
  const r = registroDiario({ ...base, mes: "2026-11", hoy: "2026-11-10" });
  assert.equal(r.lateral.mensual.anterior.mes, "2026-10");
  assert.equal(r.lateral.mensual.anterior.outbound.entradas, 100);
  assert.equal(r.lateral.trimestral.anterior.nombre, "3º trimestre 2026");
  assert.equal(r.lateral.anual.anterior.nombre, "2025");
});

test("email de los lunes: semáforos frente a las metas y la semana anterior", async () => {
  const { construirEmailResumenSemanal } = await import("../src/avisos/emails.js");
  const actual = calcularMetricas({ ...base, desde: "2026-11-01", hasta: "2026-11-30" });
  const e = construirEmailResumenSemanal({}, { desde: new Date(), hasta: new Date(), costeUsd: 1, crm: { actual, anterior: actual, pendientes: 2 } });
  assert.match(e.cuerpo, /Respuesta a bienvenidas: 20 % \(semana anterior: 20 %\) · 3 de 15 bienvenidas · meta 20 % · 🟢 en la meta/);
  assert.match(e.cuerpo, /Tienes 2 cosas pendientes/);
  assert.doesNotMatch(construirEmailResumenSemanal({}, { desde: new Date(), hasta: new Date() }).cuerpo, /METAS/);
});

test("métricas del tutor: agendas outbound e inbound por separado y % de llamadas que se realizan", () => {
  const m = calcularMetricas({ ...base, desde: "2026-11-01", hasta: "2026-11-30" });
  // Inbound + palabra clave: 1 agendada de 2 entradas
  assert.equal(m.tarjetas.citasInbound.valor, 50);
  assert.equal(m.tarjetas.citasInbound.semaforo, "verde");
  assert.equal(m.tarjetas.citas.semaforo, "verde"); // 6,7 % outbound (meta 1-3 %)
  assert.equal(semaforo(0.8, METAS.citas), "amarillo");
  // Asistencia: solo cuentan las llamadas ya marcadas; si fallan más del 20 %, rojo
  const entrevistas = [
    { procedencia: "Outbound", fecha_entrevista: "2026-11-06", presentado: 1, periodo: "2026-11" },
    { procedencia: "Outbound", fecha_entrevista: "2026-11-07", presentado: 1, periodo: "2026-11" },
    { procedencia: "Outbound", fecha_entrevista: "2026-11-08", no_presentado: 1, periodo: "2026-11" },
    { procedencia: "Outbound", fecha_entrevista: "2026-11-09", periodo: "2026-11" }, // sin marcar: no cuenta
  ];
  const a = calcularMetricas({ ...base, entrevistas, desde: "2026-11-01", hasta: "2026-11-30" }).tarjetas.asistencia;
  assert.deepEqual([a.valor, a.a, a.b, a.sinMarcar, a.semaforo], [66.7, 2, 3, 1, "rojo"]);
  const bien = calcularMetricas({ ...base, entrevistas: entrevistas.slice(0, 2), desde: "2026-11-01", hasta: "2026-11-30" }).tarjetas.asistencia;
  assert.equal(bien.semaforo, "verde");
});

test("conversaciones activas: escribieron hace 7 días o menos y aún sin cita ni descarte", async () => {
  const { conversacionesActivas } = await import("../src/crm/leads.js");
  const ahora = Date.parse("2026-11-10T12:00:00Z");
  const r = conversacionesActivas({
    conversaciones: [
      conv("a", "bienvenida", "2026-11-09T10:00:00Z", 2),
      conv("b", "espontaneo", "2026-11-05T10:00:00Z", 4),
      conv("c", "bienvenida", "2026-10-20T10:00:00Z", 3), // lleva días sin escribir
      conv("d", "bienvenida", "2026-11-09T10:00:00Z", 3, { estado: "fuera_de_foco" }), // descartado
      conv("e", "bienvenida", "2026-11-09T10:00:00Z", 3), // ya tiene cita
      conv("f", "bienvenida", "2026-11-09T10:00:00Z", 3, { igUsuario: "pruebas" }),
    ],
    entrevistas: [{ convId: "e", fecha_entrevista: "2026-11-12" }],
    ahora,
    esPrueba: base.esPrueba,
  });
  assert.equal(r.total, 2);
  assert.deepEqual(r.porVia, { bienvenida: 1, lead_magnet: 0, inbound: 1 });
});

test("objetivo semanal de agendas: se guarda como nota y cuenta las de lunes a hoy", async () => {
  const crm = crearCrm({ db: new AlmacenSqlite(":memory:").db, zonaHoraria: "UTC", conversaciones: () => [], log: { error() {} } });
  assert.equal(crm.objetivoSemanal().objetivo, null);
  crm.almacen.fijarNota("objetivo_agendas_semana", "5");
  const hoy = new Date().toISOString().slice(0, 10);
  crm.almacen.crearFila("entrevista", hoy.slice(0, 7), { procedencia: "Outbound", fecha_entrevista: hoy, _agendadaEn: hoy });
  const o = crm.objetivoSemanal();
  assert.equal(o.objetivo, 5);
  assert.equal(o.llevas, 1);
  assert.equal(o.semana, lunesDe(hoy));
  assert.equal(crm.resumen().objetivo.objetivo, 5);
});

test("email de los lunes: objetivo semanal, agendas inbound y aviso si fallan más del 20 % de las llamadas", async () => {
  const { construirEmailResumenSemanal } = await import("../src/avisos/emails.js");
  const entrevistas = [
    { procedencia: "Outbound", fecha_entrevista: "2026-11-06", presentado: 1, periodo: "2026-11" },
    { procedencia: "Outbound", fecha_entrevista: "2026-11-08", no_presentado: 1, periodo: "2026-11" },
  ];
  const actual = calcularMetricas({ ...base, entrevistas, desde: "2026-11-01", hasta: "2026-11-30" });
  const e = construirEmailResumenSemanal({}, { desde: new Date(), hasta: new Date(), crm: { actual, anterior: null, pendientes: 0, objetivo: 5 } });
  assert.match(e.cuerpo, /Agendas de la semana: 2 de tu objetivo de 5 · te faltaron 3/);
  assert.match(e.cuerpo, /Agendas inbound \(te escriben o palabra clave\): 0 % · 0 de 2 · meta 30-50 % · 🔴/);
  assert.match(e.cuerpo, /no se presentaron 1 de 2 llamadas \(más del 20 %\)/);
});

test("punto débil: el primer paso en rojo del camino; si no hay, el primero en amarillo", async () => {
  const { puntoDebil } = await import("../src/crm/metricas.js");
  const t = (semaforo, valor = 1) => ({ semaforo, valor });
  assert.equal(puntoDebil({}), null);
  assert.deepEqual(puntoDebil({ respuesta: t("verde"), citas: t("verde") }), { estado: "bien" });
  const p = puntoDebil({ respuesta: t("amarillo", 15), conversaciones: t("verde"), citas: t("rojo", 0.3), asistencia: t("rojo", 50) });
  assert.equal(p.clave, "citas");
  assert.equal(p.etapa, "cualificados");
  assert.equal(puntoDebil({ respuesta: t("amarillo", 15), citas: t("sin_datos", null) }).clave, "respuesta");
  assert.ok(calcularMetricas({ ...base, desde: "2026-11-01", hasta: "2026-11-30" }).puntoDebil);
});

test("embudo por vía: bienvenidas, palabra clave, te escriben y todas", () => {
  const m = calcularMetricas({ ...base, desde: "2026-11-01", hasta: "2026-11-30" });
  const v = (via) => m.embudos[via].map((p) => p.valor);
  assert.deepEqual(v("bienvenida"), m.embudo.map((p) => p.valor));
  assert.deepEqual(v("inbound"), [2, 2, 1, 1, 1, 1, 1, 0]);
  assert.equal(m.embudos.todas[0].valor, 17);
});
