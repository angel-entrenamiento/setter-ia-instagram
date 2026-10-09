// Arranque del servidor del setter: npm start
import { config } from "./config.js";
import { negocio } from "./negocio.js";
import { crearServidor, AlmacenSqlite } from "./servidor.js";

const faltan = [
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

// Cada 3 s se lanzan las conversaciones a las que les toca responder (cada una por separado)
setInterval(() => {
  orq.procesarVencidos().catch((e) => console.error(`[cola] ${e.message}`));
}, 3000);
setInterval(() => tareas.cadaCincoMinutos().catch((e) => console.error(`[tareas] ${e.message}`)), 5 * 60000);

process.on("unhandledRejection", (e) => console.error(`[error] ${e?.stack ?? e}`));
