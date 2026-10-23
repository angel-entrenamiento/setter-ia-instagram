import Anthropic from "@anthropic-ai/sdk";
import { config, idModelo } from "../config.js";
import { construirPrompt } from "./prompt.js";
import { SalidaSchema, SALIDA_JSON_SCHEMA } from "./esquema.js";

let cliente = null;
export function clienteAnthropic() {
  // 2 minutos por intento: una llamada colgada no debe bloquear al asistente (por defecto el SDK espera 10 min)
  if (!cliente) cliente = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return cliente;
}

export class ErrorModelo extends Error {
  constructor(mensaje, { causa, tipo, coste = 0 } = {}) {
    super(mensaje);
    this.tipo = tipo ?? "error_modelo";
    this.causa = causa;
    this.coste = coste; // lo que ya se ha cobrado aunque la respuesta no sirva
  }
}

/** Precio por millón de tokens (USD) para estimar el gasto en informes. */
const PRECIOS = {
  "claude-opus-5-5": { entrada: 4, salida: 20, cacheLectura: 0.2, cacheEscritura1h: 8 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheLectura: 0.2, cacheEscritura1h: 4 },
  "claude-haiku-4-5": { entrada: 1, salida: 5, cacheLectura: 0.1, cacheEscritura1h: 2 },
};

export function costeUsd(modelo, uso) {
  const p = PRECIOS[modelo];
  if (!p || !uso) return 0;
  return (
    ((uso.input_tokens ?? 0) * p.entrada +
      (uso.output_tokens ?? 0) * p.salida +
      (uso.cache_read_input_tokens ?? 0) * p.cacheLectura +
      (uso.cache_creation_input_tokens ?? 0) * p.cacheEscritura1h) /
    1e6
  );
}

/**
 * Pide al modelo el siguiente turno del asistente.
 * @param {Anthropic.MessageParam[]} mensajes historial (user/assistant) ya formateado
 * @param {string} contexto bloque de contexto interno del turno (va como mensaje de sistema al final)
 * @returns {Promise<{ salida, uso, modelo, coste }>}
 */
// Solo para pruebas automáticas: sustituye la llamada a la IA por una función local.
let generadorDePrueba = null;
export function usarGeneradorDePrueba(fn) {
  generadorDePrueba = fn;
}

export async function pedirTurno(mensajes, contexto, { modelo = config.modelo, esfuerzo = config.esfuerzo } = {}) {
  if (generadorDePrueba) return { salida: await generadorDePrueba(mensajes, contexto), uso: null, modelo: "prueba", coste: 0 };
  const model = idModelo(modelo);
  let respuesta;
  try {
    respuesta = await clienteAnthropic().beta.messages.create({
      model,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: construirPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [...mensajes, { role: "system", content: contexto }],
      output_config: {
        effort: esfuerzo,
        format: { type: "json_schema", schema: SALIDA_JSON_SCHEMA },
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      throw new ErrorModelo("La clave de la API de Anthropic no es válida", { causa: error, tipo: "clave" });
    if (error instanceof Anthropic.RateLimitError)
      throw new ErrorModelo("Límite de uso de la API alcanzado", { causa: error, tipo: "limite" });
    if (error instanceof Anthropic.APIError)
      throw new ErrorModelo(`Error de la API (${error.status}): ${error.message}`, { causa: error });
    throw new ErrorModelo(`No se pudo contactar con la API: ${error.message}`, { causa: error, tipo: "red" });
  }

  const coste = costeUsd(respuesta.model ?? model, respuesta.usage);
  if (respuesta.stop_reason === "refusal") {
    throw new ErrorModelo("El modelo ha rechazado responder (refusal)", { tipo: "rechazo", coste });
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new ErrorModelo("La respuesta se ha cortado (max_tokens)", { tipo: "cortada", coste });
  }

  const texto = respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErrorModelo("La respuesta no es un JSON válido", { tipo: "json_invalido", coste });
  }
  const validado = SalidaSchema.safeParse(json);
  if (!validado.success) {
    throw new ErrorModelo(`La respuesta no cumple el esquema: ${validado.error.message}`, { tipo: "esquema", coste });
  }
  return { salida: validado.data, uso: respuesta.usage, modelo: respuesta.model ?? model, coste };
}

/** Llamada de texto libre (redactar seguimientos, simular leads, juez de pruebas). */
let textoDePrueba = null;
export function usarTextoDePrueba(fn) {
  textoDePrueba = fn;
}

export async function pedirTexto({ model, system, mensajes, max_tokens = 2000, esfuerzo, esquemaJson }) {
  if (textoDePrueba) return { texto: await textoDePrueba(mensajes, { model, system }), coste: 0 };
  const peticion = { model, max_tokens, system, messages: mensajes };
  const output_config = {};
  if (esfuerzo && !model.includes("haiku")) output_config.effort = esfuerzo;
  if (esquemaJson) output_config.format = { type: "json_schema", schema: esquemaJson };
  if (Object.keys(output_config).length) peticion.output_config = output_config;
  const r = await clienteAnthropic().messages.create(peticion);
  const texto = r.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { texto, uso: r.usage, coste: costeUsd(model, r.usage) };
}
