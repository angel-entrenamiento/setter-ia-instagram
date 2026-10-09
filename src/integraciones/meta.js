// Webhooks de mensajería de Instagram (app de Meta que SOLO escucha).
// Convierte cada aviso de Meta en un evento sencillo que entiende el orquestador.
import crypto from "node:crypto";
import { config } from "../config.js";

/** Verificación inicial del webhook (GET con hub.challenge). Devuelve el challenge o null. */
export function verificarSuscripcion(query) {
  if (query.get("hub.mode") === "subscribe" && query.get("hub.verify_token") === config.metaVerifyToken) {
    return query.get("hub.challenge");
  }
  return null;
}

/** Comprueba la firma X-Hub-Signature-256 con el App Secret. */
export function firmaValida(cuerpoCrudo, cabecera) {
  // META_APP_SECRET admite varios secretos separados por comas (secreto de la app y secreto de Instagram)
  const secretos = config.metaAppSecret.split(",").map((s) => s.trim()).filter(Boolean);
  const b = Buffer.from(cabecera ?? "");
  return secretos.some((secreto) => {
    const a = Buffer.from(`sha256=${crypto.createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex")}`);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

const TIPOS_ADJUNTO = {
  audio: "audio",
  image: "imagen",
  video: "video",
  file: "archivo",
  share: "compartido",
  story_mention: "mencion",
  ig_reel: "reel",
  reel: "reel",
};

/**
 * @returns {{ igsid: string, mid: string, esEco: boolean, tipo: string, texto: string,
 *             fecha: number, deAnuncio: boolean, respondeHistoria: boolean }[]}
 */
export function extraerEventos(cuerpo) {
  const eventos = [];
  if (!["instagram", "page"].includes(cuerpo?.object)) return eventos;
  for (const entrada of cuerpo.entry ?? []) {
    // "standby": avisos que recibe una app que no es la principal de la conversación (p. ej. si ManyChat lo es)
    for (const m of [...(entrada.messaging ?? []), ...(entrada.standby ?? [])]) {
      const msg = m.message;
      if (!msg || msg.is_deleted || msg.is_unsupported) continue; // lecturas, reacciones, borrados…
      const esEco = Boolean(msg.is_echo);
      const igsid = String(esEco ? m.recipient?.id : m.sender?.id);
      const adjunto = msg.attachments?.[0];
      let tipo = "texto";
      if (adjunto) tipo = TIPOS_ADJUNTO[adjunto.type] ?? "otro";
      const respondeHistoria = Boolean(msg.reply_to?.story);
      if (respondeHistoria && tipo === "texto") tipo = "historia";
      const referencia = msg.referral ?? m.referral;
      eventos.push({
        igsid,
        mid: msg.mid,
        esEco,
        tipo,
        texto: msg.text ?? "",
        fecha: m.timestamp ?? Date.now(),
        deAnuncio: referencia?.source === "ADS" || Boolean(referencia?.ad_id),
        respondeHistoria,
      });
    }
  }
  return eventos;
}
