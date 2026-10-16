// Columnas y desplegables del CRM. Las listas de los desplegables las edita cada usuario en el panel → Ajustes
// (se guardan en la base de datos); aquí solo están los valores por defecto, genéricos para cualquier negocio.

/** Columnas de la pestaña Conversaciones (una fila por día). */
export const CAMPOS_KPI = [
  { clave: "outbound", nombre: "Outbound" },
  { clave: "inbound", nombre: "Inbound" },
  { clave: "lead_magnet", nombre: "Lead magnet" },
  { clave: "agendadas_outbound", nombre: "Agendadas Outbound" },
  { clave: "agendadas_inbound", nombre: "Agendadas Inbound" },
  { clave: "cerradas", nombre: "Cerradas" },
];

/** Desplegables de Entrevistas, en el orden en que se muestran en Ajustes. */
export const LISTAS_EDITABLES = [
  { clave: "procedencia", nombre: "Procedencia", ayuda: "De dónde viene la persona. Es una sugerencia: en la tabla también se puede escribir otra." },
  { clave: "modalidad", nombre: "Presencial/Online" },
  { clave: "estado", nombre: "Estado" },
  { clave: "hablar_por", nombre: "Hablar por" },
  { clave: "que_le_ocurre", nombre: "Qué le ocurre", ayuda: "Los problemas típicos de tus clientes (por ejemplo: «Quiere perder peso», «Dolor de rodilla»…)." },
  { clave: "servicio", nombre: "Servicio", ayuda: "Tus programas o servicios." },
];

export const LISTAS_POR_DEFECTO = Object.freeze({
  procedencia: ["Inbound MD", "Inbound Historia", "Inbound Post", "Lead magnet", "Anuncio", "Outbound"],
  modalidad: ["Online", "Presencial"],
  estado: ["Hablar en un futuro", "No hablar"],
  hablar_por: ["Instagram", "WhatsApp"],
  que_le_ocurre: [],
  servicio: ["Online", "Presencial"],
});

let listas = structuredClone(LISTAS_POR_DEFECTO);

/** Listas actuales de los desplegables. */
export const listasCrm = () => listas;

/** Lee las listas guardadas en Ajustes (o deja las de por defecto). */
export function cargarListasCrm(almacen) {
  let guardadas = {};
  try {
    guardadas = JSON.parse(almacen.ajuste("crm_listas") ?? "{}");
  } catch {}
  listas = { ...structuredClone(LISTAS_POR_DEFECTO), ...guardadas };
  return listas;
}

/** Guarda las listas desde el formulario de Ajustes: una opción por línea en cada campo. */
export function guardarListasCrm(almacen, entrada) {
  const obtener = (k) => (entrada instanceof URLSearchParams ? entrada.get(k) : entrada[k]);
  const nuevas = {};
  for (const { clave } of LISTAS_EDITABLES) {
    const v = obtener(`lista_${clave}`);
    const valores = Array.isArray(v) ? v : String(v ?? "").split(/\r?\n/);
    nuevas[clave] = [...new Set(valores.map((x) => String(x).trim().slice(0, 80)).filter(Boolean))].slice(0, 50);
  }
  almacen.fijarAjuste("crm_listas", JSON.stringify(nuevas));
  listas = nuevas;
  return listas;
}

/**
 * Columnas de la pestaña Entrevistas.
 * tipo: texto | largo | lista (desplegable cerrado) | sugerencias (texto libre con sugerencias) | si_no | fecha | numero
 */
export const COLUMNAS_ENTREVISTA = [
  { clave: "nombre", nombre: "Nombre", tipo: "texto" },
  { clave: "procedencia", nombre: "Procedencia", tipo: "sugerencias" },
  { clave: "modalidad", nombre: "Presencial/Online", tipo: "lista" },
  { clave: "presentado", nombre: "Presentado", tipo: "si_no" },
  { clave: "fecha_entrevista", nombre: "Entrevista", tipo: "fecha" },
  { clave: "entra", nombre: "Entra", tipo: "si_no" },
  { clave: "estado", nombre: "Estado", tipo: "lista" },
  { clave: "objecion", nombre: "Objeción", tipo: "largo" },
  { clave: "repesca_fecha", nombre: "Repesca fecha", tipo: "fecha" },
  { clave: "hablar_por", nombre: "Hablar por", tipo: "lista" },
  { clave: "que_le_ocurre", nombre: "Qué le ocurre", tipo: "lista" },
  { clave: "servicio", nombre: "Servicio", tipo: "lista" },
  { clave: "mensaje_enviar", nombre: "Mensaje a enviar", tipo: "largo" },
  { clave: "enviado", nombre: "Enviado", tipo: "si_no" },
  { clave: "que_dice", nombre: "¿Qué dice?", tipo: "largo" },
  { clave: "mensaje_reactivacion", nombre: "Mensaje reactivación", tipo: "largo" },
  { clave: "contesta", nombre: "Contesta", tipo: "si_no" },
];

export const COLUMNAS_VENTA = [
  { clave: "fuente_lead", nombre: "Fuente lead", tipo: "sugerencias", lista: "procedencia" },
  { clave: "fecha", nombre: "Fecha", tipo: "fecha" },
  { clave: "nombre", nombre: "Nombre lead", tipo: "texto" },
  { clave: "mail", nombre: "Mail", tipo: "texto" },
  { clave: "realizada", nombre: "Realizada", tipo: "si_no" },
  { clave: "estado", nombre: "Estado", tipo: "texto" },
  { clave: "comision", nombre: "Comisión", tipo: "texto" },
  { clave: "observaciones", nombre: "Observaciones", tipo: "largo" },
];

// Pestaña Lead magnets: oculta en la página por ahora, el código se conserva
export const COLUMNAS_LEAD_MAGNET = [
  { clave: "titulo", nombre: "Título", tipo: "texto" },
  { clave: "fecha", nombre: "Fecha", tipo: "fecha" },
  { clave: "clave_manychat", nombre: "Recurso en ManyChat", tipo: "texto", ayuda: "El mismo texto que pusiste en «recurso» del disparador: así el asistente cuenta solo las solicitudes, respuestas y agendadas" },
  { clave: "solicitudes", nombre: "Solicitudes", tipo: "numero", auto: true },
  { clave: "respuestas", nombre: "Respuesta 1er mensaje", tipo: "numero", auto: true },
  { clave: "agendadas", nombre: "Agendadas", tipo: "numero", auto: true },
  { clave: "cerradas", nombre: "Cerradas", tipo: "numero" },
  { clave: "observaciones", nombre: "Observaciones", tipo: "largo" },
];

const PROCEDENCIA_POR_ORIGEN = { historia: "Inbound Historia", anuncio: "Anuncio", recurso: "Lead magnet", bienvenida: "Outbound" };

/**
 * Lo que apunta el asistente en Entrevistas cuando agenda una llamada: solo lo que dice su ficha.
 * Lo demás (modalidad, servicio, qué le ocurre de la lista…) lo completa la persona.
 */
export function entrevistaDesdeConversacion(conv) {
  const f = conv.ficha ?? {};
  const nombre = [f.nombre || conv.nombre, conv.igUsuario ? `@${conv.igUsuario}` : ""].filter(Boolean).join(" ");
  return {
    nombre: nombre || "Sin nombre",
    procedencia: PROCEDENCIA_POR_ORIGEN[conv.origen] ?? "Inbound MD",
    hablar_por: listas.hablar_por.includes("Instagram") ? "Instagram" : "",
    objecion: (f.objeciones ?? []).join("; "),
    que_dice: [
      f.situacion,
      f.objetivo && `Objetivo: ${f.objetivo}`,
      f.decisor_economico && `Decide: ${f.decisor_economico}`,
      f.preferencia_franja && `Prefiere ${f.preferencia_franja}`,
      f.pais_zona_horaria,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Agendada de outbound (la conversación la empezó la cuenta con su bienvenida) o de inbound. */
export const esOutbound = (conv) => conv.origen === "bienvenida";
