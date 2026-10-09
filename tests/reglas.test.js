import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { aplicarReglas, importesEnTexto, hayBloqueo, revisarSeguimiento } from "../src/cerebro/reglas.js";
import { FICHA_VACIA } from "../src/cerebro/esquema.js";
import { negocio, NEGOCIO_POR_DEFECTO } from "../src/negocio.js";
import { config } from "../src/config.js";

const PAGO = "https://pago.ejemplo.com/plan-basico";

beforeEach(() => {
  Object.assign(negocio, NEGOCIO_POR_DEFECTO, {
    nombreAsistente: "Lucía",
    nombreDueno: "Marta",
    productoBaratoActivo: true,
    productoBaratoNombre: "Plan Básico",
    productoBaratoImportes: "97, 197",
    productoBaratoEnlacePago: PAGO,
    exigirDecisor: true,
  });
  config.versionConocimiento++;
});

const conv = { enlacePagoEnviado: false };
const fichaCompleta = {
  ...FICHA_VACIA,
  situacion: "quiere perder 10 kg, lleva años intentándolo",
  encaja_perfil: "si",
  objetivo: "volver a ponerse su ropa",
  prioridad_1a10: 9,
  dispuesto_implicarse: "si",
  decisor_economico: "decide ella sola",
  decisor_en_llamada: "no_hace_falta",
};
const salida = (over = {}) => ({
  mensajes: ["Genial Laura"],
  estado: "descubriendo",
  accion: "ninguna",
  ficha: { ...FICHA_VACIA },
  nota_interna: "",
  ...over,
});
const tipos = (r) => r.problemas.filter((p) => p.bloqueante).map((p) => p.tipo);

test("quita el signo ¿ de apertura y avisa si abusa de los dos puntos", () => {
  const r = aplicarReglas(salida({ mensajes: ["¡Genial! Te cuento: va así", "Y la idea es esta: ¿desde cuándo te pasa?"] }), conv);
  assert.deepEqual(r.salida.mensajes, ["Genial! Te cuento: va así", "Y la idea es esta: desde cuándo te pasa?"]);
  assert.ok(r.problemas.some((p) => p.tipo === "dos_puntos"));
});

test("detecta importes con y sin moneda", () => {
  assert.deepEqual(importesEnTexto("El programa cuesta 1.200 €"), [1200]);
  assert.deepEqual(importesEnTexto("son 90 euros al mes"), [90]);
  assert.deepEqual(importesEnTexto("Son 497 y se puede fraccionar"), [497]);
  assert.deepEqual(importesEnTexto("Son 197 € y tienes 14 días de garantía"), [197]);
  assert.deepEqual(importesEnTexto("son 2500 pesos"), [2500]);
});

test("no confunde duraciones ni cifras de marca con precios", () => {
  assert.deepEqual(importesEnTexto("son 15-20 minutillos de videollamada"), []);
  assert.deepEqual(importesEnTexto("son 12 semanas de entrenamiento"), []);
  assert.deepEqual(importesEnTexto("ya han pasado más de 1.500 personas"), []);
  assert.deepEqual(importesEnTexto("la media son 6-8 meses"), []);
});

test("bloquea cualquier precio fuera de la ruta de venta directa", () => {
  const r = aplicarReglas(salida({ mensajes: ["El programa son 300 € al mes"] }), conv);
  assert.ok(tipos(r).includes("importe_prohibido"));
});

test("permite los importes del producto barato en su ruta, y nada más", () => {
  const r = aplicarReglas(salida({ mensajes: ["Son 97 € y tienes garantía"], estado: "low_ticket" }), conv);
  assert.equal(hayBloqueo(r.problemas), false);
  const r2 = aplicarReglas(salida({ mensajes: ["Son 150 €"], estado: "low_ticket" }), conv);
  assert.ok(tipos(r2).includes("importe_prohibido"));
});

test("sin producto barato activo, ningún importe pasa", () => {
  negocio.productoBaratoActivo = false;
  const r = aplicarReglas(salida({ mensajes: ["Son 97 €"], estado: "low_ticket" }), conv);
  assert.ok(tipos(r).includes("importe_prohibido"));
});

test("bloquea enlaces que no están en el conocimiento ni en Ajustes", () => {
  const r = aplicarReglas(salida({ mensajes: ["Mira esto https://otra-web.com/oferta"] }), conv);
  assert.ok(tipos(r).includes("enlace_no_permitido"));
});

test("enlace de pago con criterios cumplidos corrige la acción a enviar_link_pago", () => {
  const r = aplicarReglas(
    salida({ mensajes: [`Puedes acceder aquí: ${PAGO}`], estado: "low_ticket", ficha: { ...FICHA_VACIA, apto_producto_barato: "si" } }),
    conv,
  );
  assert.equal(hayBloqueo(r.problemas), false);
  assert.equal(r.salida.accion, "enviar_link_pago");
});

test("no envía el enlace de pago sin confirmar que cumple los criterios", () => {
  const r = aplicarReglas(salida({ mensajes: [PAGO], estado: "low_ticket" }), conv);
  assert.ok(tipos(r).includes("pago_sin_criterios"));
});

test("no propone llamada sin decisor económico (si está activado) ni sin encajar en el perfil", () => {
  const sinDecisor = aplicarReglas(
    salida({ mensajes: ["Te vendría mejor por la mañana o por la tarde?"], ficha: { ...fichaCompleta, decisor_economico: "", decisor_en_llamada: "" } }),
    conv,
  );
  assert.ok(tipos(sinDecisor).includes("llamada_sin_datos"));
  negocio.exigirDecisor = false;
  const sinExigir = aplicarReglas(
    salida({ mensajes: ["Mañana o tarde?"], ficha: { ...fichaCompleta, decisor_economico: "", decisor_en_llamada: "" } }),
    conv,
  );
  assert.equal(hayBloqueo(sinExigir.problemas), false);
  const noEncaja = aplicarReglas(salida({ mensajes: ["Mañana o tarde?"], ficha: { ...fichaCompleta, encaja_perfil: "desconocido" } }), conv);
  assert.ok(tipos(noEncaja).includes("llamada_sin_datos"));
});

test("propuesta completa corrige la acción a traspaso_agendar", () => {
  const r = aplicarReglas(salida({ mensajes: ["Es gratuita y sin compromiso 😊", "¿Te viene mejor mañana o tarde?"], ficha: fichaCompleta }), conv);
  assert.equal(hayBloqueo(r.problemas), false);
  assert.equal(r.salida.accion, "traspaso_agendar");
  assert.equal(r.salida.estado, "propuesta_llamada");
});

test("con señales de alarma no se propone llamada y la acción pasa a alerta", () => {
  const ficha = { ...fichaCompleta, senales_alarma: ["cuenta conductas de riesgo"] };
  const r1 = aplicarReglas(salida({ mensajes: ["¿Mañana o tarde?"], ficha }), conv);
  assert.ok(tipos(r1).includes("llamada_con_alarma"));
  const r2 = aplicarReglas(salida({ mensajes: ["Te recomiendo hablarlo con un profesional cuanto antes"], ficha }), conv);
  assert.equal(r2.salida.accion, "alerta");
});

test("bloquea que hable como si fuera el dueño (con o sin tilde)", () => {
  negocio.nombreDueno = "Álvaro Gómez";
  assert.ok(tipos(aplicarReglas(salida({ mensajes: ["Hola! Soy Álvaro"] }), conv)).includes("identidad"));
  assert.ok(tipos(aplicarReglas(salida({ mensajes: ["aqui alvaro, dime"] }), conv)).includes("identidad"));
  assert.equal(hayBloqueo(aplicarReglas(salida({ mensajes: ["Soy Lucía, del equipo de Álvaro"] }), conv).problemas), false);
  assert.equal(revisarSeguimiento("Hola, soy Álvaro"), null);
});

test("une burbujas de más y limpia markdown", () => {
  const r = aplicarReglas(salida({ mensajes: ["**uno**", "dos", "tres", "cuatro", "cinco"] }), conv);
  assert.equal(r.salida.mensajes.length, 4);
  assert.equal(r.salida.mensajes[0], "uno");
  assert.equal(r.salida.mensajes[3], "cuatro\ncinco");
});
