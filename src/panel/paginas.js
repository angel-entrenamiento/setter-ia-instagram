// HTML del panel. Sin librerías: formularios sencillos que funcionan en el móvil.
import { config } from "../config.js";
import { negocio } from "../negocio.js";
import { SECCIONES, leerSeccion, huecosPorRellenar, hayAnterior, fechaSeccion, plantilla } from "../cerebro/conocimiento.js";
import { fichaEnTexto, nombreAutor, nombresMetricas } from "../avisos/emails.js";
import { enListaBlanca } from "../motor.js";
import { PREGUNTAS, cambioAplicable } from "./educar.js";

export const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fecha = (iso, opciones = {}) =>
  iso ? new Date(iso).toLocaleString("es-ES", { timeZone: config.zonaHoraria, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", ...opciones }) : "";

const asistente = () => esc(negocio.nombreAsistente);

const ESTILO = `
:root{--fondo:#f6f6f3;--tarjeta:#fff;--texto:#1d1d1b;--suave:#6b6b66;--borde:#e3e3de;--marca:#1f5f4a;--marca-suave:#e5f0eb;--aviso:#fdf1d8;--peligro:#9b2c2c;--enlace:#0b5cad}
@media (prefers-color-scheme:dark){:root{--fondo:#151614;--tarjeta:#1f201d;--texto:#ecece8;--suave:#a3a39c;--borde:#33342f;--marca:#7cc4a6;--marca-suave:#22332b;--aviso:#3a3020;--peligro:#f19999;--enlace:#8ab8f0}}
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:var(--fondo);color:var(--texto);line-height:1.5}
main{max-width:920px;margin:0 auto;padding:16px}a{color:var(--enlace)}h1{font-size:1.35rem;margin:.4em 0}h2{font-size:1.1rem;margin:1.4em 0 .5em}
nav{background:var(--tarjeta);border-bottom:1px solid var(--borde);padding:8px 16px;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}
nav b{margin-right:8px}nav a{text-decoration:none;color:var(--suave);padding:4px 0}nav a.activa{color:var(--texto);font-weight:600;border-bottom:2px solid var(--marca)}
.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:10px;padding:14px 16px;margin:10px 0}
table{border-collapse:collapse;width:100%;background:var(--tarjeta);border-radius:10px;overflow:hidden}
td,th{padding:8px;border-bottom:1px solid var(--borde);text-align:left;font-size:.92rem;vertical-align:top}
.tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.78rem;background:var(--marca-suave)}.pausa{background:var(--aviso)}
.chat div{padding:4px 0}.lead{color:var(--suave)}.bot{color:var(--marca)}.dueno{color:#b4541a}
button,.boton{display:inline-block;padding:8px 14px;margin:4px 6px 4px 0;border-radius:8px;border:1px solid var(--borde);background:var(--tarjeta);color:var(--texto);font-size:.95rem;cursor:pointer;text-decoration:none}
button.principal,.boton.principal{background:var(--marca);border-color:var(--marca);color:#fff}
@media (prefers-color-scheme:dark){button.principal,.boton.principal{color:#111}}
textarea,input[type=text],input[type=email],input[type=url],select{width:100%;font:inherit;padding:8px;border:1px solid var(--borde);border-radius:8px;background:var(--tarjeta);color:var(--texto)}
textarea{min-height:90px}textarea.grande{min-height:60vh;font-family:ui-monospace,Consolas,monospace;font-size:.88rem}
label{display:block;margin:12px 0 4px;font-weight:600}.ayuda{color:var(--suave);font-size:.86rem;margin:2px 0 6px;font-weight:400}
pre{white-space:pre-wrap;word-break:break-word;background:var(--fondo);padding:10px;border-radius:8px;font-size:.86rem}
.metricas span{display:inline-block;margin:3px 14px 3px 0}.ok{color:var(--marca)}.mal{color:var(--peligro)}
.pasos li{margin:6px 0}.copiar{font-family:ui-monospace,Consolas,monospace;background:var(--fondo);padding:2px 6px;border-radius:6px;word-break:break-all}
details summary{cursor:pointer}.fila{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
`;

// Al enviar un formulario lento (IA), desactiva el botón y avisa de que está trabajando
const SCRIPT_ESPERA = `<script>document.addEventListener("submit",e=>{const b=e.submitter;if(b&&b.dataset.espera){setTimeout(()=>{b.disabled=true;b.textContent=b.dataset.espera},0)}})</script>`;

export function pagina(titulo, cuerpo, activa = "") {
  const enlaces = [
    ["/panel", "Inicio"],
    ["/panel/probar", "Probar"],
    ["/panel/conocimiento", "Conocimiento"],
    ["/panel/ajustes", "Ajustes"],
    ["/panel/manychat", "Conectar ManyChat"],
  ]
    .map(([href, nombre]) => `<a href="${href}" class="${activa === href ? "activa" : ""}">${nombre}</a>`)
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><style>${ESTILO}</style></head>
<body><nav><b>🤖 ${asistente()}</b>${enlaces}</nav><main>${cuerpo}</main>${SCRIPT_ESPERA}</body></html>`;
}

function lineasChat(conv) {
  return conv.historial
    .map(
      (m) =>
        `<div class="${esc(m.rol)}"><small>${esc(fecha(m.fecha))}${m.seguimiento !== undefined ? ` · seguimiento ${m.seguimiento === 0 ? "8 h" : "24 h"}` : ""}</small> <b>${esc(nombreAutor(m.rol))}:</b> ${m.tipo !== "texto" ? `[${esc(m.tipo)}] ` : ""}${esc(m.resumen ? `${m.texto} — ${m.resumen}` : m.texto)}</div>`,
    )
    .join("");
}

const formEducar = (convId, vuelta) => `<h2>🎓 Enseñar a ${asistente()}</h2>
<form method="post" action="/panel/educar" class="tarjeta"><input type="hidden" name="convId" value="${esc(convId)}"><input type="hidden" name="vuelta" value="${esc(vuelta)}">
<label>¿Qué debería haber hecho distinto?<p class="ayuda">Explícalo como se lo dirías a un setter humano. Ej.: "Aquí no tenía que proponer la llamada todavía, primero pregúntale qué ha probado" o "Cuando digan que no tienen tiempo, responde como en mi objeción de tiempo". La IA te propondrá cambios en el conocimiento y tú decides si aplicarlos (~0,10 $).</p></label>
<textarea name="comentario" required></textarea>
<button class="principal" data-espera="Pensando la corrección… (30-60 s)">Proponer corrección</button></form>`;

// ---------- Inicio ----------

export function pasosIniciales(almacen) {
  const huecos = SECCIONES.reduce((n, s) => n + huecosPorRellenar(s.archivo), 0);
  return [
    {
      hecho: Boolean(process.env.ANTHROPIC_API_KEY && config.manychatApiKey && (config.resendApiKey || config.gmailContrasena)),
      texto: "Claves de Anthropic, ManyChat y Resend puestas en Railway",
      enlace: "/panel/ajustes#claves",
    },
    {
      hecho: Boolean(negocio.nombreDueno && negocio.nombreNegocio && negocio.cuentaInstagram && negocio.emailAvisos),
      texto: "Rellenar tus datos en Ajustes (tu nombre, tu negocio, tu cuenta y tu email)",
      enlace: "/panel/ajustes",
    },
    {
      hecho: huecos === 0,
      texto: huecos ? `Completar el conocimiento (quedan ${huecos} huecos [RELLENAR]). Lo más rápido: el cuestionario con IA` : "Completar el conocimiento",
      enlace: huecos ? "/panel/crear" : "/panel/conocimiento",
    },
    { hecho: Boolean(almacen.ajuste("probado_panel")), texto: `Hablar con ${asistente()} en "Probar" y corregir lo que no te guste`, enlace: "/panel/probar" },
    { hecho: Boolean(almacen.ajuste("manychat_recibido")), texto: "Conectar ManyChat y escribir desde tu cuenta de pruebas", enlace: "/panel/manychat" },
    { hecho: !config.modoPrueba, texto: "Activarlo para todos (quitar el modo prueba)", enlace: "/panel#modo" },
  ];
}

export function htmlInicio(almacen) {
  const semana = almacen.contarEventos(Date.now() - 7 * 86400000);
  const coste = almacen.sumarCoste(Date.now() - 7 * 86400000);
  const pasos = pasosIniciales(almacen);
  const pendientes = pasos.filter((p) => !p.hecho).length;
  const listaPasos = `<ol class="pasos">${pasos
    .map((p) => `<li>${p.hecho ? "✅" : "⬜"} <a href="${p.enlace}">${p.texto}</a></li>`)
    .join("")}</ol>`;
  const filas = almacen
    .todas()
    .filter((c) => c.historial.length && !c.id.startsWith("panel:"))
    .slice(0, 200)
    .map(
      (c) => `<tr><td><a href="/panel/c/${encodeURIComponent(c.id)}">${esc(c.ficha?.nombre || c.nombre || "Sin nombre")}</a><br><small>@${esc(c.igUsuario || "?")}</small></td>
<td><span class="tag">${esc(c.estado)}</span>${c.pausa ? ` <span class="tag pausa">⏸ ${esc(c.pausa.motivo)}</span>` : ""}</td>
<td>${esc(fecha(c.actualizadaAt, { year: "2-digit" }))}</td></tr>`,
    )
    .join("");
  const m = nombresMetricas();
  const metricas = ["atendida", "cualificado", "llamada_propuesta", ...(negocio.productoBaratoActivo ? ["enlace_pago"] : []), "fuera_de_foco", "audio", "alerta", "humano", "error"]
    .map((k) => `<span>${esc(m[k].replace(/ \(\[.*\]\)/, ""))}: <b>${semana[k] ?? 0}</b></span>`)
    .join("");
  return pagina(
    `${negocio.nombreAsistente} · Panel`,
    `<h1>Panel de ${asistente()}</h1>
${
  pendientes
    ? `<div class="tarjeta"><h2 style="margin-top:0">🚀 Primeros pasos (${pasos.length - pendientes}/${pasos.length})</h2>${listaPasos}</div>`
    : `<details class="tarjeta"><summary>✅ Configuración completa</summary>${listaPasos}</details>`
}
<div class="tarjeta" id="modo"><form method="post" action="/panel/modo" class="fila">
${
  config.modoPrueba
    ? `<span>🧪 <b>MODO PRUEBA</b>: solo responde a ${config.listaBlanca.length ? `@${esc(config.listaBlanca.join(", @"))}` : "<b>nadie</b> (pon tu cuenta de pruebas en Ajustes)"}.</span>
<button class="principal" name="activo" value="no" onclick="return confirm('${asistente()} empezará a contestar a TODOS los que escriban a tu Instagram. ¿Seguro?')">Activar para todos</button>`
    : `<span>✅ <b>ACTIVO PARA TODOS</b> los que escriben a @${esc(negocio.cuentaInstagram)}.</span><button name="activo" value="si">Volver a modo prueba</button>`
}</form></div>
<div class="tarjeta metricas"><b>Últimos 7 días</b><br>${metricas}<span>Gasto IA: <b>${coste.toFixed(2)} $</b></span></div>
<h2>Conversaciones</h2>
<table><tr><th>Contacto</th><th>Estado</th><th>Última actividad</th></tr>${filas || "<tr><td colspan=3>Todavía no hay conversaciones.</td></tr>"}</table>`,
    "/panel",
  );
}

// ---------- Conversación real ----------

export function htmlConversacion(conv) {
  const prueba = enListaBlanca(conv);
  return pagina(
    `${negocio.nombreAsistente} · ${conv.nombre}`,
    `<p><a href="/panel">← Volver</a></p><h1>${esc(conv.ficha?.nombre || conv.nombre || "Sin nombre")} <small>@${esc(conv.igUsuario)}</small></h1>
<p><span class="tag">${esc(conv.estado)}</span> ${conv.pausa ? `<span class="tag pausa">⏸ ${asistente()} pausado (${esc(conv.pausa.motivo)})</span>` : `<span class="tag">▶ ${asistente()} activo</span>`}
${conv.enlaceChat ? ` · <a href="${esc(conv.enlaceChat)}" target="_blank">Abrir en ManyChat</a>` : ""}</p>
<form method="post"><button name="accion" value="pausar">⏸ Pausar a ${asistente()}</button><button name="accion" value="reactivar">▶ Reactivar a ${asistente()}</button>
${prueba ? '<button name="accion" value="reiniciar">🔄 Reiniciar (cuenta de prueba)</button>' : ""}</form>
<h2>Conversación</h2><div class="tarjeta chat">${lineasChat(conv)}</div>
${formEducar(conv.id, `/panel/c/${encodeURIComponent(conv.id)}`)}
<h2>Nota de audio</h2><form method="post" class="tarjeta"><input type="hidden" name="accion" value="nota">
<label>¿Qué dijo en el audio?</label><textarea name="queDijo"></textarea><label>¿Qué le contestaste tú? (opcional)</label><textarea name="queContesto"></textarea>
<button>Guardar nota</button></form><h2>Ficha</h2><pre>${esc(fichaEnTexto(conv.ficha))}</pre>`,
  );
}

export const htmlNota = (conv, guardada) =>
  pagina(
    "Nota de audio",
    guardada
      ? `<h1>✅ Nota guardada y ${asistente()} reactivado</h1><p>${asistente()} ya sabe qué se dijo en el audio de ${esc(conv.nombre || "esta persona")} y seguirá cuando vuelva a escribir por texto.</p>`
      : `<h1>Audio de ${esc(conv.ficha?.nombre || conv.nombre || "contacto")} <small>@${esc(conv.igUsuario)}</small></h1>
<form method="post"><label>¿Qué dijo en el audio? (una línea basta)</label><textarea name="queDijo" required></textarea>
<label>¿Qué le contestaste tú? (opcional)</label><textarea name="queContesto"></textarea><p><button class="principal">Guardar y reactivar a ${asistente()}</button></p>
<p class="ayuda">Guárdalo cuando ya le hayas contestado: así ${asistente()} vuelve a atender la conversación.</p></form>`,
  );

// ---------- Probar ----------

export function htmlProbar(conv, ultimo) {
  const detalles = ultimo
    ? `<div class="tarjeta"><b>Qué ha pasado en el último turno</b>
${ultimo.error ? `<p class="mal">Error: ${esc(ultimo.error)}</p>` : ""}
${ultimo.ignorado ? `<p>${asistente()} no ha respondido: <b>${esc(ultimo.ignorado)}</b></p>` : ""}
${ultimo.salida ? `<p>Estado: <b>${esc(ultimo.salida.estado)}</b> · Acción: <b>${esc(ultimo.salida.accion)}</b><br>Por qué: ${esc(ultimo.salida.nota_interna)}</p>` : ""}
${(ultimo.problemas ?? []).map((p) => `<div class="${p.bloqueante ? "mal" : ""}">${p.bloqueante ? "⛔ Bloqueado" : "⚠ Aviso"} [${esc(p.tipo)}] ${esc(p.detalle)}</div>`).join("")}
${(ultimo.emails ?? []).map((e) => `<details><summary>✉ Email que te llegaría: ${esc(e.asunto)}</summary><pre>${esc(e.cuerpo)}</pre></details>`).join("")}
${ultimo.coste ? `<p class="ayuda">Coste de este turno: ${ultimo.coste.toFixed(3)} $</p>` : ""}</div>`
    : "";
  return pagina(
    `Probar · ${negocio.nombreAsistente}`,
    `<h1>Probar a ${asistente()}</h1>
<p class="ayuda">Escribe como si fueras un lead. Funciona igual que en Instagram (mismas reglas y mismo conocimiento) pero aquí no se envía nada a nadie: los emails de aviso solo se muestran. Cada respuesta cuesta unos 0,03 $.</p>
<div class="tarjeta chat">${lineasChat(conv) || `<span class="ayuda">Todavía no hay mensajes. Empieza escribiendo, por ejemplo, "Hola, quería información".</span>`}</div>
${conv.pausa ? `<p><span class="tag pausa">⏸ ${asistente()} está pausado (${esc(conv.pausa.motivo)})</span> En la vida real ahora te tocaría a ti. Pulsa "Reiniciar" para empezar otra prueba.</p>` : ""}
<form method="post" class="tarjeta"><label>Tú (como lead)</label><textarea name="texto" placeholder="Hola! Vi tu reel y quería información"></textarea>
<div class="fila"><button class="principal" name="accion" value="mensaje" data-espera="${asistente()} está escribiendo…">Enviar</button>
<button name="accion" value="audio">🎤 El lead manda un audio</button>
<button name="accion" value="dueno" title="Lo que escribas arriba se anota como un mensaje tuyo">✍️ Escribo yo (como dueño)</button>
<button name="accion" value="reiniciar" onclick="return confirm('¿Borrar esta conversación de prueba?')">🔄 Reiniciar</button></div></form>
${detalles}
${conv.historial.length ? formEducar(conv.id, "/panel/probar") : ""}
<details><summary>Ficha que ha ido rellenando</summary><pre>${esc(fichaEnTexto(conv.ficha))}</pre></details>`,
    "/panel/probar",
  );
}

// ---------- Conocimiento ----------

export function htmlConocimiento(mensaje = "") {
  const filas = SECCIONES.map((s) => {
    const huecos = huecosPorRellenar(s.archivo);
    const f = fechaSeccion(s.archivo);
    return `<tr><td><a href="/panel/conocimiento/${s.archivo}"><b>${esc(s.nombre)}</b></a><br><span class="ayuda">${esc(s.ayuda)}</span></td>
<td>${huecos ? `<span class="tag pausa">${huecos} por rellenar</span>` : '<span class="tag">✓</span>'}<br><small>${f ? `editado ${esc(fecha(f))}` : "plantilla"}</small></td></tr>`;
  }).join("");
  return pagina(
    "Conocimiento",
    `<h1>Conocimiento de ${asistente()}</h1>
${mensaje ? `<div class="tarjeta ok">${mensaje}</div>` : ""}
<p>Es todo lo que ${asistente()} sabe de tu negocio y de cómo vendes. Lo que cambies aquí se aplica al momento en todas las conversaciones.</p>
<div class="fila"><a class="boton principal" href="/panel/crear">✨ Rellenarlo con IA (cuestionario)</a><a class="boton" href="/panel/prompt">Ver el texto completo que recibe la IA</a></div>
<table>${filas}</table>
<p class="ayuda">Consejo: no hace falta que lo escribas perfecto. Prueba a ${asistente()} en "Probar" y, cuando haga algo mal, usa "Enseñar a ${asistente()}": te propone el cambio exacto.</p>`,
    "/panel/conocimiento",
  );
}

export function htmlEditarSeccion(archivo, mensaje = "") {
  const s = SECCIONES.find((x) => x.archivo === archivo);
  return pagina(
    s.nombre,
    `<p><a href="/panel/conocimiento">← Conocimiento</a></p><h1>${esc(s.nombre)}</h1>
${mensaje ? `<div class="tarjeta ok">${mensaje}</div>` : ""}
<p class="ayuda">${esc(s.ayuda)} Puedes escribir {asistente}, {dueno}, {negocio}, {cuenta}, {llamada} o {producto_barato} y se sustituyen solos por tus datos de Ajustes. Los huecos [RELLENAR…] son lo que falta por completar.</p>
<form method="post"><textarea name="texto" class="grande">${esc(leerSeccion(archivo))}</textarea>
<div class="fila"><button class="principal" name="accion" value="guardar">Guardar</button>
${hayAnterior(archivo) ? '<button name="accion" value="deshacer" onclick="return confirm(\'¿Volver a la versión anterior a tu último cambio?\')">↩ Deshacer el último cambio</button>' : ""}</div></form>
<details><summary>Ver la plantilla original de esta sección</summary><pre>${esc(plantilla(archivo))}</pre></details>`,
    "/panel/conocimiento",
  );
}

export function htmlCrear(respuestas = {}) {
  const campos = PREGUNTAS.map(
    ([k, titulo, ayuda]) => `<label for="${k}">${esc(titulo)}</label><p class="ayuda">${esc(ayuda)}</p><textarea id="${k}" name="${k}">${esc(respuestas[k] ?? "")}</textarea>`,
  ).join("");
  return pagina(
    "Crear el conocimiento con IA",
    `<p><a href="/panel/conocimiento">← Conocimiento</a></p><h1>✨ Crear el conocimiento con IA</h1>
<div class="tarjeta"><p>Contesta lo que puedas (no hace falta todo) y la IA redactará las 6 secciones del conocimiento con tu información. Después repásalas y prueba a ${asistente()}.</p>
<p class="ayuda">Tarda 1-2 minutos y cuesta unos 0,50 $. Lo que haya ahora en el conocimiento se sustituye, pero cada sección guarda su versión anterior por si quieres deshacer. Antes, rellena tus datos en <a href="/panel/ajustes">Ajustes</a>.</p></div>
<form method="post">${campos}<p><button class="principal" data-espera="Redactando tu conocimiento… (1-2 minutos, no cierres la página)">Crear el conocimiento</button></p></form>`,
    "/panel/conocimiento",
  );
}

// ---------- Propuestas de corrección ----------

export function htmlPropuesta(p, resultado = null) {
  const nombreSeccion = (a) => SECCIONES.find((s) => s.archivo === a)?.nombre ?? a;
  const cambios = p.cambios
    .map((c, i) => {
      const aplicable = cambioAplicable(c);
      const hecho = resultado?.aplicados.includes(i) || p.aplicados?.includes(i);
      return `<div class="tarjeta"><label class="fila" style="margin:0">${
        p.aplicada ? (hecho ? "✅" : "—") : `<input type="checkbox" name="c" value="${i}" ${aplicable ? "checked" : "disabled"}>`
      } ${esc(nombreSeccion(c.archivo))}</label>
<p class="ayuda">${esc(c.motivo)}${aplicable ? "" : " · ⚠ Este cambio ya no se puede aplicar porque el texto ha cambiado."}</p>
${c.buscar ? `<b>Quitar:</b><pre>${esc(c.buscar)}</pre>` : "<b>Añadir al final:</b>"}${c.buscar ? "<b>Poner:</b>" : ""}<pre>${esc(c.reemplazar)}</pre></div>`;
    })
    .join("");
  const vuelta = p.convId?.startsWith("panel:") ? "/panel/probar" : `/panel/c/${encodeURIComponent(p.convId)}`;
  return pagina(
    "Corrección propuesta",
    `<p><a href="${vuelta}">← Volver a la conversación</a></p><h1>🎓 Corrección propuesta</h1>
<div class="tarjeta"><b>Lo que dijiste:</b> ${esc(p.comentario)}<br><b>Lo que propone la IA:</b> ${esc(p.resumen)}</div>
${resultado ? `<div class="tarjeta ok">✅ ${resultado.aplicados.length} cambio(s) aplicado(s).${resultado.fallidos.length ? ` ${resultado.fallidos.length} no se pudo aplicar.` : ""} <a href="/panel/probar">Probar otra vez</a></div>` : ""}
<form method="post" action="/panel/propuesta/${esc(p.id)}">${cambios || "<p>La IA no ha propuesto cambios. Prueba a explicarlo con otras palabras.</p>"}
${p.aplicada || !p.cambios.length ? "" : '<button class="principal">Aplicar los cambios marcados</button>'}</form>
<p class="ayuda">Si te arrepientes, en Conocimiento cada sección tiene "Deshacer el último cambio".</p>`,
    "/panel/conocimiento",
  );
}

// ---------- Ajustes ----------

const campoTexto = (k, titulo, ayuda = "", tipo = "text") =>
  `<label for="${k}">${titulo}</label>${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}<input type="${tipo}" id="${k}" name="${k}" value="${esc(negocio[k])}">`;
const campoArea = (k, titulo, ayuda = "") =>
  `<label for="${k}">${titulo}</label>${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}<textarea id="${k}" name="${k}">${esc(negocio[k])}</textarea>`;
const campoSiNo = (k, titulo, ayuda = "") =>
  `<label class="fila"><input type="checkbox" name="${k}" value="si" ${negocio[k] ? "checked" : ""}> ${titulo}</label>${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}`;
const campoOpciones = (k, titulo, opciones, ayuda = "") =>
  `<label for="${k}">${titulo}</label>${ayuda ? `<p class="ayuda">${ayuda}</p>` : ""}<select id="${k}" name="${k}">${opciones
    .map(([v, n]) => `<option value="${v}" ${String(negocio[k]) === v ? "selected" : ""}>${n}</option>`)
    .join("")}</select>`;

export function htmlAjustes(mensaje = "", comprobacion = null) {
  const clave = (nombre, puesta) => `<li>${puesta ? "✅" : "⬜"} <span class="copiar">${nombre}</span></li>`;
  return pagina(
    "Ajustes",
    `<h1>Ajustes</h1>${mensaje ? `<div class="tarjeta ok">${mensaje}</div>` : ""}
<form method="post">
<div class="tarjeta"><h2 style="margin-top:0">Tu asistente y tu negocio</h2>
${campoTexto("nombreAsistente", "Nombre del asistente", "Cómo se presenta a los leads. Ej.: Alex, Lucía…")}
${campoTexto("nombreDueno", "Tu nombre", "Con quien será la llamada. El asistente dirá que es «del equipo de [tu nombre]».")}
${campoTexto("nombreNegocio", "Nombre de tu negocio o marca")}
${campoTexto("cuentaInstagram", "Tu cuenta de Instagram (sin @)")}
${campoArea("aQueSeDedica", "A qué te dedicas, en una o dos frases", "Ej.: Entrenadora online para mujeres de 35-55 que quieren perder grasa sin dietas extremas.")}
${campoTexto("paisPrincipal", "País principal de tus clientes")}
${campoOpciones("zonaHoraria", "Zona horaria", [["Europe/Madrid", "España (península)"], ["Atlantic/Canary", "Canarias"], ["America/Mexico_City", "México"], ["America/Bogota", "Colombia"], ["America/Argentina/Buenos_Aires", "Argentina"], ["America/Santiago", "Chile"], ["America/Lima", "Perú"]])}
${campoSiNo("decirVirtualAlPresentarse", "Decir que es un asistente virtual al presentarse", "Recomendado: la ley europea de IA obliga a informar de que se habla con una IA. Si lo desmarcas, solo lo dirá si se lo preguntan (decisión tuya).")}
${campoArea("bienvenidaManual", "Tu bienvenida manual a seguidores nuevos (opcional)", "Si escribes tú a mano a los seguidores nuevos, pega aquí el texto. Así, cuando contesten, el asistente sigue la conversación sin presentarse.")}
</div>
<div class="tarjeta"><h2 style="margin-top:0">Avisos</h2>
${campoTexto("emailAvisos", "Email para los avisos", "Tiene que ser EL MISMO email con el que creaste la cuenta de Resend (si no, Resend no los entrega).", "email")}
${campoSiNo("emailSeguimientos", "Email diario (9:00) con los seguimientos de los días 3 y 7 ya redactados para que los envíes tú")}
${campoSiNo("resumenSemanal", "Resumen semanal los lunes")}
${campoSiNo("informeDudas", "Informe de dudas e ideas de contenido los jueves (~0,05 $)")}
</div>
<div class="tarjeta"><h2 style="margin-top:0">Llamada y venta</h2>
${campoTexto("descripcionLlamada", "Qué es la llamada que propone", "Ej.: una videollamada gratuita y sin compromiso de 15-20 minutos por Google Meet")}
${campoSiNo("exigirDecisor", "Preguntar siempre quién decide el dinero antes de proponer la llamada (recomendado)")}
${campoSiNo("seguimientosAutomaticos", "Seguimientos automáticos a las 8 h y a las 24 h si el lead deja de contestar")}
<h2>Producto de venta directa por MD (opcional)</h2>
<p class="ayuda">Un producto barato que el asistente puede vender directamente enviando el enlace de pago. Sus criterios (para quién es y para quién no) van en Conocimiento → Productos.</p>
${campoSiNo("productoBaratoActivo", "Tengo un producto de venta directa")}
${campoTexto("productoBaratoNombre", "Nombre del producto")}
${campoTexto("productoBaratoImportes", "Importes que puede decir", "Solo números separados por comas: el precio y, si los menciona, el valor tachado o de los bonus. Ej.: 97, 197. Cualquier otro importe se bloquea.")}
${campoTexto("productoBaratoEnlacePago", "Enlace de pago", "", "url")}
</div>
<div class="tarjeta"><h2 style="margin-top:0">Pruebas e IA</h2>
${campoTexto("listaBlanca", "Cuentas de prueba (sin @, separadas por comas)", "En modo prueba solo responde a estas cuentas. Usa una cuenta secundaria tuya. Desde ellas puedes escribir #reset para empezar de cero.")}
${campoOpciones("modelo", "Modelo de IA", [["opus", "Claude Opus (recomendado, ~0,03 $ por respuesta)"], ["sonnet", "Claude Sonnet (más barato, ~0,02 $ por respuesta)"]])}
${campoOpciones("esfuerzo", "Cuánto piensa antes de responder", [["medium", "Normal (recomendado)"], ["low", "Poco (más rápido y barato)"], ["high", "Mucho (más lento y caro)"]])}
<input type="hidden" name="modoPrueba" value="${negocio.modoPrueba ? "si" : "no"}">
</div>
<p><button class="principal">Guardar ajustes</button></p></form>
<div class="tarjeta" id="claves"><h2 style="margin-top:0">Claves (se ponen en Railway → tu servicio → Variables)</h2>
<ul>${clave("LICENCIA", process.env.LICENCIA)}${clave("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY)}${clave("MANYCHAT_API_KEY", config.manychatApiKey)}${clave("RESEND_API_KEY", config.resendApiKey || config.gmailContrasena)}${clave("PANEL_CLAVE", config.panelClave)}</ul>
<form method="post" action="/panel/comprobar"><button data-espera="Comprobando…">Comprobar que las claves funcionan (envía un email de prueba)</button></form>
${comprobacion ? `<ul>${comprobacion.map(([ok, t]) => `<li class="${ok ? "ok" : "mal"}">${ok ? "✅" : "❌"} ${esc(t)}</li>`).join("")}</ul>` : ""}</div>`,
    "/panel/ajustes",
  );
}

// ---------- ManyChat ----------

export function htmlManychat(almacen) {
  const url = `${config.urlPublica}/manychat/mensaje`;
  const cuerpo = `{"subscriber_id": "{{user_id}}", "texto": "{{last_input_text}}"}`;
  const cuerpoRecurso = `{"subscriber_id": "{{user_id}}", "origen": "recurso", "recurso": "NOMBRE DEL RECURSO"}`;
  const recibido = almacen.ajuste("manychat_recibido");
  return pagina(
    "Conectar ManyChat",
    `<h1>Conectar ManyChat</h1>
<div class="tarjeta">${recibido ? `✅ ManyChat ya está conectado (primer mensaje recibido el ${esc(fecha(recibido))}).` : "⬜ Todavía no ha llegado ningún mensaje desde ManyChat."}</div>
<div class="tarjeta"><h2 style="margin-top:0">1. Que ManyChat le pase los mensajes a ${asistente()}</h2>
<ol class="pasos"><li>En ManyChat: <b>Automatización → Respuesta predeterminada (Default Reply)</b> de Instagram → actívala y edita su flujo.</li>
<li>Añade una acción <b>Petición externa (External Request)</b> con:
<ul><li>Método: <b>POST</b></li><li>URL: <span class="copiar">${esc(url)}</span></li>
<li>Cabecera (Headers): nombre <span class="copiar">X-Token</span> · valor <span class="copiar">${esc(config.tokenManychatEntrada)}</span></li>
<li>Cuerpo (Body), tipo JSON: <span class="copiar">${esc(cuerpo)}</span><br><span class="ayuda">Los {{…}} se insertan con el botón de campos de ManyChat: «User Id» y «Last Text Input».</span></li></ul></li>
<li>Que el flujo <b>no envíe ningún mensaje</b>: solo la petición externa. Publica el flujo (Live).</li>
<li>Si ya usas otras automatizaciones de palabras clave, siguen funcionando: la respuesta predeterminada solo salta cuando no salta ninguna otra.</li></ol></div>
<div class="tarjeta"><h2 style="margin-top:0">2. Etiquetas de control</h2>
<p>Crea en ManyChat estas etiquetas (Settings → Tags) y úsalas en cada contacto cuando lo necesites:</p>
<ul><li><span class="copiar">IA_PAUSA</span>: ${asistente()} deja de contestar a esa persona (te la quedas tú).</li>
<li><span class="copiar">IA_ON</span>: lo reactivas (se quita sola).</li>
<li><span class="copiar">ALUMNO</span>: es cliente tuyo; ${asistente()} nunca le contesta y te avisa por email.</li></ul>
<p class="ayuda">Ojo: si contestas tú desde la bandeja de ManyChat, ManyChat pausa sus automatizaciones en ese chat; pulsa «Reanudar» para que ${asistente()} siga. Si contestas desde la app de Instagram no pasa.</p></div>
<div class="tarjeta"><h2 style="margin-top:0">3. Probar con tu cuenta de pruebas</h2>
<ol class="pasos"><li>Pon tu cuenta secundaria en <a href="/panel/ajustes">Ajustes → Cuentas de prueba</a> (con el modo prueba activado).</li>
<li>Desde esa cuenta, escribe un MD a @${esc(negocio.cuentaInstagram || "tu cuenta")}. ${asistente()} contestará en 1-2 minutos (espera a propósito para parecer humano).</li>
<li>Escribe <span class="copiar">#reset</span> para empezar de cero las veces que quieras.</li>
<li>Cuando todo vaya bien, en <a href="/panel">Inicio</a> pulsa «Activar para todos».</li></ol></div>
<details class="tarjeta"><summary><b>Opcional: seguimientos cuando alguien comenta una palabra clave</b></summary>
<p>Si tienes automatizaciones de comentarios que envían un recurso por MD, ${asistente()} puede hacer los seguimientos a las 8 h y 24 h si no contesta. En ese flujo, <b>después</b> de que la persona pulse el botón del mensaje, añade otra Petición externa:</p>
<ul><li>POST <span class="copiar">${esc(config.urlPublica)}/manychat/contacto</span></li><li>Misma cabecera X-Token</li><li>Cuerpo: <span class="copiar">${esc(cuerpoRecurso)}</span></li></ul>
<p class="ayuda">Tiene que ser después del botón: Instagram solo deja escribir a quien ha interactuado en las últimas 24 h.</p></details>`,
    "/panel/manychat",
  );
}

export const htmlSinLicencia = (e) =>
  pagina(
    "Licencia",
    `<h1>🔒 Tu setter está bloqueado</h1>
<div class="tarjeta mal">${esc(e.motivo || "La licencia no es válida.")}</div>
<div class="tarjeta"><p>Mientras tanto ${asistente()} no contesta a nadie. Para solucionarlo:</p>
<ol class="pasos"><li>Si no tienes clave, pídesela a Ángel López.</li>
<li>En Railway, abre tu servicio → <b>Variables</b> y pon tu clave en <span class="copiar">LICENCIA</span>. Railway reinicia el servidor solo.</li>
<li>Si ya la tenías puesta, pulsa el botón para comprobarla otra vez.</li></ol>
<form method="post" action="/panel/licencia"><button class="principal" data-espera="Comprobando…">Comprobar la licencia</button></form></div>`,
  );

export const htmlPrompt = (texto) =>
  pagina(
    "Prompt completo",
    `<p><a href="/panel/conocimiento">← Conocimiento</a></p><h1>Texto completo que recibe la IA</h1>
<p class="ayuda">Es tu conocimiento con los datos de Ajustes ya sustituidos, más las instrucciones técnicas. Unos ${Math.round(texto.length / 3.5).toLocaleString("es-ES")} tokens.</p><pre>${esc(texto)}</pre>`,
    "/panel/conocimiento",
  );

