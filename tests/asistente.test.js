// Chat "Asistente" del panel, con la IA simulada.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearServidor } from "../src/servidor.js";
import { usarTextoDePrueba } from "../src/cerebro/llm.js";
import { negocio } from "../src/negocio.js";
import { leerSeccion } from "../src/cerebro/conocimiento.js";

Object.assign(config, { panelUsuario: "admin", panelClave: "clave", tokenManychatEntrada: "tok", secretoEnlaces: "s" });
const auth = { authorization: `Basic ${Buffer.from("admin:clave").toString("base64")}` };
let srv, base;
before(async () => {
  srv = crearServidor({ almacen: new AlmacenSqlite(":memory:"), manychat: {}, enviarEmail: async () => {} });
  await new Promise((r) => srv.servidor.listen(0, r));
  base = `http://127.0.0.1:${srv.servidor.address().port}`;
});
after(() => srv.servidor.close());

const enviar = (cuerpo) =>
  fetch(`${base}/panel/asistente`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

test("lee un documento, propone cambios de conocimiento y ajustes, y solo se aplican al confirmar", async () => {
  let recibido = null;
  usarTextoDePrueba(async (mensajes) => {
    recibido = mensajes.at(-1).content;
    return JSON.stringify({
      respuesta: "Te propongo añadir tu programa Elite y cambiar el precio del producto barato.",
      resumen_documentos: "Programa Elite de 6 meses",
      cambios: [{ archivo: "04_productos_y_enlaces.md", buscar: "", reemplazar: "## Programa Elite\n6 meses 1 a 1.", motivo: "Nuevo programa" }],
      ajustes: [{ campo: "productoBaratoImportes", valor: "67", motivo: "Nuevo precio" }],
    });
  });
  try {
    const archivo = { nombre: "programa.txt", datos: Buffer.from("Programa Elite: 6 meses 1 a 1").toString("base64") };
    const { propuestaId } = await (await enviar({ mensaje: "Añade esto", archivos: [archivo] })).json();
    assert.ok(propuestaId);
    assert.ok(recibido.some((b) => b.type === "text" && b.text.includes("Programa Elite: 6 meses")), "la IA recibe el documento");
    assert.notEqual(negocio.productoBaratoImportes, "67", "no se aplica nada sin confirmar");

    const chat = await (await fetch(`${base}/panel/asistente`, { headers: auth })).text();
    assert.ok(chat.includes("Te propongo añadir tu programa Elite"));
    assert.ok(chat.includes("programa.txt"));

    const aplicar = new URLSearchParams([["c", "0"], ["a", "0"]]);
    const pagina = await (await fetch(`${base}/panel/propuesta/${propuestaId}`, { method: "POST", body: aplicar, headers: auth })).text();
    assert.ok(pagina.includes("2 cambio(s) aplicado(s)"));
    assert.equal(negocio.productoBaratoImportes, "67");
    assert.ok(leerSeccion("04_productos_y_enlaces.md").includes("Programa Elite"));
  } finally {
    usarTextoDePrueba(null);
  }
});

test("los PDF van como documento y los Word se rechazan con una explicación", async () => {
  let recibido = null;
  usarTextoDePrueba(async (mensajes) => {
    recibido = mensajes.at(-1).content;
    return JSON.stringify({ respuesta: "Leído.", resumen_documentos: "", cambios: [], ajustes: [] });
  });
  try {
    const pdf = await enviar({ mensaje: "", archivos: [{ nombre: "Guia.PDF", datos: "JVBERi0xLjQ=" }] });
    assert.equal(pdf.status, 200);
    assert.equal((await pdf.json()).propuestaId, null, "sin cambios no hay propuesta");
    assert.equal(recibido[0].type, "document");
    assert.equal(recibido[0].source.media_type, "application/pdf");

    const word = await enviar({ mensaje: "", archivos: [{ nombre: "doc.docx", datos: "AAAA" }] });
    assert.equal(word.status, 500);
    assert.ok((await word.json()).error.includes("guárdalo como PDF"));
  } finally {
    usarTextoDePrueba(null);
  }
});
