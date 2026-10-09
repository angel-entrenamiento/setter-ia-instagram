import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const MODELOS = {
  opus: "claude-opus-5-5",
  sonnet: "claude-sonnet-5-5",
};

function lista(valor) {
  return (valor ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

// En Railway, la carpeta del volumen y el dominio público llegan solos en estas variables
const carpetaDatos = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(RAIZ, "datos");
const dominioRailway = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "";

/**
 * Configuración técnica (variables de entorno). Los datos del negocio (nombres, email, modo prueba, modelo…)
 * los edita cada usuario en el panel → Ajustes, y se copian aquí al arrancar (ver src/negocio.js).
 */
export const config = {
  // --- Los rellena src/negocio.js con los Ajustes del panel ---
  modelo: (process.env.MODELO ?? "opus").toLowerCase(),
  esfuerzo: process.env.ESFUERZO ?? "medium",
  modoPrueba: (process.env.MODO_PRUEBA ?? "si").toLowerCase().startsWith("s"),
  listaBlanca: lista(process.env.LISTA_BLANCA),
  emailAvisos: process.env.EMAIL_AVISOS ?? "",
  zonaHoraria: process.env.ZONA_HORARIA ?? "Europe/Madrid",

  retrasoMinSeg: Number(process.env.RETRASO_MIN_SEG ?? 40),
  retrasoMaxSeg: Number(process.env.RETRASO_MAX_SEG ?? 150),
  maxBurbujas: 4,
  comandoReset: "#reset",

  // De dónde llegan los mensajes de los leads: "manychat" (lo normal) o "meta" (solo con acceso avanzado de Meta)
  entrada: (process.env.ENTRADA ?? "manychat").toLowerCase(),
  manychatApiKey: process.env.MANYCHAT_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  gmailUsuario: process.env.GMAIL_USUARIO ?? "",
  gmailContrasena: (process.env.GMAIL_CONTRASENA_APLICACION ?? "").replace(/\s+/g, ""),
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaVerifyToken: process.env.META_VERIFY_TOKEN ?? "",
  // Si no vienen en las variables, se generan solos la primera vez y se guardan en la base de datos
  tokenManychatEntrada: process.env.TOKEN_MANYCHAT_ENTRADA ?? "",
  secretoEnlaces: process.env.SECRETO_ENLACES ?? "",
  panelUsuario: process.env.PANEL_USUARIO || "admin",
  panelClave: process.env.PANEL_CLAVE ?? "",
  urlPublica: (process.env.URL_PUBLICA || dominioRailway || "http://localhost:3000").replace(/\/+$/, ""),
  puerto: Number(process.env.PORT ?? process.env.PUERTO ?? 3000),
  archivoBaseDatos: process.env.ARCHIVO_BD ?? path.join(carpetaDatos, "setter.db"),
  diasConservacion: Number(process.env.DIAS_CONSERVACION ?? 180),
  // Espera tras el último mensaje del lead por si manda varios seguidos (se descuenta del retraso humano)
  esperaAgruparSeg: Number(process.env.ESPERA_AGRUPAR_SEG ?? 25),
  seguimiento0Horas: 8, // primer seguimiento: nunca antes de 8 h desde su último mensaje (no se envía de 22:00 a 9:00)
  seguimiento1Horas: [23, 23.5], // segundo: entre 23 y 23,5 h desde su último mensaje (Meta corta a las 24 h)

  // Sube cada vez que cambian el conocimiento o los ajustes (el prompt se vuelve a construir)
  versionConocimiento: 0,
};

export function idModelo(nombre = config.modelo) {
  const id = MODELOS[nombre];
  if (!id) throw new Error(`Modelo desconocido "${nombre}". Usa "opus" o "sonnet".`);
  return id;
}
