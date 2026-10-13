// Arranque del servidor del setter: npm start
import { config } from "./config.js";
import { negocio } from "./negocio.js";
import { crearServidor, AlmacenSqlite } from "./servidor.js";
import { comprobarLicencia, estadoLicencia } from "./licencia.js";

const faltan = [
  ["LICENCIA", process.env.LICENCIA],
  ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
  ["MANYCHAT_API_KEY", config.manychatApiKey],
  ["RESEND_API_KEY", config.resendApiKey || config.gmailContrasena],
  ["PANEL_CLAVE", config.panelClave],
].filter(([, v]) => !v);
for (const [k] of faltan) console.warn(`⚠ Falta la variable ${k}`);

const almacen = new AlmacenSqlite(config.archivoBaseDatos);
const { servidor, orq, tareas } = crearServidor({ almacen });
servidor.listen(config.puerto, () => {
  console.log(
    `${negocio.nombreAsistente} escuchando en el puerto ${config.puerto} · ${config.modoPrueba ? `MODO PRUEBA (${config.listaBlanca.length ? `@${config.listaBlanca.join(", @")}` : "sin cuentas de prueba"})` : "ACTIVO PARA TODOS"} · modelo ${config.modelo} · panel ${config.urlPublica}/panel`,
  );
});

// Licencia: al arrancar, cada 6 h y, si no es válida, cada 5 min (por si Ángel la activa o vuelve la conexión)
async function revisarLicencia() {
  const antes = estadoLicencia().estado;
  const e = await comprobarLicencia(almacen, { cuenta: negocio.cuentaInstagram, url: config.urlPublica });
  if (e.estado !== antes || e.estado !== "ok") console.log(`[licencia] ${e.estado}${e.motivo ? `: ${e.motivo}` : ""}`);
}
await revisarLicencia();
setInterval(() => {
  const e = estadoLicencia();
  const hace = Date.now() - Date.parse(e.comprobadaAt ?? 0);
  if (hace > 6 * 3600000 || (e.estado !== "ok" && hace > 5 * 60000)) revisarLicencia().catch(() => {});
}, 60000);

// Cada 3 s se lanzan las conversaciones a las que les toca responder (cada una por separado)
setInterval(() => {
  orq.procesarVencidos().catch((e) => console.error(`[cola] ${e.message}`));
}, 3000);
setInterval(() => tareas.cadaCincoMinutos().catch((e) => console.error(`[tareas] ${e.message}`)), 5 * 60000);

process.on("unhandledRejection", (e) => console.error(`[error] ${e?.stack ?? e}`));
