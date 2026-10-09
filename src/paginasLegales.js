// Páginas públicas de privacidad y borrado de datos, con los datos de Ajustes.
// Texto orientativo que cada dueño debe revisar (no es asesoramiento legal).
import { config } from "./config.js";
import { negocio, dueno } from "./negocio.js";

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const estilo = `<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;line-height:1.55;color:#1d1d1b}h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:1.6em}</style>`;
const envolver = (titulo, cuerpo) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>${estilo}</head><body>${cuerpo}</body></html>`;

function datos() {
  const email = esc(config.emailAvisos);
  return {
    marca: esc(negocio.nombreNegocio || dueno()),
    responsable: esc([negocio.nombreDueno, negocio.nombreNegocio].filter(Boolean).join(" · ") || "El titular de la cuenta"),
    cuenta: negocio.cuentaInstagram ? `@${esc(negocio.cuentaInstagram)}` : "esta cuenta",
    asistente: esc(negocio.nombreAsistente),
    dueno: esc(dueno()),
    contacto: email ? `<a href="mailto:${email}">${email}</a>` : "el email de contacto de la cuenta",
  };
}

export function paginaPrivacidad() {
  const d = datos();
  return envolver(
    `Política de privacidad · Asistente de ${d.marca}`,
    `<h1>Política de privacidad del asistente de mensajes de ${d.marca}</h1>
<h2>Responsable</h2>
<p>${d.responsable} (${d.cuenta}). Contacto: ${d.contacto}.</p>
<h2>Qué hace este servicio</h2>
<p>Los mensajes directos que envías a la cuenta de Instagram ${d.cuenta} son atendidos por "${d.asistente}", un asistente virtual con inteligencia artificial del equipo de ${d.dueno}. ${d.dueno} revisa las conversaciones y puede intervenir en cualquier momento.</p>
<h2>Qué datos tratamos</h2>
<ul><li>Tu nombre y usuario de Instagram y el identificador de la conversación.</li>
<li>El contenido de los mensajes que nos envías y nuestras respuestas.</li>
<li>Un resumen de la información que nos cuentas para orientarte (por ejemplo, tu situación, tus objetivos y tu disponibilidad).</li></ul>
<p>No escuchamos ni guardamos el contenido de los audios de forma automática.</p>
<h2>Para qué los usamos</h2>
<p>Únicamente para responder a tus mensajes, orientarte sobre nuestros servicios y, si lo solicitas, organizar una llamada con ${d.dueno}. La base legal es tu consentimiento al escribirnos y la aplicación de medidas precontractuales a petición tuya.</p>
<h2>Con quién se comparten</h2>
<p>Con los proveedores técnicos necesarios para prestar el servicio: Meta (Instagram), ManyChat (gestión de mensajes), Anthropic (modelo de inteligencia artificial que redacta las respuestas), Railway (servidor) y Resend (avisos internos por email). No vendemos tus datos ni los usamos para publicidad.</p>
<h2>Cuánto tiempo los conservamos</h2>
<p>Las conversaciones se borran automáticamente tras ${Math.round(config.diasConservacion / 30)} meses sin actividad, o antes si lo solicitas.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación o la supresión de tus datos, oponerte a su tratamiento o pedir su limitación escribiendo a ${d.contacto}. También puedes reclamar ante la autoridad de protección de datos de tu país (en España, la AEPD: aepd.es).</p>`,
  );
}

export function paginaBorradoDatos() {
  const d = datos();
  return envolver(
    `Eliminación de datos · Asistente de ${d.marca}`,
    `<h1>Cómo pedir que borremos tus datos</h1>
<p>Si quieres que eliminemos tu conversación y los datos asociados del asistente de mensajes de ${d.marca}:</p>
<ol><li>Escribe a ${d.contacto} con el asunto "Borrar mis datos", indicando tu usuario de Instagram; o</li>
<li>Escríbenos por mensaje directo a ${d.cuenta} pidiendo que borremos tus datos.</li></ol>
<p>Borraremos tu conversación de nuestros sistemas en un plazo máximo de 30 días y te lo confirmaremos.</p>`,
  );
}
