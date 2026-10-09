// Pruebas de integración del servidor SIN servicios reales: Meta, ManyChat, Gmail y la IA están simulados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearServidor } from "../src/servidor.js";
import { usarGeneradorDePrueba } from "../src/cerebro/llm.js";
import { FICHA_VACIA } from "../src/cerebro/esquema.js";
import { MENSAJE_RESET } from "../src/motor.js";
import { firmar } from "../src/utilidades/enlaces.js";
import { guardarNegocio, negocio } from "../src/negocio.js";

Object.assign(config, {
  entrada: "meta", // la mayoría de pruebas simulan la entrada por Meta; las de ManyChat la cambian
  metaAppSecret: "secreto-meta",
  metaVerifyToken: "verificame",
  tokenManychatEntrada: "token-mc",
  panelUsuario: "admin",
  panelClave: "clave-panel",
  secretoEnlaces: "secreto-enlaces",
  urlPublica: "https://setter.test",
});

// ---------- Simulaciones ----------
const contactosMC = {
  111: { manychatId: "111", nombre: "Prueba", igUsuario: "cuenta.prueba", igId: "IG_PRUEBA", etiquetas: [], enlaceChat: "https://mc/111" },
  222: { manychatId: "222", nombre: "Desconocido", igUsuario: "otra.persona", igId: "IG_OTRA", etiquetas: [], enlaceChat: "" },
  333: { manychatId: "333", nombre: "Prueba", igUsuario: "cuenta.prueba", igId: "", etiquetas: [], enlaceChat: "" },
};
const enviados = [];
const emails = [];
const manychat = {
  infoContacto: async (id) => structuredClone(contactosMC[id]),
  enviarTextos: async (id, burbujas) => void enviados.push({ id, burbujas }),
  ponerEtiqueta: async (id, e) => void contactosMC[id].etiquetas.push(e),
  quitarEtiqueta: async (id, e) => void (contactosMC[id].etiquetas = contactosMC[id].etiquetas.filter((x) => x !== e)),
};
usarGeneradorDePrueba(async () => ({
  mensajes: ["Hola! Soy Lucía, el asistente virtual del equipo de Marta 😊", "¿Qué te gustaría mejorar?"],
  estado: "descubriendo",
  accion: "ninguna",
  ficha: { ...FICHA_VACIA },
  nota_interna: "",
}));

let almacen, srv, base;
before(async () => {
  almacen = new AlmacenSqlite(":memory:");
  srv = crearServidor({ almacen, manychat, enviarEmail: async (e) => void emails.push(e) });
  guardarNegocio(almacen, { nombreAsistente: "Lucía", nombreDueno: "Marta", emailAvisos: "marta@ejemplo.com", modoPrueba: true, listaBlanca: "@cuenta.prueba" });
  await new Promise((r) => srv.servidor.listen(0, r));
  base = `http://127.0.0.1:${srv.servidor.address().port}`;
});
after(() => srv.servidor.close());

// ---------- Utilidades ----------
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
async function postMeta({ de, para = "BIZ", texto, tipo, eco = false }) {
  const message = { mid: `m${++n}`, ...(texto !== undefined ? { text: texto } : {}) };
  if (tipo) message.attachments = [{ type: tipo, payload: { url: "https://x" } }];
  if (eco) message.is_echo = true;
  const cuerpo = JSON.stringify({
    object: "instagram",
    entry: [{ id: "BIZ", messaging: [{ sender: { id: eco ? "BIZ" : de }, recipient: { id: eco ? de : para }, timestamp: Date.now(), message }] }],
  });
  const firma = `sha256=${crypto.createHmac("sha256", "secreto-meta").update(cuerpo).digest("hex")}`;
  const r = await fetch(`${base}/webhook/meta`, { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firma } });
  await espera(30);
  return r;
}
const postManychat = (cuerpo) =>
  fetch(`${base}/manychat/contacto`, { method: "POST", body: JSON.stringify(cuerpo), headers: { "x-token": "token-mc" } }).then(
    async (r) => (await espera(30), r),
  );
async function procesarYa(id) {
  const c = almacen.obtener(id);
  c.procesarEn = Date.now();
  almacen.guardar(c);
  await srv.orq.procesarVencidos({ esperar: true });
}

// ---------- Pruebas ----------
test("verificación del webhook de Meta", async () => {
  assert.equal(await (await fetch(`${base}/webhook/meta?hub.mode=subscribe&hub.verify_token=verificame&hub.challenge=42`)).text(), "42");
  assert.equal((await fetch(`${base}/webhook/meta?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42`)).status, 403);
});

test("rechaza avisos de Meta sin firma válida y peticiones de ManyChat sin token", async () => {
  assert.equal((await fetch(`${base}/webhook/meta`, { method: "POST", body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/manychat/contacto`, { method: "POST", body: "{}" })).status, 403);
});

test("flujo completo: ManyChat vincula, el lead escribe, el asistente responde y su eco se ignora", async () => {
  await postManychat({ subscriber_id: 111, origen: "info" });
  await postMeta({ de: "IG_PRUEBA", texto: "Hola, quería información" });
  const conv = almacen.obtener("IG_PRUEBA");
  assert.equal(conv.manychatId, "111");
  assert.equal(conv.bandeja.length, 1);
  assert.ok(conv.procesarEn > Date.now() + 20000, "espera para agrupar y retraso humano");

  await procesarYa("IG_PRUEBA");
  assert.equal(enviados.at(-1).id, "111");
  assert.equal(enviados.at(-1).burbujas.length, 2);

  for (const b of enviados.at(-1).burbujas) await postMeta({ de: "IG_PRUEBA", texto: b, eco: true });
  const despues = almacen.obtener("IG_PRUEBA");
  assert.equal(despues.historial.filter((m) => m.rol === "dueno").length, 0, "los ecos del asistente no cuentan como mensajes del dueño");
  assert.equal(despues.historial.filter((m) => m.rol === "bot").length, 2);
});

test("mensajes seguidos del lead se agrupan en una sola respuesta", async () => {
  const antes = enviados.length;
  await postMeta({ de: "IG_PRUEBA", texto: "quiero perder peso" });
  await postMeta({ de: "IG_PRUEBA", texto: "unos 10 kilos" });
  await postMeta({ de: "IG_PRUEBA", texto: "desde hace un año" });
  await procesarYa("IG_PRUEBA");
  assert.equal(enviados.length, antes + 1);
  const leads = almacen.obtener("IG_PRUEBA").historial.filter((m) => m.rol === "lead").map((m) => m.texto);
  assert.deepEqual(leads.slice(-3), ["quiero perder peso", "unos 10 kilos", "desde hace un año"]);
});

test("mensaje manual del dueño: se anota y el asistente sigue activo", async () => {
  await postMeta({ de: "IG_PRUEBA", texto: "Hola, soy Marta, te leo", eco: true });
  const conv = almacen.obtener("IG_PRUEBA");
  assert.equal(conv.historial.at(-1).rol, "dueno");
  assert.equal(conv.pausa, null);
});

test("audio del lead: email [AUDIO] con enlace para la nota, pausa; el dueño responde con audio y se reanuda", async () => {
  await postMeta({ de: "IG_PRUEBA", tipo: "audio" });
  let conv = almacen.obtener("IG_PRUEBA");
  assert.equal(conv.pausa.motivo, "audio");
  const email = emails.find((e) => e.etiqueta === "AUDIO");
  assert.ok(email);
  assert.match(email.cuerpo, /https:\/\/setter\.test\/nota\/IG_PRUEBA\//);

  await postMeta({ de: "IG_PRUEBA", tipo: "audio", eco: true });
  conv = almacen.obtener("IG_PRUEBA");
  assert.equal(conv.pausa, null);
});

test("enlace de nota de audio: con firma válida guarda la nota; con firma falsa, 403", async () => {
  const id = "IG_PRUEBA";
  assert.equal((await fetch(`${base}/nota/${id}/${"0".repeat(32)}`)).status, 403);
  const r = await fetch(`${base}/nota/${id}/${firmar(`nota:${id}`)}`, {
    method: "POST",
    body: new URLSearchParams({ queDijo: "Le operan en marzo", queContesto: "Lo vemos en la llamada" }),
  });
  assert.equal(r.status, 200);
  const audio = almacen.obtener(id).historial.findLast((m) => m.rol === "lead" && m.tipo === "audio");
  assert.equal(audio.resumen, "Le operan en marzo");
});

test("etiqueta IA_PAUSA en ManyChat: el asistente no responde; IA_ON lo reactiva y limpia las etiquetas", async () => {
  contactosMC[111].etiquetas = ["IA_PAUSA"];
  const antes = enviados.length;
  await postMeta({ de: "IG_PRUEBA", texto: "¿hola?" });
  await procesarYa("IG_PRUEBA");
  assert.equal(enviados.length, antes);
  assert.equal(almacen.obtener("IG_PRUEBA").pausa.motivo, "etiqueta");

  contactosMC[111].etiquetas = ["IA_PAUSA", "IA_ON"];
  await postMeta({ de: "IG_PRUEBA", texto: "¿sigues ahí?" });
  await procesarYa("IG_PRUEBA");
  assert.equal(enviados.length, antes + 1);
  assert.deepEqual(contactosMC[111].etiquetas, []);
});

test("#reset desde la cuenta de pruebas: reinicia, contesta y conserva el vínculo con ManyChat", async () => {
  await postMeta({ de: "IG_PRUEBA", texto: "#reset" });
  await srv.orq.procesarVencidos({ esperar: true });
  const conv = almacen.obtener("IG_PRUEBA");
  assert.deepEqual(enviados.at(-1).burbujas, [MENSAJE_RESET]);
  assert.equal(conv.historial.length, 0);
  assert.equal(conv.manychatId, "111");
});

test("modo prueba: una cuenta que no está en la lista blanca no recibe nada y no se guarda", async () => {
  await postManychat({ subscriber_id: 222 });
  const antes = enviados.length;
  await postMeta({ de: "IG_OTRA", texto: "hola, info" });
  assert.equal(almacen.obtener("IG_OTRA"), null);
  assert.equal(enviados.length, antes);
});

test("vinculación por texto cuando ManyChat no da el ID de Instagram (Meta llega primero)", async () => {
  await postMeta({ de: "IG_SIN_ID", texto: "Hola, quiero info" });
  await postManychat({ subscriber_id: 333, texto: "Hola, quiero info" });
  assert.equal(almacen.obtener("IG_SIN_ID").manychatId, "333");
});

// ---------- Entrada por ManyChat (ENTRADA=manychat) ----------
const postMensajeMC = (cuerpo) =>
  fetch(`${base}/manychat/mensaje`, { method: "POST", body: JSON.stringify(cuerpo), headers: { "x-token": "token-mc" } }).then(
    async (r) => (await espera(40), r),
  );

test("ManyChat: clasifica texto, audio, imagen y archivos desconocidos", async () => {
  const { clasificarEntradaManychat: c } = await import("../src/orquestador.js");
  assert.deepEqual(c("Hola, quiero info"), { tipo: "texto", texto: "Hola, quiero info" });
  assert.equal(c("").tipo, "audio");
  assert.equal(c("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=123&signature=abc").tipo, "audio");
  assert.equal(c("https://cdn.fbsbx.com/v/t59.3654-21/audioclip-1234.mp4?x=1").tipo, "audio");
  assert.equal(c("https://scontent.xx.fbcdn.net/v/t1.15752-9/foto.jpg?x=1").tipo, "imagen");
  assert.equal(c("Mira https://www.instagram.com/reel/ABC").tipo, "texto", "un texto con un enlace normal sigue siendo texto");
});

test("ManyChat: el mensaje entra por la petición externa, el asistente responde y Meta no lo duplica", async () => {
  config.entrada = "manychat";
  try {
    const antes = enviados.length;
    assert.equal((await postMensajeMC({ texto: "sin id" })).status, 400);
    await postMensajeMC({ subscriber_id: 111, texto: "Hola, vengo por ManyChat" });
    await postMeta({ de: "IG_PRUEBA", texto: "Hola, vengo por ManyChat" }); // si Meta también lo manda, se ignora
    const conv = almacen.obtener("IG_PRUEBA");
    assert.equal(conv.bandeja.length, 1, "solo una vez en la bandeja");
    await procesarYa("IG_PRUEBA");
    assert.equal(enviados.length, antes + 1);
  } finally {
    config.entrada = "meta";
  }
});

test("ManyChat: un audio (enlace a archivo) pausa, avisa y la nota lo reactiva", async () => {
  config.entrada = "manychat";
  try {
    const emailsAntes = emails.length;
    await postMensajeMC({ subscriber_id: 111, texto: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=9&signature=z" });
    assert.equal(almacen.obtener("IG_PRUEBA").pausa?.motivo, "audio");
    assert.equal(emails.slice(emailsAntes).filter((e) => e.etiqueta === "AUDIO").length, 1);
    await fetch(`${base}/nota/IG_PRUEBA/${firmar("nota:IG_PRUEBA")}`, {
      method: "POST",
      body: new URLSearchParams({ queDijo: "Pregunta si puede correr", queContesto: "Le he dicho que lo vemos" }),
    });
    assert.equal(almacen.obtener("IG_PRUEBA").pausa, null, "guardar la nota reactiva al asistente");
  } finally {
    config.entrada = "meta";
  }
});

test("ManyChat: en modo prueba ignora a quien no está en la lista blanca", async () => {
  config.entrada = "manychat";
  try {
    const antes = almacen.todas().length;
    await postMensajeMC({ subscriber_id: 222, texto: "info" });
    assert.equal(almacen.todas().length, antes);
  } finally {
    config.entrada = "meta";
  }
});

test("lee también los avisos 'standby' (cuando ManyChat es la app principal)", async () => {
  const { extraerEventos } = await import("../src/integraciones/meta.js");
  const eventos = extraerEventos({
    object: "instagram",
    entry: [{ id: "BIZ", standby: [{ sender: { id: "X1" }, recipient: { id: "BIZ" }, timestamp: 1, message: { mid: "s1", text: "hola" } }] }],
  });
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].igsid, "X1");
  assert.equal(eventos[0].texto, "hola");
});

test("panel: pide contraseña y muestra las conversaciones", async () => {
  assert.equal((await fetch(`${base}/panel`)).status, 401);
  const auth = { authorization: `Basic ${Buffer.from("admin:clave-panel").toString("base64")}` };
  const r = await fetch(`${base}/panel`, { headers: auth });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /MODO PRUEBA/);
  const r2 = await fetch(`${base}/panel/c/IG_PRUEBA`, { headers: auth });
  assert.match(await r2.text(), /Pausar a Lucía/);
});

const auth = { authorization: `Basic ${Buffer.from("admin:clave-panel").toString("base64")}` };
const postPanel = (ruta, campos) =>
  fetch(`${base}${ruta}`, { method: "POST", body: new URLSearchParams(campos), headers: auth, redirect: "manual" });

test("panel: guardar ajustes cambia el nombre, la lista blanca y el email de los avisos", async () => {
  const r = await postPanel("/panel/ajustes", { nombreAsistente: "Nora", nombreDueno: "Marta", emailAvisos: "otra@ejemplo.com", listaBlanca: "cuenta.prueba, otra.cuenta", modoPrueba: "si", exigirDecisor: "si" });
  assert.equal(r.status, 303);
  assert.equal(negocio.nombreAsistente, "Nora");
  assert.deepEqual(config.listaBlanca, ["cuenta.prueba", "otra.cuenta"]);
  assert.equal(config.emailAvisos, "otra@ejemplo.com");
  assert.equal(negocio.seguimientosAutomaticos, false, "una casilla desmarcada se guarda como no");
  await postPanel("/panel/ajustes", { nombreAsistente: "Lucía", nombreDueno: "Marta", emailAvisos: "marta@ejemplo.com", listaBlanca: "cuenta.prueba", modoPrueba: "si", exigirDecisor: "si", seguimientosAutomaticos: "si" });
});

test("panel: activar para todos y volver a modo prueba", async () => {
  await postPanel("/panel/modo", { activo: "no" });
  assert.equal(config.modoPrueba, false);
  await postPanel("/panel/modo", { activo: "si" });
  assert.equal(config.modoPrueba, true);
});

test("panel: editar una sección del conocimiento se aplica al prompt y se puede deshacer", async () => {
  const { construirPrompt } = await import("../src/cerebro/prompt.js");
  await postPanel("/panel/conocimiento/03_objeciones_y_respuestas.md", { accion: "guardar", texto: "# 03 · Objeciones\nRegla nueva de {dueno}: https://mi-web.com/guia" });
  assert.match(construirPrompt(), /Regla nueva de Marta/);
  const { urlsPermitidas } = await import("../src/cerebro/prompt.js");
  assert.ok(urlsPermitidas().has("https://mi-web.com/guia"), "los enlaces nuevos del conocimiento se pueden enviar");
  await postPanel("/panel/conocimiento/03_objeciones_y_respuestas.md", { accion: "deshacer" });
  assert.doesNotMatch(construirPrompt(), /Regla nueva/);
});

test("panel: probar habla con el asistente sin enviar nada por ManyChat y sin la lista blanca", async () => {
  const antes = enviados.length;
  const r = await postPanel("/panel/probar", { accion: "mensaje", texto: "Hola, quería información" });
  assert.equal(r.status, 303);
  const pagina = await (await fetch(`${base}/panel/probar`, { headers: auth })).text();
  assert.match(pagina, /quería información/);
  assert.match(pagina, /Soy Lucía/);
  assert.equal(enviados.length, antes);
  assert.ok(almacen.ajuste("probado_panel"));
  const inicio = await (await fetch(`${base}/panel`, { headers: auth })).text();
  assert.doesNotMatch(inicio, /panel%3Aprueba/, "la conversación de prueba no sale en la lista");
});

test("API para Claude Code: bajar y subir el conocimiento", async () => {
  const todo = await (await fetch(`${base}/panel/api/conocimiento`, { headers: auth })).json();
  assert.equal(Object.keys(todo).length, 6);
  const r = await fetch(`${base}/panel/api/conocimiento`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ "05_ejemplos_conversaciones.md": "# 05 · Ejemplos\nLEAD: hola", "../malo.md": "x" }),
  });
  assert.deepEqual((await r.json()).cambiados, ["05_ejemplos_conversaciones.md"]);
  const convs = await (await fetch(`${base}/panel/api/conversaciones?buscar=cuenta.prueba`, { headers: auth })).json();
  assert.ok(convs.length >= 1);
});

test("ManyChat: el primer mensaje marca el paso «Conectar ManyChat» como hecho", async () => {
  assert.ok(almacen.ajuste("manychat_recibido"));
  const pagina = await (await fetch(`${base}/panel/manychat`, { headers: auth })).text();
  assert.match(pagina, /token-mc/);
  assert.match(pagina, /https:\/\/setter\.test\/manychat\/mensaje/);
});

test("páginas legales con los datos del negocio", async () => {
  const t = await (await fetch(`${base}/privacidad`)).text();
  assert.match(t, /Lucía/);
  assert.match(t, /marta@ejemplo\.com/);
});
