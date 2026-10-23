// IA del panel: crear el conocimiento desde un cuestionario y proponer correcciones a partir de una conversación.
import crypto from "node:crypto";
import { idModelo } from "../config.js";
import { negocio, dueno, guardarNegocio, NEGOCIO_POR_DEFECTO } from "../negocio.js";
import { pedirTexto } from "../cerebro/llm.js";
import { SECCIONES, leerSeccion, guardarSeccion, plantilla } from "../cerebro/conocimiento.js";
import { construirPrompt } from "../cerebro/prompt.js";
import { nombreAutor } from "../avisos/emails.js";

// ---------- Cuestionario inicial ----------

export const PREGUNTAS = [
  ["dedicacion", "¿A qué te dedicas y a quién ayudas?", "Ej.: entrenadora online para mujeres de 35-55 que quieren perder grasa sin dietas extremas. Cuanto más concreto, mejor."],
  ["historia", "Tu historia y tu autoridad", "Formación, años de experiencia, nº de clientes, tu propia historia (por qué te dedicas a esto)…"],
  ["avatar", "Tu cliente ideal: qué le pasa, qué ha probado y qué quiere", "Sus problemas, miedos, frases típicas, lo que ha probado sin éxito y lo que de verdad desea."],
  ["programa", "Tu programa principal (el que se vende en la llamada)", "Nombre, qué incluye, duración, garantía, formas de pago. El precio NO se dirá por MD."],
  ["llamada", "La llamada que propone el setter", "Ej.: videollamada gratuita de 15-20 minutos por Google Meet conmigo, para ver su caso y explicarle el paso a paso."],
  ["cualificacion", "¿Quién encaja y quién NO encaja?", "A quién quieres en llamada y a quién no (y qué hacer con ellos: recurso gratuito, cierre amable…)."],
  ["alarmas", "Señales de alarma (si aplica)", "Situaciones en las que el setter debe parar y recomendar otro profesional (médico, psicólogo…). Si no aplica, déjalo vacío."],
  ["producto_barato", "Producto de venta directa por MD (opcional)", "Si tienes un producto barato que el setter puede vender directamente: nombre, precio, qué incluye, para quién es y para quién NO, landing y enlace de pago."],
  ["recursos", "Recursos gratuitos y enlaces", "Guías, vídeos, reels, casos de éxito… con su enlace y cuándo usar cada uno. El setter solo enviará enlaces que estén aquí."],
  ["objeciones", "Objeciones frecuentes y cómo respondes", "Precio, tiempo, pareja, desconfianza, 'ya lo he probado todo'… y lo que contestas tú."],
  ["voz", "Cómo escribes por MD", "Tú o usted, muletillas, emojis que usas, si escribes mensajes cortos, expresiones típicas tuyas…"],
  ["bienvenida", "¿Escribes tú a mano una bienvenida a los seguidores nuevos?", "Si lo haces, pega el texto. El setter la tendrá en cuenta para no presentarse cuando contesten."],
  ["ejemplos", "Ejemplos de conversaciones reales", "Pega 3-6 conversaciones tuyas por MD que acabaron en llamada (cambia los nombres). Es lo que más ayuda a que suene como tú."],
  ["extra", "Material extra (opcional)", "Pega aquí cualquier documento de tu marca: avatar, propuesta de valor, guion de ventas…"],
];

const INSTRUCCIONES_SECCION = {
  "00_reglas_del_asistente.md":
    "Adapta las reglas al negocio: quién encaja para la llamada (criterios claros y comprobables), qué hacer con quien no encaja, las señales de alarma (si no hay, escribe que no aplica y que ante cualquier tema de salud grave se recomienda consultar a un profesional), la ruta del producto de venta directa (o elimínala si no hay) y el precio. Mantén TODAS las reglas generales de la plantilla (presentación, una pregunta por turno, nunca dar el precio del programa principal, decisor económico, acciones, estilo).",
  "01_marca_y_voz.md":
    "Describe quién es el dueño, su posicionamiento, el cliente ideal (perfiles, miedos, creencias, escenas que conectan) y su forma de escribir por MD con ejemplos concretos sacados de lo que ha contado y de sus conversaciones.",
  "02_guion_y_cualificacion.md":
    "Adapta las aperturas y la secuencia de descubrimiento con preguntas propias de este nicho (sustituye los ejemplos genéricos). Mantén la estructura: aperturas, descubrimiento (situación, desde cuándo, afectación, qué ha probado, objetivo, prioridad, implicación, decisor), decisión de ruta, presentación de la llamada, pregunta de inversión y seguimientos.",
  "03_objeciones_y_respuestas.md":
    "Mantén el método de la plantilla y escribe las objeciones típicas de este nicho con respuestas en la voz del dueño (usa las suyas si las ha dado).",
  "04_productos_y_enlaces.md":
    "Rellena el programa principal (sin precio), el producto de venta directa si existe (con precio, criterios, para quién NO es y enlaces), los recursos gratuitos en una tabla con cuándo usarlos y su enlace, casos de éxito y datos útiles. Copia los enlaces EXACTAMENTE como los ha dado; no inventes ninguno.",
  "05_ejemplos_conversaciones.md":
    "Si hay conversaciones reales, ordénalas como ejemplos numerados con un título que diga qué enseñan (LEAD: / DUEÑO:), anonimizadas. Si no hay, deja la plantilla tal cual con sus [RELLENAR].",
};

function respuestasEnTexto(respuestas) {
  return PREGUNTAS.filter(([k]) => respuestas[k]?.trim())
    .map(([k, titulo]) => `## ${titulo}\n${respuestas[k].trim()}`)
    .join("\n\n");
}

/** Redacta las 6 secciones a partir del cuestionario (6 llamadas en paralelo, ~1-2 minutos, ~0,50 $). */
export async function crearConocimientoConIA(respuestas) {
  const datos = [
    `Asistente: ${negocio.nombreAsistente}`,
    `Dueño: ${negocio.nombreDueno}`,
    `Negocio: ${negocio.nombreNegocio}`,
    `Instagram: @${negocio.cuentaInstagram}`,
    `País principal: ${negocio.paisPrincipal}`,
    `Llamada: ${negocio.descripcionLlamada}`,
  ].join("\n");
  const material = respuestasEnTexto(respuestas);
  let coste = 0;
  const resultados = await Promise.allSettled(
    SECCIONES.map(async ({ archivo, nombre }) => {
      const { texto, coste: c } = await pedirTexto({
        model: idModelo("opus"),
        max_tokens: 16000,
        esfuerzo: "medium",
        system: `Eres experto en setters de Instagram y en ventas por conversación. Escribes en español de España, claro y concreto, la sección "${nombre}" del conocimiento de un asistente de IA que contesta los MD de Instagram de un negocio. Partes de una PLANTILLA y la adaptas al negocio con la información que te da el dueño.

Reglas:
- Devuelve solo el texto en markdown de la sección, empezando por su título "# ...". Nada antes ni después.
- Respeta la estructura y las reglas generales de la plantilla; sustituye los ejemplos genéricos y los [RELLENAR] por contenido real del negocio.
- No inventes datos (precios, garantías, cifras, títulos, enlaces, testimonios). Si falta algo importante, deja un hueco "[RELLENAR: qué falta]" para que el dueño lo complete.
- Puedes usar los marcadores {asistente}, {dueno}, {negocio}, {cuenta}, {llamada} y {producto_barato}: el sistema los sustituye por los datos reales.
- ${INSTRUCCIONES_SECCION[archivo]}`,
        mensajes: [
          {
            role: "user",
            content: `DATOS BÁSICOS\n${datos}\n\nLO QUE CUENTA EL DUEÑO\n${material || "(no ha contestado el cuestionario)"}\n\nPLANTILLA DE LA SECCIÓN\n<plantilla>\n${plantilla(archivo)}\n</plantilla>`,
          },
        ],
      });
      coste += c;
      return [archivo, texto];
    }),
  );
  // Se guardan las secciones que salieron bien aunque alguna falle (y se cuenta todo lo que se ha cobrado)
  const bien = resultados.filter((r) => r.status === "fulfilled").map((r) => r.value);
  for (const [archivo, texto] of bien) if (texto?.trim().startsWith("#")) guardarSeccion(archivo, texto);
  const fallo = resultados.find((r) => r.status === "rejected");
  if (fallo)
    throw Object.assign(new Error(`${SECCIONES.length - bien.length} de ${SECCIONES.length} secciones no se han podido redactar (${fallo.reason?.message}). Las demás ya están guardadas: vuelve a intentarlo.`), { coste });
  return { coste, secciones: bien.length };
}

// ---------- Educar desde una conversación ----------

const ESQUEMA_PROPUESTA = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "cambios"],
  properties: {
    resumen: { type: "string" },
    cambios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["archivo", "buscar", "reemplazar", "motivo"],
        properties: {
          archivo: { type: "string", enum: SECCIONES.map((s) => s.archivo) },
          buscar: { type: "string" },
          reemplazar: { type: "string" },
          motivo: { type: "string" },
        },
      },
    },
  },
};

function conversacionEnTexto(conv) {
  return conv.historial
    .filter((m) => m.tipo !== "nota")
    .map((m) => `${nombreAutor(m.rol)}: ${m.tipo !== "texto" ? `[${m.tipo}] ` : ""}${m.texto}`)
    .join("\n");
}

/**
 * El dueño explica qué debería haber hecho distinto el asistente; la IA propone cambios concretos en el conocimiento.
 * @returns {{ id, resumen, cambios: {archivo, buscar, reemplazar, motivo}[], coste }}
 */
export async function proponerCorreccion(almacen, conv, comentario) {
  const conocimiento = SECCIONES.map(({ archivo }) => `<archivo nombre="${archivo}">\n${leerSeccion(archivo)}\n</archivo>`).join("\n\n");
  const { texto, coste } = await pedirTexto({
    model: idModelo("opus"),
    max_tokens: 12000,
    esfuerzo: "medium",
    esquemaJson: ESQUEMA_PROPUESTA,
    system: `Mantienes el conocimiento de ${negocio.nombreAsistente}, el asistente de IA que contesta los MD de Instagram de ${dueno()}. ${dueno()} te dice qué debería haber hecho distinto el asistente en una conversación, y tú propones los cambios MÍNIMOS en el conocimiento para que la próxima vez lo haga bien en todas las conversaciones parecidas (no solo en esta).

Cómo proponer cambios:
- Cada cambio es una sustitución exacta: "buscar" es un fragmento que aparece LITERALMENTE en el archivo (cópialo carácter a carácter, lo bastante largo para ser único) y "reemplazar" es el texto nuevo. Para añadir algo nuevo sin quitar nada, usa "buscar" vacío y se añadirá al final del archivo; o mejor, busca la línea junto a la que debe ir y reemplázala por esa misma línea más lo nuevo.
- Escribe reglas generales y claras, en el estilo del archivo, sin nombres de leads concretos.
- Si lo que pide contradice una regla existente, cambia esa regla en vez de añadir otra contradictoria.
- Normalmente bastan 1-3 cambios. "resumen": 1-3 frases sencillas para ${dueno()} explicando qué vas a cambiar.
- "motivo": una frase por cambio.`,
    mensajes: [
      {
        role: "user",
        content: `CONOCIMIENTO ACTUAL\n${conocimiento}\n\nCONVERSACIÓN\n${conversacionEnTexto(conv) || "(vacía)"}\n\nLO QUE DICE ${dueno().toUpperCase()}\n${comentario}`,
      },
    ],
  });
  let propuesta;
  try {
    propuesta = JSON.parse(texto);
  } catch {
    throw Object.assign(new Error("La IA no ha devuelto una propuesta válida. Prueba a explicarlo con otras palabras."), { coste });
  }
  const id = crypto.randomBytes(6).toString("hex");
  const guardada = { id, convId: conv.id, comentario, ...propuesta, fecha: new Date().toISOString() };
  almacen.fijarAjuste(`propuesta:${id}`, JSON.stringify(guardada));
  return { ...guardada, coste };
}

export function leerPropuesta(almacen, id) {
  try {
    return JSON.parse(almacen.ajuste(`propuesta:${id}`) ?? "null");
  } catch {
    return null;
  }
}

/** ¿Se puede aplicar este cambio sobre el texto actual? */
export function cambioAplicable(c) {
  return !c.buscar || leerSeccion(c.archivo).includes(c.buscar);
}

/**
 * Aplica los cambios elegidos (por índice) del conocimiento y, si los hay, de los ajustes.
 * Devuelve qué se aplicó y qué falló.
 */
export function aplicarPropuesta(almacen, propuesta, indices, indicesAjustes = []) {
  const aplicados = [];
  const fallidos = [];
  const ajustesAplicados = [];
  const nuevosAjustes = {};
  (propuesta.ajustes ?? []).forEach((a, i) => {
    if (!indicesAjustes.includes(i) || !AJUSTES_EDITABLES[a.campo]) return;
    nuevosAjustes[a.campo] = a.valor;
    ajustesAplicados.push(i);
  });
  if (ajustesAplicados.length) guardarNegocio(almacen, { ...negocio, ...nuevosAjustes });
  propuesta.cambios.forEach((c, i) => {
    if (!indices.includes(i)) return;
    const actual = leerSeccion(c.archivo);
    if (c.buscar && !actual.includes(c.buscar)) return fallidos.push(i);
    const nuevo = c.buscar ? actual.replace(c.buscar, () => c.reemplazar) : `${actual}\n\n${c.reemplazar.trim()}`;
    guardarSeccion(c.archivo, nuevo);
    aplicados.push(i);
  });
  almacen.fijarAjuste(
    `propuesta:${propuesta.id}`,
    JSON.stringify({ ...propuesta, aplicada: new Date().toISOString(), aplicados, ajustesAplicados }),
  );
  return { aplicados, fallidos, ajustesAplicados };
}

// ---------- Chat "Asistente": el dueño pide cambios hablando o subiendo documentos ----------

/** Ajustes que el chat puede proponer cambiar (nunca el modo prueba: activarlo para todos es decisión manual). */
export const AJUSTES_EDITABLES = {
  nombreAsistente: "Nombre del asistente",
  nombreDueno: "Nombre del dueño (con quien es la llamada)",
  nombreNegocio: "Nombre del negocio o marca",
  cuentaInstagram: "Cuenta de Instagram sin @",
  aQueSeDedica: "A qué se dedica, en una o dos frases",
  paisPrincipal: "País principal de los clientes",
  emailAvisos: "Email para los avisos (debe ser el de la cuenta de Resend)",
  descripcionLlamada: "Qué es la llamada que propone el asistente",
  bienvenidaManual: "Texto de la bienvenida manual a seguidores nuevos (vacío si no la usa)",
  decirVirtualAlPresentarse: "Decir que es un asistente virtual al presentarse (si/no)",
  exigirDecisor: "Preguntar siempre quién decide el dinero antes de proponer la llamada (si/no)",
  productoBaratoActivo: "Tiene producto de venta directa por MD (si/no)",
  productoBaratoNombre: "Nombre del producto de venta directa",
  productoBaratoImportes: "Importes que puede decir del producto barato, números separados por comas",
  productoBaratoEnlacePago: "Enlace de pago del producto barato",
  seguimientosAutomaticos: "Seguimientos automáticos a las 8 h y 24 h (si/no)",
  emailSeguimientos: "Email diario con los seguimientos de los días 3 y 7 (si/no)",
  resumenSemanal: "Resumen semanal los lunes (si/no)",
  etiquetaPausa: "Nombre de la etiqueta de ManyChat que pausa al asistente con una persona (por defecto IA_PAUSA)",
  etiquetaReactivar: "Nombre de la etiqueta de ManyChat que lo reactiva (por defecto IA_ON)",
  etiquetasNoResponder: "Etiquetas de ManyChat a las que el asistente nunca contesta, en mayúsculas y separadas por comas (por defecto ALUMNO)",
  avisarEtiquetasNoResponder: "Avisar por email cuando escribe alguien con una etiqueta de no contestar (si/no)",
  informeDudas: "Informe de dudas los jueves (si/no)",
  actualizacionesAutomaticas: "Instalar solas las versiones nuevas de madrugada (si/no)",
  avisarActualizaciones: "Avisar por email de cada versión nueva y lo que trae (si/no)",
  listaBlanca: "Cuentas de prueba, sin @, separadas por comas",
  modelo: "Modelo de IA: opus o sonnet",
  modeloSeguimientos: "Modelo para los seguimientos: sonnet (más barato, recomendado) u opus",
  esfuerzo: "Cuánto piensa: low, medium o high",
};

const ESQUEMA_ASISTENTE = {
  type: "object",
  additionalProperties: false,
  required: ["respuesta", "resumen_documentos", "cambios", "ajustes"],
  properties: {
    respuesta: { type: "string" },
    resumen_documentos: { type: "string" },
    cambios: ESQUEMA_PROPUESTA.properties.cambios,
    ajustes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["campo", "valor", "motivo"],
        properties: {
          campo: { type: "string", enum: Object.keys(AJUSTES_EDITABLES) },
          valor: { type: "string" },
          motivo: { type: "string" },
        },
      },
    },
  },
};

export const TIPOS_ARCHIVO = { pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv" };
const MAX_HISTORIAL = 20;

export function historialAsistente(almacen) {
  try {
    return JSON.parse(almacen.ajuste("asistente_historial") ?? "[]");
  } catch {
    return [];
  }
}

function bloqueArchivo({ nombre, datos }) {
  const extension = String(nombre).toLowerCase().split(".").pop();
  const tipo = TIPOS_ARCHIVO[extension];
  if (!tipo) throw new Error(`«${nombre}»: solo se pueden subir PDF o archivos de texto (.txt, .md, .csv). Si es un Word, guárdalo como PDF.`);
  if (tipo === "application/pdf") return { type: "document", source: { type: "base64", media_type: tipo, data: datos }, title: nombre };
  return { type: "text", text: `<documento nombre="${nombre}">\n${Buffer.from(datos, "base64").toString("utf8")}\n</documento>` };
}

const valorAjuste = (k) => (typeof NEGOCIO_POR_DEFECTO[k] === "boolean" ? (negocio[k] ? "si" : "no") : String(negocio[k] ?? ""));

/**
 * Un turno del chat del panel. Nunca aplica nada: si propone cambios, crea una propuesta que el dueño revisa y aplica.
 * @param {{ mensaje: string, archivos?: { nombre: string, datos: string }[] }} entrada (datos en base64)
 */
export async function conversarConAsistente(almacen, { mensaje, archivos = [] }) {
  const historial = historialAsistente(almacen);
  const bloquesArchivos = archivos.map(bloqueArchivo);
  const conocimiento = SECCIONES.map(({ archivo }) => `<archivo nombre="${archivo}">\n${leerSeccion(archivo)}\n</archivo>`).join("\n\n");
  const ajustes = Object.entries(AJUSTES_EDITABLES)
    .map(([k, d]) => `- ${k} (${d}): ${valorAjuste(k) || "(vacío)"}`)
    .join("\n");
  const anteriores = historial.slice(-MAX_HISTORIAL).map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.rol === "usuario" && m.resumenDocumentos ? `${m.texto}\n[Documentos que adjuntó: ${m.resumenDocumentos}]` : m.texto || "(sin texto)",
  }));
  while (anteriores[0]?.role === "assistant") anteriores.shift();
  const actual = [
    ...bloquesArchivos,
    { type: "text", text: `${mensaje || "(sin mensaje: revisa los documentos adjuntos)"}\n\nCONOCIMIENTO ACTUAL\n${conocimiento}\n\nAJUSTES ACTUALES\n${ajustes}` },
  ];
  const { texto, coste } = await pedirTexto({
    model: idModelo("opus"),
    max_tokens: 16000,
    esfuerzo: "medium",
    esquemaJson: ESQUEMA_ASISTENTE,
    system: `Eres el asistente de configuración del setter de ${dueno()}. Su setter, ${negocio.nombreAsistente}, es una IA que contesta los MD de Instagram de su negocio siguiendo su CONOCIMIENTO (6 secciones en markdown) y sus AJUSTES. ${dueno()} te habla por un chat de su panel para mejorarlo: te cuenta cosas, te pide cambios o te adjunta documentos (PDF o texto) de su negocio.

Tu trabajo:
- Responder en "respuesta" en español sencillo y cercano, breve, sin tecnicismos. Si propones cambios, resume en 1-3 frases qué cambiarías y dile que los revise y pulse "Aplicar" (tú no aplicas nada).
- Proponer cambios MÍNIMOS en el conocimiento ("cambios"): sustituciones exactas donde "buscar" es un fragmento que aparece LITERALMENTE en el archivo (cópialo carácter a carácter, lo bastante largo para ser único) y "reemplazar" el texto nuevo. Con "buscar" vacío se añade al final del archivo. Escribe en el estilo del archivo, reglas generales y claras, sin contradecir otras reglas (si contradice una, cambia esa).
- Proponer cambios de ajustes ("ajustes") solo si lo pide o si es claramente necesario. Para los de si/no usa "si" o "no".
- Con documentos: extrae lo útil para vender por MD (programas, precios, garantías, avatar, objeciones, casos de éxito, enlaces, tono…) y propón dónde va cada cosa. En "resumen_documentos" resume en pocas líneas qué contenían (se guarda para recordarlo en los siguientes mensajes); si no hay documentos, déjalo vacío.
- Si falta información para hacer bien un cambio, pregunta en vez de inventar. Nunca inventes precios, garantías, resultados, testimonios ni enlaces: los enlaces solo si te los da o aparecen en sus documentos, copiados exactos.
- Recuerda las reglas fijas del sistema: el precio del programa principal nunca se dice por MD (solo los importes del producto barato de los ajustes), el asistente solo envía enlaces que estén en el conocimiento, y la llamada se propone preguntando mañana o tarde y se pasa a ${dueno()}.
- Etiquetas de ManyChat: el sistema SÍ las lee antes de contestar. La etiqueta del ajuste "etiquetaPausa" (IA_PAUSA por defecto) pausa al asistente en ese contacto, la de "etiquetaReactivar" (IA_ON por defecto) lo reactiva, y a quien tenga una etiqueta de la lista "etiquetasNoResponder" (ALUMNO por defecto) nunca le contesta. Si el dueño quiere que no conteste a ciertas personas (clientes, amigos…), propón cambiar el ajuste "etiquetasNoResponder" añadiendo sus etiquetas (sin quitar las que ya hay) y recuérdale que tiene que ponérselas a esos contactos en ManyChat. Si el dueño ya usa otras etiquetas para pausar o reactivar, propón cambiar "etiquetaPausa" o "etiquetaReactivar" por sus nombres exactos. No hace falta ninguna regla en el conocimiento para esto.
- Lo que no puedes hacer: cambiar el código, conectar herramientas nuevas (Calendly, WhatsApp, CRM…), activar el setter para todos (eso se hace en Inicio) ni tocar la licencia. Si te lo piden, dilo con claridad y sugiere hablar con Ángel López, que es quien mantiene el sistema.
- Si solo es una pregunta o una conversación, responde y deja "cambios" y "ajustes" vacíos.`,
    mensajes: [...anteriores, { role: "user", content: actual }],
  });
  let salida;
  try {
    salida = JSON.parse(texto);
  } catch {
    throw Object.assign(new Error("La IA no ha devuelto una respuesta válida. Prueba otra vez."), { coste });
  }
  let propuestaId = null;
  if (salida.cambios.length || salida.ajustes.length) {
    propuestaId = crypto.randomBytes(6).toString("hex");
    const comentario = mensaje || `Documentos: ${archivos.map((a) => a.nombre).join(", ")}`;
    almacen.fijarAjuste(
      `propuesta:${propuestaId}`,
      JSON.stringify({ id: propuestaId, origen: "asistente", comentario, resumen: salida.respuesta, cambios: salida.cambios, ajustes: salida.ajustes, fecha: new Date().toISOString() }),
    );
  }
  const ahora = new Date().toISOString();
  historial.push(
    { rol: "usuario", texto: mensaje, archivos: archivos.map((a) => a.nombre), resumenDocumentos: salida.resumen_documentos || "", fecha: ahora },
    { rol: "asistente", texto: salida.respuesta, propuestaId, fecha: ahora },
  );
  almacen.fijarAjuste("asistente_historial", JSON.stringify(historial.slice(-60)));
  return { ...salida, propuestaId, coste };
}

/** Prompt completo actual (para la vista "ver el prompt" del panel). */
export const promptActual = () => construirPrompt();
