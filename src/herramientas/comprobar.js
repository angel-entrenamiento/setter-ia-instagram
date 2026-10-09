// Comprueba que cada clave del .env funciona: npm run comprobar (en el servidor: panel → Ajustes → Comprobar)
import { config } from "../config.js";
import { cargarNegocioLocal } from "../negocio.js";
import { clienteAnthropic } from "../cerebro/llm.js";
import { comprobarClave as comprobarManychat } from "../integraciones/manychat.js";
import { comprobarEmail } from "../integraciones/email.js";

cargarNegocioLocal();
const ok = (t) => console.log(`✅ ${t}`);
const mal = (t) => console.log(`❌ ${t}`);
const pendiente = (t) => console.log(`⏳ ${t}`);

if (!process.env.ANTHROPIC_API_KEY) pendiente("Anthropic: falta la clave");
else
  await clienteAnthropic()
    .models.retrieve("claude-opus-5-5")
    .then(() => ok("Anthropic: clave correcta"))
    .catch((e) => mal(`Anthropic: ${e.message}`));

if (!config.manychatApiKey) pendiente("ManyChat: falta la clave");
else
  await comprobarManychat()
    .then((d) => ok(`ManyChat: clave correcta (cuenta: ${d?.name ?? "?"})`))
    .catch((e) => mal(`ManyChat: ${e.message}`));

if (!config.resendApiKey && !config.gmailContrasena) pendiente("Email: falta RESEND_API_KEY");
else
  await comprobarEmail()
    .then((via) => ok(`Email: enviado un correo de prueba a ${config.emailAvisos} (vía ${via}). Revisa tu bandeja (y spam).`))
    .catch((e) => mal(`Email: ${e.message}`));
