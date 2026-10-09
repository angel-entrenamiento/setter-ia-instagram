// Conocimiento del negocio: 6 secciones que cada usuario edita desde el panel (o con Claude Code).
// Se guardan en la base de datos; si una sección nunca se ha editado, se usa la plantilla de /conocimiento.
import fs from "node:fs";
import path from "node:path";
import { config, RAIZ } from "../config.js";

const CARPETA_PLANTILLAS = path.join(RAIZ, "conocimiento");

// Orden fijo: el prompt debe ser idéntico byte a byte entre peticiones para aprovechar la caché.
export const SECCIONES = [
  {
    archivo: "00_reglas_del_asistente.md",
    titulo: "REGLAS DEL ASISTENTE",
    nombre: "Reglas del asistente",
    ayuda: "Quién es el asistente, a quién lleva a llamada, qué nunca puede decir, señales de alarma y estilo.",
  },
  {
    archivo: "01_marca_y_voz.md",
    titulo: "MARCA, AVATAR Y VOZ",
    nombre: "Marca, cliente ideal y forma de escribir",
    ayuda: "Quién eres, a quién ayudas, qué le duele a tu cliente ideal y cómo escribes tú por MD.",
  },
  {
    archivo: "02_guion_y_cualificacion.md",
    titulo: "GUION Y CUALIFICACIÓN",
    nombre: "Guion y cualificación",
    ayuda: "Cómo se abre la conversación, qué preguntas se hacen y cuándo se propone la llamada.",
  },
  {
    archivo: "03_objeciones_y_respuestas.md",
    titulo: "OBJECIONES Y RESPUESTAS",
    nombre: "Objeciones y respuestas",
    ayuda: "Las dudas y frenos típicos de tus leads y cómo respondes tú a cada uno.",
  },
  {
    archivo: "04_productos_y_enlaces.md",
    titulo: "PRODUCTOS, RECURSOS Y ENLACES",
    nombre: "Productos, recursos y enlaces",
    ayuda: "Tus programas, el producto de venta directa (si lo hay), recursos gratuitos y casos de éxito. El asistente SOLO envía enlaces que estén aquí.",
  },
  {
    archivo: "05_ejemplos_conversaciones.md",
    titulo: "EJEMPLOS REALES (imitar ritmo y tono, no copiar frases)",
    nombre: "Ejemplos de conversaciones reales",
    ayuda: "Pega 3-6 conversaciones tuyas que acabaron en llamada (cambia los nombres). Es lo que más ayuda a que suene como tú.",
  },
];

const ARCHIVOS = new Set(SECCIONES.map((s) => s.archivo));
let almacen = null;

/** Conecta el conocimiento con la base de datos (lo hace el servidor al arrancar). */
export function usarAlmacenConocimiento(a) {
  almacen = a;
  config.versionConocimiento++;
}

export function plantilla(archivo) {
  return fs.readFileSync(path.join(CARPETA_PLANTILLAS, archivo), "utf8").trim();
}

// Copia local descargada del panel con `npm run conocimiento -- bajar` (la usan el simulador y Claude Code)
export const CARPETA_LOCAL = path.join(RAIZ, "mi-conocimiento");

function copiaLocal(archivo) {
  const ruta = path.join(CARPETA_LOCAL, archivo);
  return fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8") : null;
}

export function leerSeccion(archivo) {
  if (!ARCHIVOS.has(archivo)) throw new Error(`Sección desconocida: ${archivo}`);
  const texto = almacen ? almacen.ajuste(`conocimiento:${archivo}`) : copiaLocal(archivo);
  return (texto ?? plantilla(archivo)).trim();
}

export function guardarSeccion(archivo, texto) {
  if (!ARCHIVOS.has(archivo)) throw new Error(`Sección desconocida: ${archivo}`);
  if (!almacen) throw new Error("El conocimiento no está conectado a la base de datos");
  const limpio = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  const actual = leerSeccion(archivo);
  if (limpio === actual) return false;
  almacen.fijarAjuste(`conocimiento_anterior:${archivo}`, actual);
  almacen.fijarAjuste(`conocimiento:${archivo}`, limpio);
  almacen.fijarAjuste(`conocimiento_fecha:${archivo}`, new Date().toISOString());
  config.versionConocimiento++;
  return true;
}

/** Vuelve a la versión anterior de una sección (deshacer el último cambio). */
export function restaurarAnterior(archivo) {
  const anterior = almacen?.ajuste(`conocimiento_anterior:${archivo}`);
  if (anterior === null || anterior === undefined) return false;
  return guardarSeccion(archivo, anterior);
}

export const hayAnterior = (archivo) => almacen?.ajuste(`conocimiento_anterior:${archivo}`) != null;
export const fechaSeccion = (archivo) => almacen?.ajuste(`conocimiento_fecha:${archivo}`) ?? null;

/** Cuántos huecos "[RELLENAR…]" quedan en cada sección. */
export function huecosPorRellenar(archivo) {
  return (leerSeccion(archivo).match(/\[RELLENAR/gi) ?? []).length;
}

export function todoElConocimiento() {
  return Object.fromEntries(SECCIONES.map((s) => [s.archivo, leerSeccion(s.archivo)]));
}
