// Inicio del panel: buscador, etapa en palabras, botón Pausar/Reactivar y aviso de «Te toca a ti». Sin servicios reales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { htmlInicio } from "../src/panel/paginas.js";

test("inicio: cada conversación con su etapa, texto para buscar y botón de pausa", () => {
  const almacen = new AlmacenSqlite(":memory:");
  const a = almacen.obtenerOCrear({ id: "a" });
  Object.assign(a, { nombre: "Laura", igUsuario: "laura.run", estado: "descubriendo" });
  a.historial.push({ rol: "lead", texto: "Me duele la RODILLA al bajar escaleras", fecha: new Date().toISOString() });
  almacen.guardar(a);
  const b = almacen.obtenerOCrear({ id: "b" });
  Object.assign(b, { nombre: "Pablo", pausa: { motivo: "humano", desde: new Date().toISOString() } });
  b.historial.push({ rol: "lead", texto: "¿Puedo hablar con Jorge?" });
  almacen.guardar(b);

  const html = htmlInicio(almacen, { pendientes: 2, esperan: new Set(["b"]), entrevistas: [] });
  assert.match(html, /id="buscar"/);
  assert.match(html, /data-b="[^"]*rodilla al bajar escaleras/); // busca en lo que dijo, en minúsculas
  assert.match(html, /<span class="tag">Respondió<\/span>/); // etapa del CRM, no «descubriendo»
  assert.match(html, /name="volver" value="\/panel"><button name="accion" value="pausar"/);
  assert.match(html, /value="reactivar"/);
  assert.match(html, /data-t="esperan pausadas"/);
  assert.match(html, /Esperándote \(1\)/);
  assert.match(html, /Te toca a ti: 2 cosas pendientes/);
  assert.doesNotMatch(htmlInicio(almacen), /Te toca a ti:/);
});

test("conversación: ficha arriba, un solo botón, enlace a Instagram y burbujas", async () => {
  const { htmlConversacion } = await import("../src/panel/paginas.js");
  const almacen = new AlmacenSqlite(":memory:");
  const c = almacen.obtenerOCrear({ id: "x" });
  Object.assign(c, { nombre: "Laura", igUsuario: "laura.run", ficha: { ...c.ficha, situacion: "Dolor de rodilla al correr", objetivo: "volver a correr 10 km" } });
  c.historial.push({ rol: "lead", tipo: "texto", texto: "hola" }, { rol: "bot", tipo: "texto", texto: "¡Hola Laura!" });
  const html = htmlConversacion(c, { etapa: "Respondió" });
  assert.match(html, /<dt>Situación<\/dt><dd>Dolor de rodilla al correr<\/dd>/);
  assert.ok(html.indexOf("Ficha") < html.indexOf("<h2>Conversación"));
  assert.match(html, /value="pausar"/);
  assert.doesNotMatch(html, /value="reactivar"/);
  assert.match(html, /https:\/\/www\.instagram\.com\/laura\.run\//);
  assert.match(html, /class="burbuja lead"/);
  assert.match(html, /<span class="tag">Respondió<\/span>/);
  c.pausa = { motivo: "etiqueta" };
  assert.doesNotMatch(htmlConversacion(c), /value="pausar"/);
});
