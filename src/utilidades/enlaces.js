// Enlaces firmados que van en los emails de aviso (no requieren contraseña, pero no se pueden falsificar).
import crypto from "node:crypto";
import { config } from "../config.js";

export function firmar(texto) {
  return crypto.createHmac("sha256", config.secretoEnlaces || "sin-secreto").update(texto).digest("hex").slice(0, 32);
}

export function firmaCorrecta(texto, firma) {
  const esperada = Buffer.from(firmar(texto));
  const recibida = Buffer.from(String(firma ?? ""));
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

export const enlaceNotaAudio = (convId) =>
  `${config.urlPublica}/nota/${encodeURIComponent(convId)}/${firmar(`nota:${convId}`)}`;

export const enlacePanel = (convId) => `${config.urlPublica}/panel/c/${encodeURIComponent(convId)}`;
