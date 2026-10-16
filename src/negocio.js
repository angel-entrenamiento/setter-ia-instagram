// Datos del negocio de cada usuario (los edita en el panel → Ajustes y se guardan en la base de datos).
// El resto del código los lee de aquí (negocio.*) o de config (modo prueba, modelo, email, zona horaria).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config, RAIZ } from "./config.js";

export const NEGOCIO_POR_DEFECTO = Object.freeze({
  nombreAsistente: "Alex",
  nombreDueno: "",
  nombreNegocio: "",
  cuentaInstagram: "",
  aQueSeDedica: "",
  emailAvisos: config.emailAvisos,
  zonaHoraria: config.zonaHoraria,
  paisPrincipal: "España",
  modelo: config.modelo,
  esfuerzo: config.esfuerzo,
  modoPrueba: config.modoPrueba,
  listaBlanca: config.listaBlanca.join(", "),
  decirVirtualAlPresentarse: true,
  bienvenidaManual: "",
  descripcionLlamada: "una videollamada gratuita y sin compromiso de 15-20 minutos",
  exigirDecisor: true,
  productoBaratoActivo: false,
  productoBaratoNombre: "",
  productoBaratoImportes: "",
  productoBaratoEnlacePago: "",
  seguimientosAutomaticos: true,
  emailSeguimientos: true,
  resumenSemanal: true,
  informeDudas: true,
  actualizacionesAutomaticas: true,
  etiquetasNoResponder: "ALUMNO",
  etiquetaPausa: "IA_PAUSA",
  etiquetaReactivar: "IA_ON",
  avisarEtiquetasNoResponder: true,
});

/** Valores actuales (se rellenan con cargarNegocio al arrancar). */
export const negocio = { ...NEGOCIO_POR_DEFECTO };

const lista = (t) =>
  String(t ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);

export function importesProductoBarato() {
  return String(negocio.productoBaratoImportes ?? "")
    .split(/[,;\s]+/)
    .map((s) => Number(s.replace(/[€$]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export const hayProductoBarato = () =>
  Boolean(negocio.productoBaratoActivo && negocio.productoBaratoNombre && negocio.productoBaratoEnlacePago);

/** Etiquetas de ManyChat a las que el asistente nunca contesta (en mayúsculas, como las devuelve ManyChat). */
export function etiquetasNoResponder() {
  return String(negocio.etiquetasNoResponder ?? "")
    .split(/[,;\n]+/)
    .map((s) => s.trim().replace(/^[(\[«"']+|[)\]»"']+$/g, "").trim().toUpperCase())
    .filter(Boolean);
}

const limpiarEtiqueta = (t) => String(t ?? "").trim().replace(/^[(\[«"']+|[)\]»"']+$/g, "").trim().toUpperCase();

/** Nombre en ManyChat de las etiquetas de control (cada uno puede usar las suyas en Ajustes). */
export function nombreEtiqueta(interna) {
  if (interna === "IA_PAUSA") return limpiarEtiqueta(negocio.etiquetaPausa) || "IA_PAUSA";
  if (interna === "IA_ON") return limpiarEtiqueta(negocio.etiquetaReactivar) || "IA_ON";
  return interna;
}

/** ¿Tiene alguna etiqueta de «no contestar» (clientes, amigos…)? */
export const tieneEtiquetaNoResponder = (etiquetas = []) => {
  const lista = etiquetasNoResponder();
  return etiquetas.some((e) => lista.includes(String(e).trim().toUpperCase()));
};

/** Nombre con el que el asistente se refiere al dueño ("el responsable" si aún no está puesto). */
export const dueno = () => negocio.nombreDueno || "el responsable";

function aplicar(datos) {
  Object.assign(negocio, NEGOCIO_POR_DEFECTO, datos);
  negocio.cuentaInstagram = String(negocio.cuentaInstagram ?? "").trim().replace(/^@/, "");
  config.modoPrueba = Boolean(negocio.modoPrueba);
  config.listaBlanca = lista(negocio.listaBlanca);
  config.modelo = ["opus", "sonnet"].includes(negocio.modelo) ? negocio.modelo : "opus";
  config.esfuerzo = ["low", "medium", "high"].includes(negocio.esfuerzo) ? negocio.esfuerzo : "medium";
  config.emailAvisos = String(negocio.emailAvisos ?? "").trim();
  config.zonaHoraria = negocio.zonaHoraria || "Europe/Madrid";
  config.versionConocimiento++;
}

/** Lee los ajustes guardados y genera los secretos internos si faltan. */
export function cargarNegocio(almacen) {
  let guardado = {};
  try {
    guardado = JSON.parse(almacen.ajuste("negocio") ?? "{}");
  } catch {
    guardado = {};
  }
  aplicar(guardado);
  for (const [clave, campo] of [
    ["token_manychat", "tokenManychatEntrada"],
    ["secreto_enlaces", "secretoEnlaces"],
  ]) {
    if (config[campo]) continue;
    let valor = almacen.ajuste(clave);
    if (!valor) {
      valor = crypto.randomBytes(24).toString("hex");
      almacen.fijarAjuste(clave, valor);
    }
    config[campo] = valor;
  }
}

/**
 * Sin servidor (simulador, Claude Code): usa los ajustes descargados del panel en mi-conocimiento/ajustes.json
 * con `npm run conocimiento -- bajar`, si existen.
 */
export function cargarNegocioLocal() {
  const ruta = path.join(RAIZ, "mi-conocimiento", "ajustes.json");
  if (!fs.existsSync(ruta)) return false;
  aplicar(JSON.parse(fs.readFileSync(ruta, "utf8")));
  return true;
}

const BOOLEANOS =Object.keys(NEGOCIO_POR_DEFECTO).filter((k) => typeof NEGOCIO_POR_DEFECTO[k] === "boolean");

/** Guarda los ajustes que llegan del formulario del panel (URLSearchParams u objeto). */
export function guardarNegocio(almacen, entrada) {
  const obtener = (k) => (entrada instanceof URLSearchParams ? entrada.get(k) : entrada[k]);
  const datos = { ...negocio };
  for (const k of Object.keys(NEGOCIO_POR_DEFECTO)) {
    const v = obtener(k);
    if (BOOLEANOS.includes(k)) datos[k] = v === true || v === "si" || v === "on";
    else if (v !== null && v !== undefined) datos[k] = String(v).trim();
  }
  almacen.fijarAjuste("negocio", JSON.stringify(datos));
  aplicar(datos);
  return negocio;
}

/** Cambia solo el modo prueba (botón del panel). */
export function fijarModoPrueba(almacen, activo) {
  return guardarNegocio(almacen, { ...negocio, modoPrueba: activo });
}

/** Sustituye {asistente}, {dueno}, {negocio}, {cuenta}, {llamada} y {producto_barato} en los textos de conocimiento. */
export function rellenarMarcadores(texto) {
  const valores = {
    asistente: negocio.nombreAsistente || "el asistente",
    dueno: dueno(),
    negocio: negocio.nombreNegocio || "el negocio",
    cuenta: negocio.cuentaInstagram ? `@${negocio.cuentaInstagram}` : "la cuenta",
    llamada: negocio.descripcionLlamada || "una videollamada",
    producto_barato: negocio.productoBaratoNombre || "el producto de venta directa",
  };
  return String(texto ?? "").replace(/\{(asistente|dueno|negocio|cuenta|llamada|producto_barato)\}/g, (_, k) => valores[k]);
}
