// Cliente mínimo de la API de ManyChat (https://api.manychat.com). Solo lo que usa el asistente.
import { config } from "../config.js";

const BASE = "https://api.manychat.com";

export class ErrorManychat extends Error {}

async function llamar(metodo, ruta, cuerpo) {
  if (!config.manychatApiKey) throw new ErrorManychat("Falta MANYCHAT_API_KEY");
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${config.manychatApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.status !== "success") {
    throw new ErrorManychat(`ManyChat ${ruta} → ${r.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data;
}

/** Datos del contacto: nombre, usuario de Instagram, ID de Instagram, etiquetas, enlace al chat. */
export async function infoContacto(subscriberId) {
  const d = await llamar("GET", `/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`);
  return {
    manychatId: String(d.id),
    nombre: d.first_name || d.name || "",
    igUsuario: (d.ig_username ?? "").replace(/^@/, "").toLowerCase(),
    igId: d.ig_id ? String(d.ig_id) : "",
    etiquetas: (d.tags ?? []).map((t) => String(t.name).toUpperCase()),
    enlaceChat: d.live_chat_url ?? "",
  };
}

/** Envía las burbujas como mensajes de texto de Instagram, en orden. */
export async function enviarTextos(subscriberId, burbujas) {
  return llamar("POST", "/fb/sending/sendContent", {
    subscriber_id: Number(subscriberId),
    data: {
      version: "v2",
      content: {
        type: "instagram",
        messages: burbujas.map((text) => ({ type: "text", text })),
      },
    },
  });
}

export async function ponerEtiqueta(subscriberId, nombre) {
  return llamar("POST", "/fb/subscriber/addTagByName", { subscriber_id: Number(subscriberId), tag_name: nombre });
}

export async function quitarEtiqueta(subscriberId, nombre) {
  return llamar("POST", "/fb/subscriber/removeTagByName", { subscriber_id: Number(subscriberId), tag_name: nombre });
}

/** Comprueba que la clave funciona (devuelve el nombre de la página/cuenta). */
export async function comprobarClave() {
  return llamar("GET", "/fb/page/getInfo");
}
