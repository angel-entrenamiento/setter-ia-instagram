// Mensajes de ManyChat con saltos de línea, tabuladores o comillas sin escapar (caso real de dos leads de Ángel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearCuerpoManychat } from "../src/utilidades/cuerpoManychat.js";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearServidor } from "../src/servidor.js";
import { guardarNegocio } from "../src/negocio.js";

test("lee el cuerpo de ManyChat aunque el texto traiga saltos de línea o comillas", () => {
  assert.deepEqual(parsearCuerpoManychat('{"subscriber_id":"123","texto":"Hola"}'), { subscriber_id: "123", texto: "Hola" });
  assert.deepEqual(
    parsearCuerpoManychat('{"subscriber_id":"123","texto":"Hola!\nAhora mismo estoy fatal"}'),
    { subscriber_id: "123", texto: "Hola!\nAhora mismo estoy fatal" },
  );
  assert.deepEqual(
    parsearCuerpoManychat('{"subscriber_id":"123","texto":"Me dijeron "paciencia" y\r\n\tnada"}'),
    { subscriber_id: "123", texto: 'Me dijeron "paciencia" y\r\n\tnada' },
  );
  assert.deepEqual(
    parsearCuerpoManychat('{"subscriber_id":"123","texto":"Hola\\nqué tal \\"bien\\""}'),
    { subscriber_id: "123", texto: 'Hola\nqué tal "bien"' },
    "con «Codificar a JSON» llega ya bien escapado",
  );
  assert.equal(parsearCuerpoManychat("esto no es nada"), null);
});

test("un mensaje de varias líneas llega al setter, y uno ilegible avisa con [ERROR] en vez de perderse", async () => {
  Object.assign(config, { tokenManychatEntrada: "tok", panelClave: "x" });
  const emails = [];
  const recibidos = [];
  const almacen = new AlmacenSqlite(":memory:");
  const manychat = {
    infoContacto: async (id) => (recibidos.push(id), { manychatId: String(id), igUsuario: "cuenta.prueba", igId: "IG9", etiquetas: [] }),
  };
  const { servidor } = crearServidor({ almacen, manychat, enviarEmail: async (e) => void emails.push(e) });
  guardarNegocio(almacen, { nombreAsistente: "Lucía", emailAvisos: "marta@ejemplo.com", modoPrueba: true, listaBlanca: "cuenta.prueba" });
  await new Promise((r) => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const enviar = (cuerpo) => fetch(`${base}/manychat/mensaje`, { method: "POST", headers: { "x-token": "tok" }, body: cuerpo });
  try {
    assert.equal((await enviar('{"subscriber_id":"55","texto":"Hola\nllevo meses "fatal""}')).status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(recibidos, ["55"]);
    assert.equal(almacen.obtener("IG9").bandeja[0].texto, 'Hola\nllevo meses "fatal"');

    assert.equal((await enviar("<<basura>>")).status, 400);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(emails.length, 1);
    assert.match(emails[0].asunto, /\[ERROR\] Lucía no ha podido leer un mensaje de ManyChat/);
    assert.equal(emails[0].para, "marta@ejemplo.com");
  } finally {
    servidor.close();
  }
});
