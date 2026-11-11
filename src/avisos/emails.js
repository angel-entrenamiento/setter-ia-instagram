// Construcción de los emails de aviso al dueño de la cuenta. El envío está en src/integraciones/email.js.
import { config } from "../config.js";
import { negocio } from "../negocio.js";
import { enlaceNotaAudio, enlacePanel } from "../utilidades/enlaces.js";

const ETIQUETAS = ["AGENDAR", "AUDIO", "ALERTA", "HUMANO", "PAGO", "ERROR"];

const asistente = () => negocio.nombreAsistente;
const para = () => config.emailAvisos;

function quien(conv) {
  const nombre = conv.ficha?.nombre || conv.nombre || "Sin nombre";
  return conv.igUsuario ? `${nombre} (@${conv.igUsuario})` : nombre;
}

export function nombreAutor(rol) {
  return { lead: "LEAD", bot: asistente().toUpperCase(), dueno: (negocio.nombreDueno || "TÚ").toUpperCase(), sistema: "SISTEMA" }[rol] ?? rol;
}

function lineaHistorial(m) {
  const tipo = m.tipo && m.tipo !== "texto" ? `[${m.tipo}] ` : "";
  return `${nombreAutor(m.rol)}: ${tipo}${m.texto}`;
}

export function fichaEnTexto(f) {
  const v = (x) => (x === "" || x === undefined || x === null ? "—" : x);
  return [
    `• Situación: ${v(f.situacion)} (encaja con el perfil: ${v(f.encaja_perfil)})`,
    `• Desde cuándo: ${v(f.desde_cuando)}`,
    `• Cómo le afecta: ${v(f.afectacion)}`,
    `• Qué ha probado: ${v(f.probado)}`,
    `• Objetivo: ${v(f.objetivo)}`,
    `• Prioridad (1-10): ${f.prioridad_1a10 || "—"}`,
    `• Dispuesto/a a implicarse: ${v(f.dispuesto_implicarse)}`,
    `• Quién decide el dinero: ${v(f.decisor_economico)} (en la llamada: ${v(f.decisor_en_llamada)})`,
    `• Escribe un familiar: ${f.escribe_familiar ? "sí" : "no"}`,
    `• País / zona horaria: ${v(f.pais_zona_horaria)}`,
    `• Prefiere: ${v(f.preferencia_franja)}`,
    `• Objeciones: ${f.objeciones?.length ? f.objeciones.join("; ") : "—"}`,
    `• Señales de alarma: ${f.senales_alarma?.length ? f.senales_alarma.join("; ") : "ninguna"}`,
    `• Nivel de cualificación: ${v(f.nivel_cualificacion)}`,
    negocio.productoBaratoActivo ? `• Apto para ${negocio.productoBaratoNombre || "venta directa"}: ${v(f.apto_producto_barato)}` : null,
    f.datos_extra ? `• Otros datos: ${f.datos_extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function intro(etiqueta) {
  const a = asistente();
  return {
    AGENDAR: `${a} ha propuesto la llamada y ha preguntado mañana o tarde. Está PAUSADO en esta conversación: te toca cerrar día, hora y enlace.`,
    AUDIO: `Esta persona ha enviado un AUDIO (o un archivo que ${a} no puede leer). ${a} no lo ha contestado y está pausado. Escúchalo y contesta tú. Después apunta qué dijo en el enlace de abajo: así ${a} se reactiva y puede seguir.`,
    ALERTA: `${a} ha detectado una posible SEÑAL DE ALARMA. No ha vendido nada, ha recomendado lo que indican tus reglas y está pausado.`,
    HUMANO: `Esta conversación necesita que la lleves tú (pide una persona, está molesto/a o el caso se sale del guion). ${a} está pausado.`,
    PAGO: `Aviso informativo: ${a} ha enviado el enlace de pago de ${negocio.productoBaratoNombre || "tu producto de venta directa"}. Sigue atendiendo la conversación.`,
    ERROR: `${a} no ha podido generar una respuesta válida y NO ha enviado nada. Revisa la conversación y contesta tú si hace falta.`,
  }[etiqueta];
}

/**
 * @param {string} etiqueta una de ETIQUETAS
 * @param {object} conv conversación
 * @param {{ detalle?: string, enlaceChat?: string }} extra
 */
export function construirEmail(etiqueta, conv, extra = {}) {
  if (!ETIQUETAS.includes(etiqueta)) throw new Error(`Etiqueta de email desconocida: ${etiqueta}`);
  const franja = conv.ficha?.preferencia_franja ? ` — prefiere ${conv.ficha.preferencia_franja}` : "";
  const asunto = `[${etiqueta}] ${quien(conv)}${etiqueta === "AGENDAR" ? franja : ""}`;
  const ultimas = conv.historial.slice(-10).map(lineaHistorial).join("\n");
  const partes = [
    intro(etiqueta),
    extra.detalle ? `\nDetalle: ${extra.detalle}` : "",
    `\nContacto: ${quien(conv)}`,
    `Abrir el chat en ManyChat: ${extra.enlaceChat || conv.enlaceChat || "(no disponible)"}`,
    `Ver en el panel: ${enlacePanel(conv.id)}`,
    etiqueta === "AUDIO"
      ? `\n👉 Cuando le hayas contestado, apunta en una línea qué dijo (y qué le contestaste) y ${asistente()} se reactiva:\n${enlaceNotaAudio(conv.id)}`
      : "",
    `\nFICHA\n${fichaEnTexto(conv.ficha)}`,
    `\nÚLTIMOS MENSAJES\n${ultimas || "—"}`,
  ];
  return { etiqueta, para: para(), asunto, cuerpo: partes.filter(Boolean).join("\n") };
}

/** Aviso corto cuando, tras la propuesta de llamada, el lead dice si prefiere mañana o tarde. */
export function construirEmailPreferencia(conv, textoLead) {
  const franja = conv.ficha?.preferencia_franja;
  return {
    etiqueta: "AGENDAR",
    para: para(),
    asunto: `[AGENDAR] ${quien(conv)} prefiere ${franja}`,
    cuerpo: [
      `Ha contestado a la propuesta de llamada: "${textoLead}"`,
      `Prefiere: ${franja}${conv.ficha?.pais_zona_horaria ? ` · ${conv.ficha.pais_zona_horaria}` : ""}`,
      "",
      `Abrir el chat en ManyChat: ${conv.enlaceChat || "(no disponible)"}`,
      `Ver en el panel: ${enlacePanel(conv.id)}`,
      "",
      `${asistente()} sigue pausado en esta conversación: te toca cerrar día, hora y enlace.`,
    ].join("\n"),
  };
}

/**
 * Email diario de las 9:00 con los seguimientos 2 y 3 ya redactados, para enviarlos a mano.
 * @param {{ conv: object, numero: 2|3, texto: string }[]} lista
 */
export function construirEmailSeguimientos(lista) {
  const bloques = lista.map(({ conv, numero, texto }, i) =>
    [
      `${i + 1}. ${quien(conv)} — seguimiento ${numero} (${numero === 2 ? "día 3" : "día 6-7, el último"})`,
      `   Objetivo: ${conv.ficha?.objetivo || "—"}`,
      `   Abrir el chat: ${conv.enlaceChat || enlacePanel(conv.id)}`,
      `   Mensaje para copiar:`,
      `   ${texto}`,
    ].join("\n"),
  );
  return {
    etiqueta: "SEGUIMIENTOS",
    para: para(),
    asunto: `[SEGUIMIENTOS] ${lista.length} mensaje${lista.length === 1 ? "" : "s"} para enviar hoy`,
    cuerpo: [
      "Estas personas dejaron de contestar. Meta no permite que un sistema automático les escriba pasadas 24 h, así que te los dejo redactados para que los envíes tú desde Instagram (tienes hasta 7 días desde su último mensaje).",
      `Cuando contesten, ${asistente()} retoma la conversación.`,
      "",
      bloques.join("\n\n"),
    ].join("\n"),
  };
}

export function nombresMetricas() {
  const a = asistente();
  return {
    atendida: `Conversaciones atendidas por ${a}`,
    cualificado: "Cualificadas para llamada",
    llamada_propuesta: "Llamadas propuestas ([AGENDAR])",
    enlace_pago: `Enlaces de pago de ${negocio.productoBaratoNombre || "venta directa"} enviados`,
    fuera_de_foco: "Fuera de foco (no encajan)",
    audio: "Audios recibidos ([AUDIO])",
    alerta: "Señales de alarma ([ALERTA])",
    humano: "Pasadas a ti ([HUMANO])",
    seguimiento_1: `Seguimientos enviados por ${a}`,
    error: "Errores (no se respondió)",
  };
}

const ESTADO_META = { verde: "🟢 en la meta", amarillo: "🟡 cerca de la meta", rojo: "🔴 por debajo de la meta", sin_datos: "sin datos" };
const num = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-ES", { maximumFractionDigits: 1 }));

/** Bloque «Cómo vas frente a tus metas» con las tarjetas del CRM de esta semana y la anterior. */
export function lineasMetas(actual, anterior, pendientes = 0, objetivo = null) {
  const t = actual.tarjetas, a = anterior?.tarjetas;
  const antes = (clave, unidad) => (a?.[clave] && a[clave].valor !== null ? ` (semana anterior: ${num(a[clave].valor)}${unidad})` : "");
  const linea = (nombre, clave, unidad, detalle, meta) =>
    `• ${nombre}: ${num(t[clave].valor)}${t[clave].valor === null ? "" : unidad}${antes(clave, unidad)} · ${detalle}${meta ? ` · meta ${meta} · ${ESTADO_META[t[clave].semaforo] ?? ""}` : ""}`;
  const fallan = t.asistencia && t.asistencia.semaforo === "rojo" ? t.asistencia.b - t.asistencia.a : 0;
  return [
    "CÓMO VAS FRENTE A TUS METAS (últimos 7 días)",
    objetivo ? `• Agendas de la semana: ${actual.citas} de tu objetivo de ${objetivo}${actual.citas >= objetivo ? " · 🟢 objetivo cumplido" : ` · te faltaron ${objetivo - actual.citas}`}` : null,
    linea("Respuesta a bienvenidas", "respuesta", " %", `${t.respuesta.a} de ${t.respuesta.b} bienvenidas`, "20 %"),
    linea("Conversaciones por cada 100 bienvenidas", "conversaciones", "", `${t.conversaciones.a} con 3+ mensajes`, "unas 10"),
    linea("Agendas outbound (de cada 100 bienvenidas)", "citas", " %", `${t.citas.a} citas`, "1-3 %"),
    t.citasInbound ? linea("Agendas inbound (te escriben o palabra clave)", "citasInbound", " %", `${t.citasInbound.a} de ${t.citasInbound.b}`, "30-50 %") : null,
    t.asistencia ? linea("Llamadas agendadas que se realizan", "asistencia", " %", `${t.asistencia.a} de ${t.asistencia.b} marcadas`, "80 % o más") : null,
    linea("Llamadas que acaban en cliente", "cierre", " %", `${t.cierre.a} de ${t.cierre.b} realizadas`, ""),
    fallan ? `⚠️ Ojo: no se presentaron ${fallan} de ${t.asistencia.b} llamadas (más del 20 %). Eso suele indicar que algo falla en cómo se agendan.` : null,
    t.respuesta.b ? "" : "Ojo: no hay bienvenidas apuntadas esta semana. Súmalas en el CRM (pestaña Registro) para que salgan los porcentajes.",
    pendientes ? `Tienes ${pendientes} ${pendientes === 1 ? "cosa pendiente" : "cosas pendientes"} en «Te toca a ti»: ${config.urlPublica}/panel/crm` : `CRM: ${config.urlPublica}/panel/crm`,
    "",
  ]
    .filter((x) => x !== null)
    .filter((x, i, arr) => x !== "" || arr[i - 1] !== "");
}

export function construirEmailResumenSemanal(metricas, { desde, hasta, costeUsd, crm = null }) {
  const fmt = (d) => d.toLocaleDateString("es-ES", { timeZone: config.zonaHoraria, day: "numeric", month: "short" });
  const lineas = [...(crm ? lineasMetas(crm.actual, crm.anterior, crm.pendientes, crm.objetivo) : []), crm ? "ACTIVIDAD DE LA SEMANA" : "", ...Object.entries(nombresMetricas()).map(([k, nombre]) => `• ${nombre}: ${metricas[k] ?? 0}`)].filter((x) => x !== "" || crm);
  return {
    etiqueta: "RESUMEN",
    para: para(),
    asunto: `[RESUMEN] Semana de ${asistente()} (${fmt(desde)} – ${fmt(hasta)})`,
    cuerpo: [
      ...lineas,
      "",
      costeUsd !== undefined ? `Gasto aproximado de IA esta semana: ${costeUsd.toFixed(2)} $` : "",
      "Más detalle en el panel.",
    ].join("\n"),
  };
}
