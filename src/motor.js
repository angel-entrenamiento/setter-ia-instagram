// Motor de conversación: recibe eventos, decide si el asistente responde, llama al modelo,
// aplica las reglas duras, actualiza estado/ficha/pausas y prepara los emails de aviso al dueño.
// No sabe nada de Instagram ni de ManyChat: eso lo pone la capa de integración o el simulador.
import { config, idModelo } from "./config.js";
import { negocio, dueno, hayProductoBarato } from "./negocio.js";
import { conversacionNueva } from "./almacen/conversaciones.js";
import { pedirTurno, pedirTexto, ErrorModelo } from "./cerebro/llm.js";
import { aplicarReglas, hayBloqueo } from "./cerebro/reglas.js";
import { construirPrompt } from "./cerebro/prompt.js";
import { construirEmail, construirEmailPreferencia } from "./avisos/emails.js";

// Pausas que solo levanta el dueño con IA_ON (o reset en pruebas)
const PAUSAS_FUERTES = ["agendar", "humano", "alerta", "alumno", "etiqueta"];

export const MENSAJE_RESET = "🔄 Conversación reiniciada. Escribe como si fueras un lead nuevo.";

export function enListaBlanca(conv) {
  return config.listaBlanca.includes((conv.igUsuario ?? "").toLowerCase()) || config.listaBlanca.includes(conv.igId);
}

function registrar(conv, rol, tipo, texto, extra = {}) {
  conv.historial.push({ rol, tipo, texto, fecha: new Date().toISOString(), ...extra });
}

function pausar(conv, motivo) {
  conv.pausa = { motivo, desde: new Date().toISOString() };
}

/** Reinicia la conversación conservando la identidad del contacto (comando #reset). */
export function reiniciar(conv) {
  const limpia = conversacionNueva({
    id: conv.id,
    igUsuario: conv.igUsuario,
    igId: conv.igId,
    nombre: conv.nombre,
    origen: conv.origen,
  });
  const vinculo = { manychatId: conv.manychatId, enlaceChat: conv.enlaceChat };
  Object.keys(conv).forEach((k) => delete conv[k]);
  Object.assign(conv, limpia);
  if (vinculo.manychatId) Object.assign(conv, vinculo);
  return conv;
}

/** Etiquetas de control de ManyChat: IA_PAUSA, IA_ON y ALUMNO (= cualquier etiqueta de «no contestar» de Ajustes). */
export function aplicarEtiqueta(conv, etiqueta, { quitar = false } = {}) {
  const e = etiqueta.toUpperCase();
  conv.etiquetas = quitar ? conv.etiquetas.filter((x) => x !== e) : [...new Set([...conv.etiquetas, e])];
  if (quitar) {
    if (e === "IA_PAUSA" && conv.pausa?.motivo === "etiqueta") conv.pausa = null;
    if (e === "ALUMNO" && conv.pausa?.motivo === "alumno") conv.pausa = null;
    return conv;
  }
  if (e === "IA_PAUSA") pausar(conv, "etiqueta");
  if (e === "ALUMNO") pausar(conv, "alumno");
  if (e === "IA_ON") {
    conv.pausa = null;
    conv.cerrada = false;
    conv.etiquetas = conv.etiquetas.filter((x) => !["IA_PAUSA", "IA_ON"].includes(x));
    conv.avisos.push(`${dueno()} te ha reactivado en esta conversación. Lee lo último que ha pasado y sigue con prudencia.`);
  }
  return conv;
}

// ---------- Construcción de la petición al modelo ----------

function textoDeEntrada(m) {
  if (m.rol === "lead") {
    if (m.tipo === "audio")
      return m.resumen
        ? `[Ha enviado un audio. Según ${dueno()}, dijo: ${m.resumen}]`
        : "[Ha enviado un audio que no puedes escuchar]";
    if (m.tipo === "imagen") return `[Ha enviado una imagen]${m.texto ? ` ${m.texto}` : ""}`;
    if (m.tipo === "historia") return `[Responde a una historia de la cuenta] ${m.texto}`;
    return m.texto;
  }
  if (m.rol === "dueno") {
    if (m.tipo === "audio")
      return m.resumen
        ? `[${dueno()} respondió personalmente con un audio. Según su nota: ${m.resumen}]`
        : `[${dueno()} respondió personalmente con un audio. No sabes qué dijo: no le contradigas]`;
    return `[Mensaje escrito por ${dueno()} personalmente] ${m.texto}`;
  }
  return m.texto; // bot
}

export function historialAMensajes(conv) {
  const mensajes = [];
  for (const m of conv.historial) {
    if (m.rol === "sistema" || m.tipo === "nota") continue;
    const role = m.rol === "lead" ? "user" : "assistant";
    const texto = textoDeEntrada(m);
    const ultimo = mensajes.at(-1);
    if (ultimo?.role === role) ultimo.content += `\n${texto}`;
    else mensajes.push({ role, content: texto });
  }
  if (mensajes[0]?.role === "assistant") {
    mensajes.unshift({ role: "user", content: "[El contacto aún no había escrito; la conversación empezó con un mensaje de la cuenta]" });
  }
  return mensajes;
}

const ORIGENES = {
  espontaneo: "MD espontáneo",
  info: "pide información del programa",
  precio: "pregunta el precio de primeras",
  anuncio: "viene de un anuncio",
  historia: "responde a una historia",
  recurso: "contesta después de recibir un recurso de ManyChat",
  bienvenida: "contesta a la bienvenida manual que el dueño envía a los seguidores nuevos",
};

function fechaLocal(fecha = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: config.zonaHoraria,
    dateStyle: "full",
    timeStyle: "short",
  }).format(fecha);
}

function presentacion() {
  const quien = `${negocio.nombreAsistente}, del equipo de ${dueno()}`;
  return negocio.decirVirtualAlPresentarse
    ? `preséntate como ${negocio.nombreAsistente}, el asistente virtual del equipo de ${dueno()}`
    : `preséntate como ${quien} (sin decir que eres virtual salvo que te lo pregunten)`;
}

const sigueBienvenida = () =>
  `Esta conversación la empezó ${dueno()} en persona con su bienvenida: NO te presentes (solo si te pregunta si eres un bot o una IA, di la verdad). Sigue la conversación con naturalidad, hablando en "nosotros/el equipo" y evitando nombrar a ${dueno()} en tercera persona, porque la persona cree que habla con él/ella.`;

function textoPresentacion(conv) {
  if (conv.origen === "bienvenida") return sigueBienvenida();
  if (conv.presentado) return "Ya te has presentado en esta conversación: no lo repitas.";
  const primerContacto = !conv.historial.some((m) => m.rol === "bot" || m.rol === "dueno");
  if (primerContacto && conv.origen === "espontaneo" && negocio.bienvenidaManual)
    return [
      `Es tu PRIMER mensaje en esta conversación. Ojo: a los seguidores nuevos ${dueno()} les escribe a mano una bienvenida que tú NO ves. Suele ser parecida a esta: "${negocio.bienvenidaManual}".`,
      `- Si el mensaje del lead parece una RESPUESTA a esa bienvenida (contesta a lo que se le preguntaba, sin saludar ni explicar desde cero por qué escribe) → ${sigueBienvenida()}`,
      `- Si no lo parece (saluda, pregunta por el programa, cuenta su caso desde cero…) → ${presentacion()}.`,
    ].join("\n");
  return `Es tu PRIMER mensaje en esta conversación: ${presentacion()}.`;
}

export function construirContexto(conv, avisosExtra = []) {
  const avisos = [...conv.avisos, ...avisosExtra];
  return [
    "[CONTEXTO INTERNO — no lo menciones al lead]",
    `Fecha y hora (${config.zonaHoraria}): ${fechaLocal()}.`,
    `Contacto: ${conv.nombre ? `nombre en Instagram "${conv.nombre}"` : "nombre desconocido"}${conv.igUsuario ? `, usuario @${conv.igUsuario}` : ""}.`,
    `Cómo ha llegado: ${ORIGENES[conv.origen] ?? conv.origen}${conv.recurso ? ` (recurso: ${conv.recurso})` : ""}.`,
    textoPresentacion(conv),
    `Estado actual: ${conv.estado}.`,
    hayProductoBarato() ? `Enlace de pago de ${negocio.productoBaratoNombre} ya enviado: ${conv.enlacePagoEnviado ? "sí" : "no"}.` : null,
    `Ficha actual: ${JSON.stringify(conv.ficha)}`,
    avisos.length ? `Avisos del sistema:\n- ${avisos.join("\n- ")}` : "Avisos del sistema: ninguno.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function calcularRetraso(burbujas) {
  const largo = burbujas.join(" ").length;
  const { retrasoMinSeg: min, retrasoMaxSeg: max } = config;
  const base = min + Math.min(1, largo / 450) * (max - min);
  const variacion = base * (Math.random() * 0.3 - 0.15);
  return Math.round(Math.min(max, Math.max(min, base + variacion)));
}

function fusionarFicha(anterior, nueva) {
  const r = { ...anterior };
  for (const [k, v] of Object.entries(nueva)) {
    if (Array.isArray(v)) r[k] = [...new Set([...(anterior[k] ?? []), ...v])];
    else if (v !== "" && v !== "desconocido" && !(k === "prioridad_1a10" && v === 0)) r[k] = v;
    else if (k === "nivel_cualificacion") r[k] = v;
    else if (typeof v === "boolean") r[k] = anterior[k] || v; // una vez detectado (familiar), se mantiene
  }
  return r;
}

/** "Mejor por la mañana" → mañana; "mañana por la tarde" → tarde; sin franja clara → null. */
export function detectarFranja(texto) {
  const t = (texto ?? "").toLowerCase();
  if (/\btardes?\b/.test(t)) return "tarde";
  if (/(por la|de|en la|a la|las) ma[ñn]anas?|ma[ñn]anas\b|temprano|primera hora/.test(t) || /^\s*(por la )?ma[ñn]ana[.!\s]*$/.test(t)) return "mañana";
  return null;
}

/** Anota un mensaje del lead en el historial sin responder (se usa al agrupar varios mensajes seguidos). */
export function anotarMensajeLead(conv, evento) {
  registrar(conv, "lead", evento.tipo, evento.texto ?? "");
  conv.ultimoMensajeLeadAt = new Date().toISOString();
  conv.seguimientos = { s0: null, s1: null, s2: null, s3: null };
}

// ---------- Procesamiento de eventos ----------

/**
 * @typedef {{ tipo: 'texto'|'audio'|'imagen'|'historia'|'dueno_texto'|'dueno_audio'|'nota_audio', texto?: string,
 *             queDijo?: string, queContesto?: string }} Evento
 * @param {{ modelo?: string, esfuerzo?: string, simulacion?: boolean }} opciones simulacion: prueba desde el panel (salta la lista blanca)
 * @returns {Promise<{ respuestas: string[], retrasoSeg: number, emails: object[], ignorado?: string,
 *                     problemas?: object[], salida?: object, coste?: number }>}
 */
export async function procesarEvento(conv, evento, { modelo = config.modelo, esfuerzo = config.esfuerzo, simulacion = false } = {}) {
  const resultado = { respuestas: [], retrasoSeg: 0, emails: [], problemas: [], coste: 0 };
  const autorizado = simulacion || enListaBlanca(conv);

  // Modo prueba: solo cuentas de la lista blanca
  if (config.modoPrueba && !autorizado) return { ...resultado, ignorado: "modo_prueba" };

  // Comando de reinicio (solo lista blanca)
  if (evento.tipo === "texto" && evento.texto?.trim().toLowerCase() === config.comandoReset) {
    if (!autorizado) return { ...resultado, ignorado: "reset_no_autorizado" };
    reiniciar(conv);
    return { ...resultado, respuestas: [MENSAJE_RESET], reset: true };
  }

  // --- Mensajes del dueño de la cuenta ---
  if (evento.tipo === "dueno_texto" || evento.tipo === "dueno_audio") {
    const esAudio = evento.tipo === "dueno_audio";
    const leadYaHabiaEscrito = conv.historial.some((m) => m.rol === "lead");
    registrar(conv, "dueno", esAudio ? "audio" : "texto", esAudio ? "(audio)" : evento.texto);
    const motivo = conv.pausa?.motivo;
    if (!leadYaHabiaEscrito) {
      // Mensaje de apertura de la cuenta (bienvenida manual o recurso de ManyChat): el asistente sigue cuando conteste el lead
      if (conv.origen === "espontaneo") conv.origen = "bienvenida";
    } else if (!PAUSAS_FUERTES.includes(motivo)) {
      // El dueño ha contestado (tras un audio o sin él): el asistente sigue cuando el lead escriba.
      // Para quedarse él con la conversación, pone la etiqueta IA_PAUSA.
      conv.pausa = null;
      conv.avisos.push(
        `${dueno()} ha escrito personalmente en esta conversación. Sigue a partir de lo que dijo, sin contradecirle ni repetirlo. Si no sabes qué se dijo en algún audio, sé prudente y haz una pregunta abierta.`,
      );
    }
    return resultado;
  }

  if (evento.tipo === "nota_audio") {
    const audioLead = [...conv.historial].reverse().find((m) => m.rol === "lead" && m.tipo === "audio");
    const audioDueno = [...conv.historial].reverse().find((m) => m.rol === "dueno" && m.tipo === "audio");
    if (audioLead && evento.queDijo) audioLead.resumen = evento.queDijo;
    if (audioDueno && evento.queContesto) audioDueno.resumen = evento.queContesto;
    else if (evento.queContesto) conv.avisos.push(`${dueno()} le ha contestado (nota de ${dueno()}): ${evento.queContesto}`);
    if (!audioLead && evento.queDijo) conv.avisos.push(`Nota de ${dueno()} sobre lo que dijo la persona: ${evento.queDijo}`);
    registrar(conv, "dueno", "nota", `Nota de audio — dijo: ${evento.queDijo ?? "—"} / contestó: ${evento.queContesto ?? "—"}`);
    return resultado;
  }

  // --- Mensajes del lead ---
  registrar(conv, "lead", evento.tipo, evento.texto ?? "");
  conv.ultimoMensajeLeadAt = new Date().toISOString();
  conv.seguimientos = { s0: null, s1: null, s2: null, s3: null };

  if (conv.pausa?.motivo === "alumno") {
    const ultimoAviso = conv.ultimoAvisoAlumno ? Date.parse(conv.ultimoAvisoAlumno) : 0;
    if (negocio.avisarEtiquetasNoResponder && Date.now() - ultimoAviso > 12 * 3600 * 1000) {
      conv.ultimoAvisoAlumno = new Date().toISOString();
      resultado.emails.push(construirEmail("HUMANO", conv, { detalle: `Tiene una etiqueta de «no contestar» en ManyChat (${negocio.etiquetasNoResponder}): ${negocio.nombreAsistente} no le responde. Contesta tú si hace falta.` }));
    }
    return { ...resultado, ignorado: "alumno" };
  }

  if (evento.tipo === "audio") {
    if (!PAUSAS_FUERTES.includes(conv.pausa?.motivo)) pausar(conv, "audio");
    resultado.emails.push(construirEmail("AUDIO", conv));
    return { ...resultado, ignorado: "audio" };
  }

  // Tras [AGENDAR] el asistente está pausado, pero si el lead dice "mañana" o "tarde" lo apuntamos y avisamos
  if (conv.pausa?.motivo === "agendar" && evento.tipo === "texto") {
    const franja = detectarFranja(evento.texto);
    if (franja && franja !== conv.ficha.preferencia_franja) {
      conv.ficha.preferencia_franja = franja;
      resultado.emails.push(construirEmailPreferencia(conv, evento.texto));
    }
  }

  if (conv.pausa) return { ...resultado, ignorado: `pausada_${conv.pausa.motivo}` };

  if (conv.cerrada) {
    conv.cerrada = false;
    conv.avisos.push("Esta conversación se había cerrado y la persona ha vuelto a escribir: retómala con naturalidad.");
  }

  return generarTurno(conv, resultado, { modelo, esfuerzo });
}

async function generarTurno(conv, resultado, { modelo, esfuerzo }) {
  const mensajes = historialAMensajes(conv);
  let avisosExtra = [];
  let salidaFinal = null;

  for (let intento = 1; intento <= 2; intento++) {
    let r;
    try {
      r = await pedirTurno(mensajes, construirContexto(conv, avisosExtra), { modelo, esfuerzo });
    } catch (error) {
      if (!(error instanceof ErrorModelo)) throw error;
      resultado.problemas.push({ tipo: error.tipo, detalle: error.message, bloqueante: true });
      if (["clave", "red", "limite"].includes(error.tipo)) break; // reintentar no ayuda
      continue;
    }
    resultado.coste += r.coste;
    resultado.uso = r.uso;
    const { salida, problemas } = aplicarReglas(r.salida, conv);
    resultado.problemas.push(...problemas.map((p) => ({ ...p, intento })));
    if (!hayBloqueo(problemas)) {
      salidaFinal = salida;
      break;
    }
    avisosExtra = [
      "Tu respuesta anterior NO se ha enviado porque incumplía estas reglas. Corrígela:",
      ...problemas.filter((p) => p.bloqueante).map((p) => p.detalle),
      ...(problemas.some((p) => p.tipo === "llamada_sin_datos")
        ? ["Todavía no propongas la llamada: haz UNA pregunta para conseguir el dato que falta."]
        : []),
    ];
  }

  if (!salidaFinal) {
    resultado.emails.push(
      construirEmail("ERROR", conv, {
        detalle: resultado.problemas.filter((p) => p.bloqueante).map((p) => p.detalle).join(" | "),
      }),
    );
    return resultado;
  }

  // Aplicar la salida
  conv.avisos = [];
  conv.ficha = fusionarFicha(conv.ficha, salidaFinal.ficha);
  conv.estado = salidaFinal.estado;
  // Primer turno sin presentarse en un MD "espontáneo" = respondía a la bienvenida manual del dueño (no la vemos por ManyChat)
  const nombreAsistente = new RegExp(`\\b${negocio.nombreAsistente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (
    negocio.bienvenidaManual &&
    !conv.presentado &&
    conv.origen === "espontaneo" &&
    !salidaFinal.mensajes.some((b) => nombreAsistente.test(b))
  )
    conv.origen = "bienvenida";
  conv.presentado = true;
  for (const b of salidaFinal.mensajes) registrar(conv, "bot", "texto", b);
  resultado.respuestas = salidaFinal.mensajes;
  resultado.retrasoSeg = calcularRetraso(salidaFinal.mensajes);
  resultado.salida = salidaFinal;

  switch (salidaFinal.accion) {
    case "traspaso_agendar":
      pausar(conv, "agendar");
      resultado.emails.push(construirEmail("AGENDAR", conv, { detalle: salidaFinal.nota_interna }));
      break;
    case "alerta":
      pausar(conv, "alerta");
      resultado.emails.push(construirEmail("ALERTA", conv, { detalle: salidaFinal.nota_interna }));
      break;
    case "humano":
      pausar(conv, "humano");
      resultado.emails.push(construirEmail("HUMANO", conv, { detalle: salidaFinal.nota_interna }));
      break;
    case "enviar_link_pago":
      conv.enlacePagoEnviado = true;
      resultado.emails.push(construirEmail("PAGO", conv, { detalle: salidaFinal.nota_interna }));
      break;
    case "cerrar":
      conv.cerrada = true;
      break;
  }
  return resultado;
}

// ---------- Seguimientos ----------

/** ¿Se le puede hacer seguimiento a esta conversación? */
export function admiteSeguimiento(conv) {
  return (
    !conv.cerrada &&
    !conv.pausa &&
    !conv.enlacePagoEnviado &&
    !["fuera_de_foco", "cierre", "alerta", "humano", "propuesta_llamada"].includes(conv.estado) &&
    conv.historial.at(-1)?.rol === "bot"
  );
}

/**
 * Un disparador de ManyChat (palabra clave en un comentario) le ha enviado un MD automático con un recurso.
 * Lo anotamos como último mensaje nuestro para que reciba los seguimientos de las 8 y las 24 h si no contesta.
 * ManyChat solo debe avisarnos cuando la persona ya ha pulsado el botón del MD (eso abre la ventana de 24 h de Meta).
 */
export function anotarRecursoEnviado(conv, recurso) {
  registrar(conv, "bot", "automatico", `[Mensaje automático de ManyChat: le ha llegado ${recurso ? `el recurso «${recurso}»` : "el recurso que pidió"} tras comentar en una publicación]`);
  conv.ultimoMensajeLeadAt = new Date().toISOString(); // pulsar el botón cuenta como interacción
  conv.seguimientos = { s0: null, s1: null, s2: null, s3: null };
  if (!conv.historial.some((m) => m.rol === "lead")) conv.origen = "recurso";
  if (recurso) conv.recurso = recurso;
}

/** ¿La conversación solo tiene el envío automático del recurso (la persona nunca ha escrito)? */
export function soloRecurso(conv) {
  return !conv.historial.some((m) => m.rol === "lead") && conv.historial.some((m) => m.tipo === "automatico");
}

/**
 * Redacta un seguimiento personalizado. n=0 (8 h) y n=1 (24 h) los envía el asistente;
 * n=2 y n=3 se incluyen en el email diario para que el dueño los envíe a mano.
 */
export async function redactarSeguimiento(conv, n, { modelo = config.modelo } = {}) {
  const asistente = negocio.nombreAsistente;
  const sobreRecurso = soloRecurso(conv)
    ? " La persona nunca ha escrito: solo le llegó el recurso automático tras comentar. El mensaje gira en torno a eso (si pudo verlo, si le sirvió), sin preguntas de cualificación. Si el nombre del recurso no deja claro qué era (vídeo, guía, plan…), no lo inventes: di \"lo que te mandé\"."
    : "";
  const instrucciones = {
    0: `Es el seguimiento de las 8 horas: le escribimos y no ha contestado. Lo envías tú, ${asistente}. Muy corto y natural, con su nombre de pila (si lo sabes) y una pregunta sencilla, sin presionar. Ejemplos de estilo: "Hola Laura, pudiste leer mi último mensaje?", "Hola Juan! Pudiste ver lo que te mandé? 😊".${sobreRecurso}`,
    1: `Es el seguimiento de las 24 horas (no ha contestado en casi un día). Lo envías tú, ${asistente}. Muy corto, con su nombre y una pregunta. Si ya hubo un seguimiento a las 8 horas, no repitas la misma frase. Si la conversación había quedado en una pregunta tuya sin responder, lo natural es retomar ESA pregunta de forma ligera (por ejemplo: "Hola Marta! Te preguntaba qué habías probado hasta ahora 😊"). Ejemplos de estilo: "Hola Tania, cómo sigues?", "Hola Nerea! No sé si has visto mis mensajes 😊".${sobreRecurso}`,
    2: `Es el seguimiento 2 (día 3). Lo enviará ${dueno()} a mano desde su cuenta, así que escríbelo como lo escribiría ${dueno()} en primera persona. Retoma algo concreto que dijo la persona (su objetivo o su situación). Corto y con una pregunta.`,
    3: `Es el seguimiento 3 (día 6-7), el último. Lo enviará ${dueno()} a mano, en primera persona. Retoma su objetivo concreto, sin presionar, dejando la puerta abierta. Corto y con una pregunta. Aquí sí encaja preguntar cómo ha pasado estos días o esta semana.`,
  }[n];
  const horas = (Date.now() - Date.parse(conv.ultimoMensajeLeadAt ?? conv.historial.findLast((m) => m.rol === "lead")?.fecha ?? Date.now())) / 3600000;
  const tiempo = horas < 36 ? `${Math.round(horas)} horas` : `${Math.round(horas / 24)} días`;
  const precision = `TIEMPO REAL: han pasado ${tiempo} desde su último mensaje. El mensaje tiene que encajar con ese tiempo exacto. Con menos de 2 días NO uses "estos días", "esta semana", "cómo has pasado los últimos días" ni nada que suponga que ha pasado mucho tiempo (eso solo encaja a partir de unos 6-7 días). Lee bien la conversación: no preguntes algo que ya te contó ni des por hecho algo que no dijo.`;
  const hora = (m) =>
    m.fecha ? `[${new Date(m.fecha).toLocaleString("es-ES", { timeZone: config.zonaHoraria, weekday: "short", hour: "2-digit", minute: "2-digit" })}] ` : "";
  const historia = conv.historial
    .filter((m) => m.tipo !== "nota")
    .map((m) => `${hora(m)}${m.rol.toUpperCase()}: ${textoDeEntrada(m)}`)
    .join("\n");
  const { texto, coste } = await pedirTexto({
    model: idModelo(modelo),
    system: [{ type: "text", text: construirPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } }],
    mensajes: [
      {
        role: "user",
        content: `La persona ha dejado de contestar. Redacta UN mensaje de seguimiento.\n${instrucciones}\n${precision}\nAhora (${config.zonaHoraria}): ${fechaLocal()}.\nDevuelve solo el texto del mensaje, sin comillas ni explicaciones.\n\nNombre en Instagram: ${conv.ficha?.nombre || conv.nombre || "desconocido"} (usa solo el nombre de pila, y solo si parece un nombre real).\n\nFicha: ${JSON.stringify(conv.ficha)}\n\nConversación:\n${historia}`,
      },
    ],
    max_tokens: 3000,
    esfuerzo: "low",
  });
  return { texto, coste };
}
