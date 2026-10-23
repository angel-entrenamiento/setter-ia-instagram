// Gasto de IA: seguimientos baratos, gasto por partes y cobros de respuestas que fallan.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { conversacionNueva } from "../src/almacen/conversaciones.js";
import { redactarSeguimiento, procesarEvento } from "../src/motor.js";
import { usarTextoDePrueba, usarGeneradorDePrueba, ErrorModelo } from "../src/cerebro/llm.js";
import { construirPrompt, construirPromptSeguimiento } from "../src/cerebro/prompt.js";
import { negocio } from "../src/negocio.js";
import { FICHA_VACIA } from "../src/cerebro/esquema.js";
import { config } from "../src/config.js";

test("los seguimientos usan un texto corto (marca y voz + reglas) y Sonnet por defecto", async () => {
  let peticion = null;
  usarTextoDePrueba(async (_m, p) => ((peticion = p), "Hola Laura, pudiste ver mi mensaje?"));
  try {
    const conv = conversacionNueva({ id: "x" });
    conv.historial.push({ rol: "lead", tipo: "texto", texto: "Hola" }, { rol: "bot", tipo: "texto", texto: "Hola! Qué tal?" });
    await redactarSeguimiento(conv, 1);
    assert.equal(peticion.model, "claude-sonnet-5-5");
    assert.equal(typeof peticion.system, "string");
    assert.match(peticion.system, /MARCA, AVATAR Y VOZ/);
    assert.doesNotMatch(peticion.system, /OBJECIONES Y RESPUESTAS|PRODUCTOS, RECURSOS/);
    assert.ok(construirPromptSeguimiento().length < construirPrompt().length / 3, "mucho más corto que el conocimiento entero");
    negocio.modeloSeguimientos = "opus";
    await redactarSeguimiento(conv, 2);
    assert.equal(peticion.model, "claude-opus-5-5", "se puede volver a Opus en Ajustes");
  } finally {
    negocio.modeloSeguimientos = "sonnet";
    usarTextoDePrueba(null);
  }
});

test("el gasto se guarda por partes", () => {
  const almacen = new AlmacenSqlite(":memory:");
  almacen.registrarCoste(0.2, "respuestas");
  almacen.registrarCoste(0.1, "respuestas");
  almacen.registrarCoste(0.01, "seguimientos");
  almacen.registrarCoste(0.5, "panel");
  almacen.registrarCoste(0); // no guarda ceros
  const p = almacen.costePorTipo(Date.now() - 60000, Date.now() + 1000);
  assert.equal(p.respuestas.toFixed(2), "0.30");
  assert.equal(p.seguimientos, 0.01);
  assert.equal(p.panel, 0.5);
  assert.equal(almacen.sumarCoste(Date.now() - 60000, Date.now() + 1000).toFixed(2), "0.81");
});

test("una base de datos de antes (sin tipo de gasto) se adapta sola y conserva lo que tenía", () => {
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gasto-")), "viejo.db");
  const vieja = new DatabaseSync(archivo);
  vieja.exec("CREATE TABLE costes (usd REAL, fecha INTEGER)");
  vieja.prepare("INSERT INTO costes VALUES (?, ?)").run(1.5, Date.now());
  vieja.close();
  const almacen = new AlmacenSqlite(archivo);
  almacen.registrarCoste(0.25, "seguimientos");
  const p = almacen.costePorTipo(Date.now() - 60000, Date.now() + 1000);
  assert.deepEqual(p, { otros: 1.5, seguimientos: 0.25 });
  almacen.db.close();
});

test("se cuenta lo que cobra Anthropic aunque la respuesta salga mal y haya que repetirla", async () => {
  Object.assign(config, { modoPrueba: false });
  let intentos = 0;
  usarGeneradorDePrueba(async () => {
    intentos++;
    if (intentos === 1) throw new ErrorModelo("La respuesta no es un JSON válido", { tipo: "json_invalido", coste: 0.2 });
    return { mensajes: ["Hola!"], estado: "descubriendo", accion: "ninguna", ficha: { ...FICHA_VACIA }, nota_interna: "" };
  });
  try {
    const conv = conversacionNueva({ id: "y", igUsuario: "lead" });
    const r = await procesarEvento(conv, { tipo: "texto", texto: "Hola" });
    assert.equal(intentos, 2);
    assert.equal(r.coste, 0.2, "el intento fallido se suma");
  } finally {
    usarGeneradorDePrueba(null);
  }
});
