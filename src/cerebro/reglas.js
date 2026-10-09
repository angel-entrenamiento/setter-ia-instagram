// Reglas duras: las aplica el código, no el modelo. Si algo bloqueante falla, no se envía nada.
import { config } from "../config.js";
import { negocio, importesProductoBarato, hayProductoBarato } from "../negocio.js";
import { urlsPermitidas, normalizarUrl } from "./prompt.js";

const RE_URL = /https?:\/\/[^\s)"'<>]+/gi;
const RE_IMPORTE_CON_MONEDA =
  /(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|euros?\b|eur\b|\$|d[oó]lares|usd\b|pesos\b|mxn\b|cop\b|ars\b|clp\b)|(?:€|\$)\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)/gi;
const RE_PALABRA_PRECIO =
  /\b(cuesta|cuestan|precio|vale|valor|son|pagar|pagas|pago|inversi[oó]n|cuota|mensualidad|al mes|tarifa)\b/i;
const RE_NUMERO = /\b\d{1,3}(?:[.\s]\d{3})+\b|\b\d{2,6}\b/g;
const RE_UNIDAD_NO_DINERO =
  /^\s*(-\s*\d+\s*)?('|’|min|minutos?|minutillos|h\b|horas?|d[ií]as?|semanas?|mes(es)?|a[ñn]os?|personas|alumnos|clientes|kg|%|veces|sesiones|ejercicios|preguntas|fases|m\b|km)/i;
export const RE_PROPUESTA_LLAMADA =
  /ma[ñn]anas?\b[^.?!\n]{0,30}\bo\b[^.?!\n]{0,30}\btardes?|tardes?\b[^.?!\n]{0,30}\bo\b[^.?!\n]{0,30}\bma[ñn]anas?\b/i;

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Soy Laura" / "aquí Laura" con el nombre del dueño (con o sin tildes): el asistente nunca se hace pasar por él. */
function reFalsaIdentidad() {
  const nombre = sinTildes((negocio.nombreDueno ?? "").trim().split(/\s+/)[0] ?? "");
  if (nombre.length < 2) return null;
  return new RegExp(`\\b(soy|aqu[ií]) ${escaparRegex(nombre)}\\b`, "i");
}
const hablaComoDueno = (texto) => Boolean(reFalsaIdentidad()?.test(sinTildes(texto)));

/** Normaliza un importe escrito ("1.200", "197", "1 500") a número. */
function aNumero(textoImporte) {
  return Number(String(textoImporte).replace(/[.\s]/g, "").replace(",", "."));
}

export function importesEnTexto(texto) {
  const encontrados = [];
  for (const m of texto.matchAll(RE_IMPORTE_CON_MONEDA)) {
    encontrados.push(aNumero(m[1] ?? m[2]));
  }
  // Números sin moneda cerca de palabras de precio ("son 1.200", "cuesta 90 al mes")
  for (const frase of texto.split(/[.!?\n]/)) {
    if (!RE_PALABRA_PRECIO.test(frase)) continue;
    for (const m of frase.matchAll(RE_NUMERO)) {
      const despues = frase.slice(m.index + m[0].length);
      if (RE_UNIDAD_NO_DINERO.test(despues)) continue;
      const n = aNumero(m[0]);
      if (n >= 50) encontrados.push(n);
    }
  }
  return [...new Set(encontrados)];
}

function datosQueFaltanParaLlamada(ficha) {
  const faltan = [];
  if (ficha.encaja_perfil !== "si") faltan.push("confirmar que encaja con el perfil de clientes del negocio");
  if (!ficha.situacion) faltan.push("su situación (qué le pasa)");
  if (!ficha.objetivo) faltan.push("objetivo");
  if (!ficha.prioridad_1a10) faltan.push("prioridad");
  if (negocio.exigirDecisor) {
    if (!ficha.decisor_economico) faltan.push("quién toma las decisiones económicas");
    if (!["no_hace_falta", "acordado"].includes(ficha.decisor_en_llamada))
      faltan.push("acordar que quien decide esté en la llamada");
  }
  if (ficha.dispuesto_implicarse === "no") faltan.push("disposición a implicarse (ha dicho que no)");
  if (ficha.senales_alarma.length) faltan.push("NO puede haber señales de alarma");
  return faltan;
}

function limpiarBurbuja(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^["“](.*)["”]$/s, "$1")
    .replace(/[¿¡]\s*/g, "") // sin signos de apertura: más natural por MD
    .trim();
}

/**
 * Revisa y corrige la salida del modelo.
 * @returns {{ salida, problemas: {tipo:string, detalle:string, bloqueante:boolean}[] }}
 */
export function aplicarReglas(salidaOriginal, conv) {
  const salida = structuredClone(salidaOriginal);
  const problemas = [];
  const bloquear = (tipo, detalle) => problemas.push({ tipo, detalle, bloqueante: true });
  const avisar = (tipo, detalle) => problemas.push({ tipo, detalle, bloqueante: false });

  // 1. Burbujas: limpiar, quitar vacías, máximo de burbujas
  let burbujas = salida.mensajes.map(limpiarBurbuja).filter(Boolean);
  if (burbujas.length > config.maxBurbujas) {
    const resto = burbujas.slice(config.maxBurbujas - 1).join("\n");
    burbujas = [...burbujas.slice(0, config.maxBurbujas - 1), resto];
    avisar("demasiadas_burbujas", `Se han unido burbujas: el modelo envió ${salida.mensajes.length}`);
  }
  salida.mensajes = burbujas;
  const todo = burbujas.join("\n");

  if (!burbujas.length && !["humano", "alerta", "cerrar"].includes(salida.accion)) {
    bloquear("sin_mensajes", "El modelo no ha devuelto ningún mensaje para enviar");
  }

  // 2. Ruta de venta directa: ¿se pueden decir sus importes / enviar su enlace de pago?
  const productoBarato = hayProductoBarato();
  const rutaLowTicket =
    productoBarato &&
    (salida.estado === "low_ticket" || salida.accion === "enviar_link_pago" || Boolean(conv.enlacePagoEnviado));

  // 3. Importes: nunca el precio de los programas que se venden en la llamada
  const permitidos = new Set(importesProductoBarato());
  for (const importe of importesEnTexto(todo)) {
    if (rutaLowTicket && permitidos.has(importe)) continue;
    bloquear("importe_prohibido", `Aparece el importe ${importe}`);
  }

  // 4. Enlaces: solo los del conocimiento (y el de pago de los ajustes)
  const permitidas = urlsPermitidas();
  const urls = todo.match(RE_URL) ?? [];
  for (const url of urls) {
    if (!permitidas.has(normalizarUrl(url))) bloquear("enlace_no_permitido", url);
  }
  const llevaPago = productoBarato && urls.some((u) => normalizarUrl(u) === normalizarUrl(negocio.productoBaratoEnlacePago));
  if (llevaPago) {
    if (salida.ficha.senales_alarma.length) bloquear("pago_con_alarma", "Enlace de pago con señales de alarma");
    else if (salida.ficha.apto_producto_barato !== "si")
      bloquear("pago_sin_criterios", `Enlace de pago de ${negocio.productoBaratoNombre} sin confirmar que cumple sus criterios`);
    else if (salida.accion !== "enviar_link_pago" && !conv.enlacePagoEnviado) {
      salida.accion = "enviar_link_pago";
      salida.estado = "low_ticket";
      avisar("accion_corregida", "Lleva el enlace de pago: acción → enviar_link_pago");
    }
  } else if (salida.accion === "enviar_link_pago") {
    salida.accion = "ninguna";
    avisar("accion_corregida", "Acción enviar_link_pago sin enlace de pago → ninguna");
  }

  // 5. Identidad
  if (hablaComoDueno(todo)) bloquear("identidad", `Habla como si fuera ${negocio.nombreDueno}`);

  // 6. Señales de alarma: nunca vender ni proponer llamada
  const propone = RE_PROPUESTA_LLAMADA.test(todo) || salida.accion === "traspaso_agendar";
  if (salida.ficha.senales_alarma.length) {
    if (propone) bloquear("llamada_con_alarma", "Propone llamada con señales de alarma");
    if (salida.accion !== "alerta") {
      salida.accion = "alerta";
      salida.estado = "alerta";
      avisar("accion_corregida", "Hay señales de alarma: acción → alerta");
    }
  } else if (propone) {
    // 7. Propuesta de llamada: solo con la ficha completa
    const faltan = datosQueFaltanParaLlamada(salida.ficha);
    if (faltan.length) {
      bloquear("llamada_sin_datos", `Faltan datos para proponer la llamada: ${faltan.join("; ")}`);
    } else if (salida.accion !== "traspaso_agendar") {
      salida.accion = "traspaso_agendar";
      salida.estado = "propuesta_llamada";
      avisar("accion_corregida", "Propone llamada con mañana/tarde: acción → traspaso_agendar");
    }
  }

  // 8. Estilo (avisos, no bloquean)
  const preguntas = (todo.match(/\?/g) ?? []).length;
  if (preguntas > 1) avisar("varias_preguntas", `${preguntas} signos de interrogación en el turno`);
  for (const b of burbujas) if (b.length > 450) avisar("burbuja_larga", `${b.length} caracteres`);
  const dosPuntos = (todo.replace(RE_URL, "").match(/:(?!\d)/g) ?? []).length; // sin URLs ni horas
  if (dosPuntos > 1) avisar("dos_puntos", `${dosPuntos} veces ":" en el turno`);

  return { salida, problemas };
}

/** Seguimientos automáticos: limpia el texto y lo descarta (null) si lleva importes, enlaces o habla como el dueño. */
export function revisarSeguimiento(texto) {
  const limpio = limpiarBurbuja(String(texto ?? "")).replace(/^["“]|["”]$/g, "").trim();
  if (!limpio || limpio.length > 400) return null;
  if (importesEnTexto(limpio).length || limpio.match(RE_URL) || hablaComoDueno(limpio)) return null;
  return limpio;
}

export function hayBloqueo(problemas) {
  return problemas.some((p) => p.bloqueante);
}
