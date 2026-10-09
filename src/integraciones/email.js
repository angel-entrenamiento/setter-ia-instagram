// Envío de los avisos al dueño de la cuenta.
// - Principal: Resend (API por HTTPS; el hosting Railway bloquea el correo SMTP en su plan Hobby).
//   Sin dominio propio, Resend solo entrega a la dirección con la que se creó la cuenta de Resend:
//   por eso el "Email para los avisos" de Ajustes tiene que ser ese mismo.
// - Respaldo (uso local): Gmail por SMTP con contraseña de aplicación.
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { negocio } from "../negocio.js";

const remitente = () => [negocio.nombreAsistente, negocio.nombreNegocio].filter(Boolean).join(" · ").replace(/[<>"]/g, "");

async function enviarConResend({ para, asunto, cuerpo }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${remitente()} <onboarding@resend.dev>`,
      to: [para || config.emailAvisos],
      subject: asunto,
      text: cuerpo,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

let transporte = null;
async function enviarConGmail({ para, asunto, cuerpo }) {
  transporte ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.gmailUsuario, pass: config.gmailContrasena },
  });
  await transporte.sendMail({
    from: `"${remitente()}" <${config.gmailUsuario}>`,
    to: para || config.emailAvisos,
    subject: asunto,
    text: cuerpo,
  });
}

function metodo() {
  if (config.resendApiKey) return enviarConResend;
  if (config.gmailUsuario && config.gmailContrasena) return enviarConGmail;
  return null;
}

/** Envía un email construido con construirEmail(). Reintenta 3 veces; nunca lanza (registra el fallo). */
export async function enviarEmail(email) {
  const enviar = metodo();
  if (enviar && !(email.para || config.emailAvisos)) {
    console.warn(`[email] Falta el "Email para los avisos" en Ajustes: no se envía "${email.asunto.slice(0, 40)}…"`);
    return false;
  }
  if (!enviar) {
    console.warn(`[email] Sin RESEND_API_KEY ni Gmail configurado: no se envía "${email.asunto.slice(0, 40)}…"`);
    return false;
  }
  for (let intento = 1; intento <= 3; intento++) {
    try {
      await enviar(email);
      return true;
    } catch (error) {
      console.error(`[email] Fallo al enviar (intento ${intento}): ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
  return false;
}

/** Envía un email de prueba real al email de los avisos. */
export async function comprobarEmail() {
  const enviar = metodo();
  if (!enviar) throw new Error("No hay RESEND_API_KEY ni Gmail configurado");
  if (!config.emailAvisos) throw new Error("Falta el Email para los avisos en Ajustes");
  await enviar({
    para: config.emailAvisos,
    asunto: `[PRUEBA] ${negocio.nombreAsistente} puede enviarte avisos ✅`,
    cuerpo: `Si lees esto, los avisos de ${negocio.nombreAsistente} (AGENDAR, AUDIO, ALERTA…) te llegarán a este correo.`,
  });
  return config.resendApiKey ? "Resend" : "Gmail";
}
