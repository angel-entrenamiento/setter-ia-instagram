// Pruebas del motor que no llaman a la API (pausas, lista blanca, reset, audios, etiquetas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { negocio } from "../src/negocio.js";
import { conversacionNueva } from "../src/almacen/conversaciones.js";
import { procesarEvento, aplicarEtiqueta, historialAMensajes, MENSAJE_RESET, construirContexto } from "../src/motor.js";

config.modoPrueba = true;
config.listaBlanca = ["cuenta.prueba"];
Object.assign(negocio, { nombreAsistente: "Lucía", nombreDueno: "Marta" });

const nueva = (igUsuario = "cuenta.prueba") => conversacionNueva({ id: igUsuario, igUsuario, nombre: "Prueba" });

test("modo prueba: ignora a quien no está en la lista blanca (salvo en el simulador del panel)", async () => {
  const r = await procesarEvento(nueva("otra.persona"), { tipo: "texto", texto: "Hola" });
  assert.equal(r.ignorado, "modo_prueba");
  const conv = nueva("otra.persona");
  conv.pausa = { motivo: "agendar" }; // pausada para que no llame a la API
  const r2 = await procesarEvento(conv, { tipo: "texto", texto: "Hola" }, { simulacion: true });
  assert.equal(r2.ignorado, "pausada_agendar");
});

test("#reset borra historial, ficha, estado y pausas de la cuenta de pruebas", async () => {
  const conv = nueva();
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "hola" });
  conv.ficha.situacion = "algo";
  conv.estado = "propuesta_llamada";
  conv.pausa = { motivo: "agendar" };
  conv.etiquetas = ["IA_PAUSA"];
  const r = await procesarEvento(conv, { tipo: "texto", texto: "  #RESET " });
  assert.deepEqual(r.respuestas, [MENSAJE_RESET]);
  assert.equal(conv.historial.length, 0);
  assert.equal(conv.ficha.situacion, "");
  assert.equal(conv.estado, "nuevo");
  assert.equal(conv.pausa, null);
  assert.equal(conv.igUsuario, "cuenta.prueba");
});

test("#reset no funciona para cuentas fuera de la lista blanca (con el modo prueba apagado)", async () => {
  config.modoPrueba = false;
  try {
    const conv = nueva("lead.real");
    conv.pausa = { motivo: "agendar" };
    const r = await procesarEvento(conv, { tipo: "texto", texto: "#reset" });
    assert.equal(r.ignorado, "reset_no_autorizado");
  } finally {
    config.modoPrueba = true;
  }
});

test("audio del lead: pausa y email [AUDIO]; el dueño contesta con audio y se reanuda", async () => {
  const conv = nueva();
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" }, { rol: "bot", tipo: "texto", texto: "Hola!" });
  const r = await procesarEvento(conv, { tipo: "audio" });
  assert.equal(conv.pausa.motivo, "audio");
  assert.match(r.emails[0].asunto, /\[AUDIO\]/);
  assert.match(r.emails[0].cuerpo, /Lucía no lo ha contestado/);

  const r2 = await procesarEvento(conv, { tipo: "texto", texto: "¿lo has oído?" });
  assert.equal(r2.ignorado, "pausada_audio");

  await procesarEvento(conv, { tipo: "dueno_audio" });
  assert.equal(conv.pausa, null);

  await procesarEvento(conv, { tipo: "nota_audio", queDijo: "empieza en marzo", queContesto: "lo vemos en la llamada" });
  const todo = historialAMensajes(conv).map((m) => m.content).join("\n");
  assert.match(todo, /empieza en marzo/);
  assert.match(todo, /Marta respondió personalmente con un audio. Según su nota: lo vemos en la llamada/);
});

test("el dueño escribe por texto sin audio previo: el asistente sigue y lo tiene en cuenta", async () => {
  const conv = nueva();
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" });
  await procesarEvento(conv, { tipo: "dueno_texto", texto: "Hola! te leo" });
  assert.equal(conv.pausa, null);
  assert.match(historialAMensajes(conv).at(-1).content, /Marta personalmente.*te leo/);
  assert.match(conv.avisos.join(" "), /sin contradecirle/);
});

test("bienvenida manual antes de que escriba el lead: no pausa y no se presenta", async () => {
  const conv = nueva();
  await procesarEvento(conv, { tipo: "dueno_texto", texto: "Bienvenida! cuéntame qué te trae por aquí" });
  assert.equal(conv.pausa, null);
  assert.equal(conv.origen, "bienvenida");
  assert.equal(historialAMensajes(conv)[0].role, "user");
  assert.match(construirContexto(conv), /NO te presentes/);
});

test("la presentación respeta el ajuste de decir que es virtual", () => {
  const conv = nueva();
  negocio.decirVirtualAlPresentarse = true;
  assert.match(construirContexto(conv), /Lucía, el asistente virtual del equipo de Marta/);
  negocio.decirVirtualAlPresentarse = false;
  assert.match(construirContexto(conv), /Lucía, del equipo de Marta \(sin decir que eres virtual/);
  negocio.decirVirtualAlPresentarse = true;
});

test("tras [AGENDAR] el audio del dueño no reactiva: solo IA_ON", async () => {
  const conv = nueva();
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" });
  conv.pausa = { motivo: "agendar" };
  await procesarEvento(conv, { tipo: "dueno_audio" });
  assert.equal(conv.pausa.motivo, "agendar");
  aplicarEtiqueta(conv, "IA_ON");
  assert.equal(conv.pausa, null);
});

test("ALUMNO: nunca responde y avisa como mucho una vez cada 12 h", async () => {
  const conv = nueva();
  aplicarEtiqueta(conv, "ALUMNO");
  const r1 = await procesarEvento(conv, { tipo: "texto", texto: "Hola, duda" });
  const r2 = await procesarEvento(conv, { tipo: "texto", texto: "otra duda" });
  assert.equal(r1.ignorado, "alumno");
  assert.equal(r1.emails.length, 1);
  assert.equal(r2.emails.length, 0);
});

test("tras [AGENDAR], si el lead dice mañana o tarde se apunta y se avisa una vez", async () => {
  const { detectarFranja } = await import("../src/motor.js");
  assert.equal(detectarFranja("Me viene mejor por la mañana"), "mañana");
  assert.equal(detectarFranja("mañana por la tarde"), "tarde");
  assert.equal(detectarFranja("vale, gracias"), null);

  const conv = nueva();
  conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" });
  conv.pausa = { motivo: "agendar" };
  const r1 = await procesarEvento(conv, { tipo: "texto", texto: "Me viene mejor por la mañana" });
  assert.equal(r1.ignorado, "pausada_agendar");
  assert.equal(conv.ficha.preferencia_franja, "mañana");
  assert.match(r1.emails[0].asunto, /\[AGENDAR\].*prefiere mañana/);
  const r2 = await procesarEvento(conv, { tipo: "texto", texto: "sí, por la mañana mejor" });
  assert.equal(r2.emails.length, 0, "no repite el aviso si no cambia");
});

test("IA_PAUSA pausa y quitarla reactiva", () => {
  const conv = nueva();
  aplicarEtiqueta(conv, "IA_PAUSA");
  assert.equal(conv.pausa.motivo, "etiqueta");
  aplicarEtiqueta(conv, "IA_PAUSA", { quitar: true });
  assert.equal(conv.pausa, null);
});
