// HTML del panel. Sin librerías: formularios sencillos que funcionan en el móvil.
import { config } from "../config.js";
import { negocio, nombreEtiqueta, etiquetasNoResponder } from "../negocio.js";
import { SECCIONES, leerSeccion, huecosPorRellenar, hayAnterior, fechaSeccion, plantilla } from "../cerebro/conocimiento.js";
import { fichaEnTexto, nombreAutor, nombresMetricas } from "../avisos/emails.js";
import { enListaBlanca } from "../motor.js";
import { PREGUNTAS, cambioAplicable, AJUSTES_EDITABLES } from "./educar.js";
import { estadoActualizacion, corta } from "../actualizacion.js";
import { construirPrompt } from "../cerebro/prompt.js";
import { LISTAS_EDITABLES, listasCrm } from "../crm/opciones.js";
import { listaSeguidos, fechaSeguidos, tamanoAnteriorSeguidos } from "../seguidos.js";
import { etapaDe, ETAPAS } from "../crm/leads.js";

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
.chat{display:flex;flex-direction:column;gap:6px}
.burbuja{max-width:78%;padding:7px 11px;border-radius:14px;white-space:pre-wrap;word-break:break-word;font-size:.94rem;align-self:flex-end;background:var(--marca-suave);border-bottom-right-radius:4px}
.burbuja small{display:block;color:var(--suave);font-size:.72rem;margin-bottom:1px}
.burbuja.lead{align-self:flex-start;background:var(--fondo);border:1px solid var(--borde);border-radius:14px;border-bottom-left-radius:4px}
.burbuja.dueno{background:#fbe6d6}.burbuja.sistema{align-self:center;background:none;color:var(--suave);font-size:.82rem;max-width:100%}
@media (prefers-color-scheme:dark){.burbuja.dueno{background:#4a3020}}
.ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 18px;margin:0}
.ficha div{padding:3px 0;border-bottom:1px solid var(--borde)}.ficha dt{font-size:.78rem;color:var(--suave)}.ficha dd{margin:0}
details.plegado{background:var(--tarjeta);border:1px solid var(--borde);border-radius:10px;padding:10px 16px;margin:10px 0}
details.plegado summary{font-weight:600}details.plegado .tarjeta{border:none;padding:0;margin:8px 0 0}
.indice{display:flex;flex-wrap:wrap;gap:6px}.indice a{padding:4px 10px;border:1px solid var(--borde);border-radius:99px;background:var(--tarjeta);text-decoration:none;font-size:.88rem}
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
.filtros button{padding:6px 10px;font-size:.86rem}.filtros button.activo{border-color:var(--marca);color:var(--marca);font-weight:600}
#tabla button{padding:4px 10px;font-size:.82rem;margin:0;white-space:nowrap}
`;

// Al enviar un formulario lento (IA), desactiva el botón y avisa de que está trabajando
const SCRIPT_ESPERA = `<script>document.addEventListener("submit",e=>{const b=e.submitter;if(b&&b.dataset.espera){setTimeout(()=>{b.disabled=true;b.textContent=b.dataset.espera},0)}})</script>`;

export function pagina(titulo, cuerpo, activa = "") {
  const enlaces = [
    ["/panel", "Inicio"],
    ["/panel/probar", "Probar"],
    ["/panel/asistente", "Asistente"],
    ["/panel/crm", "CRM"],
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

// Mensajes como en Instagram: el lead a la izquierda; el asistente y tú, a la derecha (tú en otro color)
function lineasChat(conv) {
  return conv.historial
    .map(
      (m) =>
        `<div class="burbuja ${esc(m.rol)}"><small>${esc(nombreAutor(m.rol))} · ${esc(fecha(m.fecha))}${m.seguimiento !== undefined ? ` · seguimiento ${m.seguimiento === 0 ? "8 h" : m.seguimiento === 1 ? "24 h" : m.seguimiento}` : ""}</small>${m.tipo !== "texto" ? `[${esc(m.tipo)}] ` : ""}${esc(m.resumen ? `${m.texto} — ${m.resumen}` : m.texto)}</div>`,
    )
    .join("");
}

const formEducar = (convId, vuelta, plegado = false) => `${plegado ? `<details class="plegado"><summary>🎓 Enseñar a ${asistente()} con esta conversación</summary>` : `<h2>🎓 Enseñar a ${asistente()}</h2>`}
<form method="post" action="/panel/educar" class="tarjeta"><input type="hidden" name="convId" value="${esc(convId)}"><input type="hidden" name="vuelta" value="${esc(vuelta)}">
<label>¿Qué debería haber hecho distinto?<p class="ayuda">Explícalo como se lo dirías a un setter humano. Ej.: "Aquí no tenía que proponer la llamada todavía, primero pregúntale qué ha probado" o "Cuando digan que no tienen tiempo, responde como en mi objeción de tiempo". La IA te propondrá cambios en el conocimiento y tú decides si aplicarlos (~0,10 $).</p></label>
<textarea name="comentario" required></textarea>
<button class="principal" data-espera="Pensando la corrección… (30-60 s)">Proponer corrección</button></form>${plegado ? "</details>" : ""}`;

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

const NOMBRE_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.clave, e.nombre]));
/** Texto en el que busca el buscador del inicio: nombre, @usuario, ficha y lo que escribió la persona. */
const textoBuscable = (c) =>
  [c.ficha?.nombre, c.nombre, c.igUsuario, c.ficha?.situacion, ...(c.historial ?? []).filter((m) => m.rol === "lead").map((m) => m.texto)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .slice(0, 3000);

/**
 * @param {object} almacen
 * @param {{ pendientes?: number, esperan?: Set<string>, entrevistas?: object[] }} [crm]  datos del CRM (opcionales)
 */
export function htmlInicio(almacen, { pendientes: tocaTi = 0, esperan = new Set(), entrevistas = [] } = {}) {
  const semana = almacen.contarEventos(Date.now() - 7 * 86400000);
  const coste = almacen.sumarCoste(Date.now() - 7 * 86400000);
  const pasos = pasosIniciales(almacen);
  const pendientes = pasos.filter((p) => !p.hecho).length;
  const listaPasos = `<ol class="pasos">${pasos
    .map((p) => `<li>${p.hecho ? "✅" : "⬜"} <a href="${p.enlace}">${p.texto}</a></li>`)
    .join("")}</ol>`;
  const filaDe = new Map(entrevistas.filter((f) => f.convId).map((f) => [f.convId, f]));
  const convs = almacen.todas().filter((c) => c.historial.length && !c.id.startsWith("panel:"));
  const nPausadas = convs.filter((c) => c.pausa).length;
  const nEsperan = convs.filter((c) => esperan.has(c.id)).length;
  const filas = convs
    .map((c, i) => {
      const id = encodeURIComponent(c.id);
      const tipo = esperan.has(c.id) ? "esperan pausadas" : c.pausa ? "pausadas" : "";
      return `<tr data-b="${esc(textoBuscable(c))}" data-t="${tipo}"${i >= 200 ? " hidden" : ""}><td><a href="/panel/c/${id}">${esc(c.ficha?.nombre || c.nombre || "Sin nombre")}</a><br><small>@${esc(c.igUsuario || "?")}</small></td>
<td><span class="tag">${esc(NOMBRE_ETAPA[etapaDe(c, filaDe.get(c.id))] ?? c.estado)}</span>${c.pausa ? ` <span class="tag pausa">⏸ ${esc(c.pausa.motivo)}</span>` : ""}${esperan.has(c.id) ? ' <span class="tag pausa">Te espera</span>' : ""}</td>
<td>${esc(fecha(c.actualizadaAt, { year: "2-digit" }))}</td>
<td><form method="post" action="/panel/c/${id}" style="margin:0"><input type="hidden" name="volver" value="/panel">${
        c.pausa ? `<button name="accion" value="reactivar" title="${asistente()} vuelve a contestar">▶ Reactivar</button>` : `<button name="accion" value="pausar" title="${asistente()} deja de contestar a esta persona">⏸ Pausar</button>`
      }</form></td></tr>`;
    })
    .join("");
  const m = nombresMetricas();
  const metricas = ["atendida", "cualificado", "llamada_propuesta", ...(negocio.productoBaratoActivo ? ["enlace_pago"] : []), "fuera_de_foco", "audio", "alerta", "humano", "error"]
    .map((k) => `<span>${esc(m[k].replace(/ \(\[.*\]\)/, ""))}: <b>${semana[k] ?? 0}</b></span>`)
    .join("");
  return pagina(
    `${negocio.nombreAsistente} · Panel`,
    `<h1>Panel de ${asistente()}</h1>
${tocaTi ? `<div class="tarjeta" style="border-left:5px solid #c98a00"><b>👉 Te toca a ti: ${tocaTi} ${tocaTi === 1 ? "cosa pendiente" : "cosas pendientes"}</b> <span class="ayuda">(personas que te esperan, llamadas sin fecha o sin marcar)</span> · <a href="/panel/crm#pendientes"><b>Verlas</b></a></div>` : ""}
<p><a href="/panel/crm"><b>📊 Abrir el CRM</b></a> <span class="ayuda">(conversaciones, entrevistas y ventas)</span> · <a href="/panel/seguidos"><b>👥 Personas que sigues</b></a> <span class="ayuda">(${asistente()} no les contesta: ${listaSeguidos(almacen).size})</span></p>
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
<div class="tarjeta metricas"><b>Últimos 7 días</b><br>${metricas}<span>Gasto IA: <b>${coste.toFixed(2)} $</b></span>${desgloseGasto(almacen)}</div>
<h2 id="conversaciones">Conversaciones</h2>
<div class="fila"><input type="text" id="buscar" placeholder="Buscar por nombre, @usuario o algo que dijo (rodilla, precio…)" style="flex:1;min-width:220px" autocomplete="off">
<span class="filtros"><button type="button" data-f="" class="activo">Todas (${convs.length})</button><button type="button" data-f="pausadas">⏸ Pausadas (${nPausadas})</button><button type="button" data-f="esperan">Esperándote (${nEsperan})</button></span></div>
<p class="ayuda" id="cuantas">${convs.length > 200 ? `Se ven las 200 más recientes. El buscador busca en las ${convs.length}.` : ""}</p>
<table id="tabla"><tr><th>Contacto</th><th>Etapa</th><th>Última actividad</th><th></th></tr>${filas || "<tr><td colspan=4>Todavía no hay conversaciones.</td></tr>"}</table>
<p class="ayuda">⏸ Pausar: ${asistente()} deja de contestar a esa persona (te la quedas tú) hasta que pulses ▶ Reactivar.</p>
<script>
(()=>{const q=document.getElementById("buscar"),filas=[...document.querySelectorAll("#tabla tr[data-b]")],info=document.getElementById("cuantas");let filtro="";
const sinTildes=(t)=>t.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const aplicar=()=>{const t=sinTildes(q.value.trim().toLowerCase());let n=0;
for(const f of filas){const ok=(!t||sinTildes(f.dataset.b).includes(t))&&(!filtro||f.dataset.t.split(" ").includes(filtro));const ver=ok&&(t||filtro||n<200);f.hidden=!ver;if(ver)n++}
info.textContent=t||filtro?(n?n+(n===1?" conversación":" conversaciones"):"No hay ninguna con eso."):(filas.length>200?"Se ven las 200 más recientes. El buscador busca en las "+filas.length+".":"")};
q.oninput=aplicar;
for(const b of document.querySelectorAll(".filtros button"))b.onclick=()=>{filtro=b.dataset.f;for(const x of document.querySelectorAll(".filtros button"))x.classList.toggle("activo",x===b);aplicar()};})();
</script>`,
    "/panel",
  );
}

// ---------- Personas que sigues ----------

export function htmlSeguidos(almacen) {
  const lista = [...listaSeguidos(almacen)];
  const cuando = fechaSeguidos(almacen);
  const anterior = tamanoAnteriorSeguidos(almacen);
  return pagina(
    `${negocio.nombreAsistente} · Personas que sigues`,
    `<h1>👥 Personas que sigues</h1>
<p>${asistente()} <b>no contesta</b> (ni hace seguimientos) a las cuentas de esta lista. A todos los demás les contesta como siempre. Tu cuenta de pruebas siempre recibe respuesta.</p>
<div class="tarjeta"><b>${lista.length}</b> cuentas${cuando ? ` · actualizada el ${esc(fecha(cuando, { year: "numeric" }))}` : " · todavía no has cargado ninguna lista"}</div>
<h2>Actualizar la lista</h2>
<ol class="pasos"><li>En Instagram: <b>Centro de cuentas → Tu información y permisos → Descargar tu información</b> → elige tu cuenta → <b>Algunos de tus datos</b> → marca solo <b>Seguidores y seguidos</b> → formato <b>JSON</b> → crear archivo. Te avisan cuando esté listo (puede tardar un rato).</li>
<li>Descarga el .zip, ábrelo y busca el archivo <b>following.json</b> (dentro de la carpeta <i>connections/followers_and_following</i>).</li>
<li>Súbelo aquí. El archivo <b>sustituye</b> la lista entera. Repítelo de vez en cuando: si empiezas a seguir a alguien nuevo, ${asistente()} le contestará hasta que vuelvas a subir el archivo.</li></ol>
<div class="tarjeta"><label>Archivo following.json <span class="ayuda">(sustituye la lista)</span></label><input type="file" id="archivo" accept=".json,.txt,.csv">
<button class="principal" id="guardar">Subir el archivo</button> <span id="estado"></span></div>
<div class="tarjeta"><label>Añadir cuentas a mano <span class="ayuda">(uno por línea o separados por comas; se suman a las que ya hay)</span></label><textarea id="texto"></textarea>
<button class="principal" id="anadir">Añadir a la lista</button> <span id="estado2"></span></div>
${anterior !== null ? `<p class="ayuda">¿Te has equivocado? <button id="deshacer">Deshacer el último cambio</button> (vuelve a la lista anterior de ${anterior} cuentas)</p>` : ""}
${lista.length ? `<details class="tarjeta"><summary>Ver las ${lista.length} cuentas</summary><pre>${esc(lista.map((u) => "@" + u).join("\n"))}</pre></details>` : ""}
<script>
async function enviar(cuerpo,b,e,ok){b.disabled=true;e.textContent="Guardando…";
try{const r=await fetch("/panel/seguidos",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(cuerpo)});const d=await r.json();
if(!r.ok)throw new Error(d.error||r.status);e.textContent="✅ "+ok(d);setTimeout(()=>location.reload(),1200)}catch(x){e.textContent="No se ha podido guardar: "+x.message;b.disabled=false}}
const b=document.getElementById("guardar"),e=document.getElementById("estado");
b.onclick=async()=>{const f=document.getElementById("archivo").files[0];if(!f){e.textContent="Elige el archivo following.json.";return}
if(!confirm("El archivo sustituye la lista entera. ¿Seguimos?"))return;enviar({texto:await f.text()},b,e,(d)=>"Lista guardada: "+d.total+" cuentas")};
const a=document.getElementById("anadir"),e2=document.getElementById("estado2");
a.onclick=()=>{const texto=document.getElementById("texto").value;if(!texto.trim()){e2.textContent="Escribe al menos un usuario.";return}
enviar({texto,anadir:true},a,e2,(d)=>"Añadidas. La lista tiene ahora "+d.total+" cuentas")};
const dz=document.getElementById("deshacer");if(dz)dz.onclick=()=>{if(confirm("¿Volver a la lista anterior?"))enviar({deshacer:true},dz,e,(d)=>"Lista recuperada: "+d.total+" cuentas")};
</script>`,
    "/panel",
  );
}

const NOMBRES_GASTO = { respuestas: "Respuestas a leads", seguimientos: "Seguimientos", panel: "Panel (Probar, Asistente, Enseñar, cuestionario)", informes: "Informes", otros: "Otros" };

function desgloseGasto(almacen) {
  const partes = almacen.costePorTipo(Date.now() - 7 * 86400000);
  const lineas = Object.keys(NOMBRES_GASTO)
    .filter((k) => partes[k])
    .map((k) => `<span>${esc(NOMBRES_GASTO[k])}: ${partes[k].toFixed(2)} $</span>`);
  return lineas.length ? `<br><span class="ayuda">En qué se ha ido:</span> ${lineas.join("")}` : "";
}

/** Tamaño del texto que lee la IA en cada respuesta. Si es muy largo, cada lectura completa sale más cara. */
export function tamanoConocimiento() {
  const tokens = Math.round(construirPrompt().length / 3.5);
  return { tokens, costeLectura: (tokens * 8) / 1e6, largo: tokens > 30000 };
}

function avisoTamano() {
  const t = tamanoConocimiento();
  const texto = `Tamaño actual: unos ${t.tokens.toLocaleString("es-ES")} tokens. Cuando la IA tiene que volver a leerlo entero (por ejemplo, tras una hora sin mensajes) cuesta unos ${t.costeLectura.toFixed(2)} $ con Opus.`;
  return t.largo
    ? `<div class="tarjeta pausa">⚠️ <b>Tu conocimiento es muy largo.</b> ${esc(texto)} Para abaratar cada respuesta, quita lo repetido o lo que no sirve para vender por MD (textos pegados de documentos, ejemplos muy largos…). Puedes pedírselo al Asistente: «resume mi conocimiento sin perder nada importante».</div>`
    : `<p class="ayuda">${esc(texto)}</p>`;
}

// ---------- Conversación real ----------

/** Ficha del lead en tarjeta: lo que hay que leer antes de una llamada (solo los datos que tiene). */
function tarjetaFicha(f = {}) {
  const v = (x) => (Array.isArray(x) ? x.join("; ") : x === true ? "sí" : x);
  const campos = [
    ["Situación", f.situacion], ["Objetivo", f.objetivo], ["Desde cuándo", f.desde_cuando], ["Cómo le afecta", f.afectacion],
    ["Qué ha probado", f.probado], ["Prioridad (1-10)", f.prioridad_1a10 || ""], ["Dispuesto/a a implicarse", f.dispuesto_implicarse],
    ["Quién decide el dinero", f.decisor_economico], ["País / zona horaria", f.pais_zona_horaria], ["Prefiere", f.preferencia_franja],
    ["Objeciones", f.objeciones], ["Señales de alarma", f.senales_alarma], ["Nivel de cualificación", f.nivel_cualificacion],
    ["Escribe un familiar", f.escribe_familiar ? "sí" : ""], ["Otros datos", f.datos_extra],
  ].filter(([, x]) => x !== undefined && x !== null && x !== "" && !(Array.isArray(x) && !x.length) && x !== "desconocido");
  if (!campos.length) return `<div class="tarjeta"><b>Ficha</b><p class="ayuda">Todavía no sabe nada de esta persona.</p></div>`;
  return `<div class="tarjeta"><b>Ficha</b><dl class="ficha">${campos.map(([n, x]) => `<div><dt>${n}</dt><dd>${esc(v(x))}</dd></div>`).join("")}</dl></div>`;
}

/**
 * @param {object} conv
 * @param {{ etapa?: string }} [extra]  etapa del CRM (nombre), si se conoce
 */
export function htmlConversacion(conv, { etapa = "" } = {}) {
  const prueba = enListaBlanca(conv);
  const usuario = String(conv.igUsuario ?? "").replace(/[^\w.]/g, "");
  return pagina(
    `${negocio.nombreAsistente} · ${conv.nombre}`,
    `<p><a href="/panel#conversaciones">← Volver</a></p><h1>${esc(conv.ficha?.nombre || conv.nombre || "Sin nombre")} <small>@${esc(conv.igUsuario)}</small></h1>
<p><span class="tag">${esc(etapa || conv.estado)}</span> ${conv.pausa ? `<span class="tag pausa">⏸ ${asistente()} pausado (${esc(conv.pausa.motivo)})</span>` : `<span class="tag">▶ ${asistente()} activo</span>`}
${usuario ? ` · <a href="https://www.instagram.com/${usuario}/" target="_blank" rel="noopener">Abrir en Instagram</a>` : ""}${conv.enlaceChat ? ` · <a href="${esc(conv.enlaceChat)}" target="_blank">Abrir en ManyChat</a>` : ""}</p>
<form method="post">${conv.pausa ? `<button name="accion" value="reactivar" class="principal">▶ Reactivar a ${asistente()}</button>` : `<button name="accion" value="pausar">⏸ Pausar a ${asistente()}</button>`}
${prueba ? '<button name="accion" value="reiniciar">🔄 Reiniciar (cuenta de prueba)</button>' : ""}</form>
${tarjetaFicha(conv.ficha)}
<h2>Conversación</h2><div class="tarjeta chat">${lineasChat(conv)}</div>
${formEducar(conv.id, `/panel/c/${encodeURIComponent(conv.id)}`, true)}
<details class="plegado"><summary>🎤 Apuntar lo que dijo en un audio</summary><form method="post" class="tarjeta"><input type="hidden" name="accion" value="nota">
<label>¿Qué dijo en el audio?</label><textarea name="queDijo"></textarea><label>¿Qué le contestaste tú? (opcional)</label><textarea name="queContesto"></textarea>
<button>Guardar nota</button></form></details>`,
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
${avisoTamano()}
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
  const vuelta = p.origen === "asistente" ? "/panel/asistente" : p.convId?.startsWith("panel:") ? "/panel/probar" : `/panel/c/${encodeURIComponent(p.convId)}`;
  const ajustes = (p.ajustes ?? [])
    .map((a, i) => {
      const hecho = resultado?.ajustesAplicados?.includes(i) || p.ajustesAplicados?.includes(i);
      return `<div class="tarjeta"><label class="fila" style="margin:0">${
        p.aplicada ? (hecho ? "✅" : "—") : `<input type="checkbox" name="a" value="${i}" checked>`
      } Ajuste: ${esc(AJUSTES_EDITABLES[a.campo] ?? a.campo)}</label><p class="ayuda">${esc(a.motivo)}</p><b>Nuevo valor:</b><pre>${esc(a.valor || "(vacío)")}</pre></div>`;
    })
    .join("");
  return pagina(
    "Corrección propuesta",
    `<p><a href="${vuelta}">← Volver</a></p><h1>${p.origen === "asistente" ? "🤖 Cambios propuestos" : "🎓 Corrección propuesta"}</h1>
<div class="tarjeta"><b>Lo que dijiste:</b> ${esc(p.comentario)}<br><b>Lo que propone la IA:</b> ${esc(p.resumen)}</div>
${resultado ? `<div class="tarjeta ok">✅ ${resultado.aplicados.length + (resultado.ajustesAplicados?.length ?? 0)} cambio(s) aplicado(s).${resultado.fallidos.length ? ` ${resultado.fallidos.length} no se pudo aplicar.` : ""} <a href="/panel/probar">Probar otra vez</a></div>` : ""}
<form method="post" action="/panel/propuesta/${esc(p.id)}">${cambios + ajustes || "<p>La IA no ha propuesto cambios. Prueba a explicarlo con otras palabras.</p>"}
${p.aplicada || !(p.cambios.length || p.ajustes?.length) ? "" : '<button class="principal">Aplicar los cambios marcados</button>'}</form>
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

function bloqueListasCrm() {
  const l = listasCrm();
  const campos = LISTAS_EDITABLES.map(
    ({ clave, nombre, ayuda }) =>
      `<label for="lista_${clave}">${esc(nombre)}</label>${ayuda ? `<p class="ayuda">${esc(ayuda)}</p>` : ""}<textarea id="lista_${clave}" name="lista_${clave}" rows="4">${esc((l[clave] ?? []).join("\n"))}</textarea>`,
  ).join("");
  return `<form method="post" action="/panel/ajustes/crm" class="tarjeta" id="crm"><h2 style="margin-top:0">CRM: opciones de los desplegables</h2>
<p class="ayuda">Las opciones que salen en Datos → Entrevistas del <a href="/panel/crm">CRM</a>. Escribe una opción por línea. Si quitas una que ya usabas, las filas que la tenían la conservan.</p>
${campos}<p><button class="principal">Guardar desplegables</button></p></form>`;
}

function bloqueActualizaciones() {
  const e = estadoActualizacion();
  const estadoTexto = e.copiaPropia
    ? e.hayNueva
      ? `🆕 La plantilla de Ángel tiene novedades que tu copia aún no tiene. Versión instalada: ${corta(e.actual)}.`
      : `✅ Tu copia tiene todas las novedades de la plantilla. Versión instalada: ${corta(e.actual)}.`
    : !e.actual
    ? "No se sabe qué versión está instalada (solo se ve dentro de Railway)."
    : e.hayNueva
      ? `🆕 Hay una versión nueva (${corta(e.ultima)}). Tienes la ${corta(e.actual)}.`
      : e.ultima
        ? `✅ Tienes la última versión (${corta(e.actual)}).`
        : `Versión instalada: ${corta(e.actual)}.`;
  return `<div class="tarjeta" id="actualizaciones"><h2 style="margin-top:0">Actualizaciones</h2>
<p>${esc(estadoTexto)}${e.error ? `<br><span class="mal">${esc(e.error)}</span>` : ""}</p>
${
  e.hayNueva && e.novedades.length
    ? `<details open><summary><b>${e.copiaPropia ? "Qué traen las novedades" : "Qué trae la versión nueva"}</b></summary>${e.novedades
        .map((n) => `<p><b>${esc(n.titulo)}</b>${n.fecha ? ` <span class="ayuda">(${esc(n.fecha)})</span>` : ""}</p><pre>${esc(n.texto)}</pre>`)
        .join("")}</details>`
    : ""
}
${
  e.copiaPropia
    ? `<p class="ayuda">Tienes <b>tu propia copia del código</b>, así que las novedades de la plantilla de Ángel no se instalan solas. Para traerlas, abre Claude Code en tu copia y dile <span class="copiar">trae las novedades de la plantilla</span>. Cada cambio que subas se instala en 2-3 minutos.</p>`
    : e.configurada
    ? `<form method="post" action="/panel/actualizar" class="fila"><button class="principal" name="accion" value="actualizar" onclick="return confirm('Tu setter se reiniciará en 2-3 minutos con la última versión. No pierdes nada de tu configuración. ¿Seguir?')">Actualizar ahora</button><button name="accion" value="comprobar">Comprobar si hay versión nueva</button></form>`
    : `<p class="ayuda">Para que se actualice solo (o con un botón), añade una vez la variable <span class="copiar">TOKEN_RAILWAY</span>: en Railway, abre tu proyecto → <b>Settings → Tokens</b> → crea un token (nombre «actualizaciones», entorno «production»), cópialo y pégalo en tu servicio → <b>Variables</b> → <span class="copiar">TOKEN_RAILWAY</span>.</p>`
}
<p class="ayuda">Con la actualización automática activada (casilla de arriba, en «Pruebas e IA»), las versiones nuevas se instalan solas entre las 3:00 y las 5:00. Tu conocimiento, tus ajustes y tus conversaciones no se tocan.</p></div>`;
}

export function htmlAjustes(mensaje = "", comprobacion = null, error = "") {
  const clave = (nombre, puesta) => `<li>${puesta ? "✅" : "⬜"} <span class="copiar">${nombre}</span></li>`;
  return pagina(
    "Ajustes",
    `<h1>Ajustes</h1>${mensaje ? `<div class="tarjeta ok">${mensaje}</div>` : ""}${error ? `<div class="tarjeta mal">${esc(error)}</div>` : ""}
<div class="indice" style="margin:6px 0 4px"><a href="#negocio">Tu negocio</a><a href="#etiquetas">Etiquetas</a><a href="#avisos">Avisos</a><a href="#venta">Llamada y venta</a><a href="#ia">Pruebas e IA</a><a href="#crm">CRM</a><a href="#actualizaciones">Actualizaciones</a><a href="#claves">Claves</a></div>
<form method="post">
<div class="tarjeta" id="negocio"><h2 style="margin-top:0">Tu asistente y tu negocio</h2>
${campoTexto("nombreAsistente", "Nombre del asistente", "Cómo se presenta a los leads. Ej.: Alex, Lucía…")}
${campoTexto("nombreDueno", "Tu nombre", "Con quien será la llamada. El asistente dirá que es «del equipo de [tu nombre]».")}
${campoTexto("nombreNegocio", "Nombre de tu negocio o marca")}
${campoTexto("cuentaInstagram", "Tu cuenta de Instagram (sin @)")}
${campoArea("aQueSeDedica", "A qué te dedicas, en una o dos frases", "Ej.: Entrenadora online para mujeres de 35-55 que quieren perder grasa sin dietas extremas.")}
${campoTexto("paisPrincipal", "País principal de tus clientes")}
${campoOpciones("zonaHoraria", "Zona horaria", [["Europe/Madrid", "España (península)"], ["Atlantic/Canary", "Canarias"], ["America/Mexico_City", "México"], ["America/Bogota", "Colombia"], ["America/Argentina/Buenos_Aires", "Argentina"], ["America/Santiago", "Chile"], ["America/Lima", "Perú"]])}
${campoSiNo("decirVirtualAlPresentarse", "Decir que es un asistente virtual al presentarse", "Recomendado: la ley europea de IA obliga a informar de que se habla con una IA. Si lo desmarcas, solo lo dirá si se lo preguntan (decisión tuya).")}
<h2 id="etiquetas">Etiquetas de ManyChat</h2>
<p class="ayuda">Escríbelas igual que en ManyChat. Si ya usas otras para lo mismo, pon aquí las tuyas.</p>
${campoTexto("etiquetaPausa", "Etiqueta para pausar al asistente con una persona", "Por defecto IA_PAUSA. Mientras el contacto la tenga, el asistente no le contesta (te lo quedas tú).")}
${campoTexto("etiquetaReactivar", "Etiqueta para reactivarlo", "Por defecto IA_ON. Al ponerla, el asistente vuelve a contestar y la quita sola.")}
${campoTexto("etiquetasNoResponder", "Etiquetas de ManyChat a las que NO contesta", "Separadas por comas, escritas igual que en ManyChat. Ej.: ALUMNO, CLIENTES, AMIGOS. A quien tenga cualquiera de ellas el asistente nunca le escribe (tampoco seguimientos).")}
${campoArea("bienvenidaManual", "Tu bienvenida manual a seguidores nuevos (opcional)", "Si escribes tú a mano a los seguidores nuevos, pega aquí el texto. Así, cuando contesten, el asistente sigue la conversación sin presentarse.")}
</div>
<div class="tarjeta" id="avisos"><h2 style="margin-top:0">Avisos</h2>
${campoTexto("emailAvisos", "Email para los avisos", "Tiene que ser EL MISMO email con el que creaste la cuenta de Resend (si no, Resend no los entrega).", "email")}
${campoSiNo("avisarEtiquetasNoResponder", "Avisarme por email cuando me escriba alguien con una etiqueta de «no contestar» (como mucho una vez cada 12 h por persona)")}
${campoSiNo("avisarActualizaciones", "Avisarme por email cuando haya una versión nueva, con lo que trae")}
${campoSiNo("resumenSemanal", "Resumen semanal los lunes")}
${campoSiNo("informeDudas", "Informe de dudas e ideas de contenido los jueves (~0,05 $)")}
</div>
<div class="tarjeta" id="venta"><h2 style="margin-top:0">Llamada y venta</h2>
${campoTexto("descripcionLlamada", "Qué es la llamada que propone", "Ej.: una videollamada gratuita y sin compromiso de 15-20 minutos por Google Meet")}
${campoSiNo("exigirDecisor", "Preguntar siempre quién decide el dinero antes de proponer la llamada (recomendado)")}
${campoSiNo("seguimientosAutomaticos", "Seguimiento automático a las 24 h si el lead deja de contestar")}
<h2>Producto de venta directa por MD (opcional)</h2>
<p class="ayuda">Un producto barato que el asistente puede vender directamente enviando el enlace de pago. Sus criterios (para quién es y para quién no) van en Conocimiento → Productos.</p>
${campoSiNo("productoBaratoActivo", "Tengo un producto de venta directa")}
${campoTexto("productoBaratoNombre", "Nombre del producto")}
${campoTexto("productoBaratoImportes", "Importes que puede decir", "Solo números separados por comas: el precio y, si los menciona, el valor tachado o de los bonus. Ej.: 97, 197. Cualquier otro importe se bloquea.")}
${campoTexto("productoBaratoEnlacePago", "Enlace de pago", "", "url")}
</div>
<div class="tarjeta" id="ia"><h2 style="margin-top:0">Pruebas e IA</h2>
${campoTexto("listaBlanca", "Cuentas de prueba (sin @, separadas por comas)", "En modo prueba solo responde a estas cuentas. Usa una cuenta secundaria tuya. Desde ellas puedes escribir #reset para empezar de cero.")}
${campoOpciones("modelo", "Modelo de IA", [["opus", "Claude Opus (recomendado, ~0,03 $ por respuesta)"], ["sonnet", "Claude Sonnet (más barato, ~0,02 $ por respuesta)"]])}
${campoOpciones("modeloSeguimientos", "Modelo para los seguimientos", [["sonnet", "Claude Sonnet (recomendado: ~0,01 $ por seguimiento)"], ["opus", "Claude Opus (algo más fino, ~0,03 $ por seguimiento)"]], "Los mensajes cortos de «Hola Laura, pudiste ver mi mensaje?». Las respuestas a los leads siempre usan el modelo de arriba.")}
${campoOpciones("esfuerzo", "Cuánto piensa antes de responder", [["medium", "Normal (recomendado)"], ["low", "Poco (más rápido y barato)"], ["high", "Mucho (más lento y caro)"]])}
${campoSiNo("actualizacionesAutomaticas", "Instalar solo las versiones nuevas de madrugada (3:00-5:00)", "Recomendado. Necesita la variable TOKEN_RAILWAY (ver Actualizaciones, más abajo).")}
<input type="hidden" name="modoPrueba" value="${negocio.modoPrueba ? "si" : "no"}">
</div>
<p><button class="principal">Guardar ajustes</button></p></form>
${bloqueListasCrm()}
${bloqueActualizaciones()}
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
  const cuerpo = `{"subscriber_id": "{{user_id}}", "texto": {{last_input_text}}}`;
  const cuerpoRecurso = `{"subscriber_id": "{{user_id}}", "origen": "recurso", "recurso": "NOMBRE DEL RECURSO"}`;
  const recibido = almacen.ajuste("manychat_recibido");
  return pagina(
    "Conectar ManyChat",
    `<h1>Conectar ManyChat</h1>
<div class="tarjeta">${recibido ? `✅ ManyChat ya está conectado (primer mensaje recibido el ${esc(fecha(recibido))}).` : "⬜ Todavía no ha llegado ningún mensaje desde ManyChat."}</div>
<div class="tarjeta"><h2 style="margin-top:0">1. Que ManyChat le pase los mensajes a ${asistente()}</h2>
<ol class="pasos"><li>En ManyChat: <b>Automatización → Básico → Respuesta predeterminada (Default Reply)</b> de Instagram → actívala y edita su flujo.</li>
<li>⚠️ Pulsa el disparador «El usuario envía un mensaje directo» y marca <b>every time</b> (cada vez). Si se queda en «once per 24 hours», solo pasará el primer mensaje del día y no te llegarán los audios.</li>
<li>Borra el bloque de mensaje que trae y añade una <b>Acción → Solicitud externa (External Request)</b> con:
<ul><li>Método: <b>POST</b></li><li>URL: <span class="copiar">${esc(url)}</span></li>
<li>Cabecera (Headers): nombre <span class="copiar">X-Token</span> · valor <span class="copiar">${esc(config.tokenManychatEntrada)}</span></li>
<li>Cuerpo (Body), tipo JSON: <span class="copiar">${esc(cuerpo)}</span><br><span class="ayuda">Los {{…}} se insertan con el botón «{+} Añadir un campo» de ManyChat: «Id de contacto» (User Id) y «Última entrada de texto» (Last Text Input). Fíjate: <b>«Última entrada de texto» va SIN comillas</b> alrededor.</span></li>
<li>⚠️ <b>Haz clic encima de la etiqueta azul «Última entrada de texto» y marca «Codificar a JSON»</b> (Encode to JSON). Sin esto, los mensajes con varias líneas o comillas no llegan. La vista previa dirá «JSON no válido / variables no definidas»: es normal.</li></ul></li>
<li>Que el flujo <b>no envíe ningún mensaje</b>: solo la petición externa. Publica el flujo (Live).</li>
<li>Si ya usas otras automatizaciones de palabras clave, siguen funcionando: la respuesta predeterminada solo salta cuando no salta ninguna otra.</li></ol></div>
<div class="tarjeta"><h2 style="margin-top:0">2. Etiquetas de control</h2>
<p>Crea en ManyChat estas etiquetas (Settings → Tags) y úsalas en cada contacto cuando lo necesites:</p>
<ul><li><span class="copiar">${esc(nombreEtiqueta("IA_PAUSA"))}</span>: ${asistente()} deja de contestar a esa persona (te la quedas tú).</li>
<li><span class="copiar">${esc(nombreEtiqueta("IA_ON"))}</span>: lo reactivas (se quita sola).</li>
<li>${etiquetasNoResponder().map((e) => `<span class="copiar">${esc(e)}</span>`).join(" ") || "(ninguna)"}: ${asistente()} nunca les contesta (por ejemplo, tus clientes) y te avisa por email si así lo eliges.</li></ul>
<p class="ayuda">Si ya usas otras etiquetas con otros nombres, cámbialos en <a href="/panel/ajustes#etiquetas">Ajustes → Etiquetas de ManyChat</a> (o pídeselo al Asistente) y no tienes que crear estas.</p>
<p class="ayuda">Ojo: si contestas tú desde la bandeja de ManyChat, ManyChat pausa sus automatizaciones en ese chat; pulsa «Reanudar» para que ${asistente()} siga. Si contestas desde la app de Instagram no pasa.</p></div>
<div class="tarjeta"><h2 style="margin-top:0">3. Probar con tu cuenta de pruebas</h2>
<ol class="pasos"><li>Pon tu cuenta secundaria en <a href="/panel/ajustes">Ajustes → Cuentas de prueba</a> (con el modo prueba activado).</li>
<li>Desde esa cuenta, escribe un MD a @${esc(negocio.cuentaInstagram || "tu cuenta")}. ${asistente()} contestará en 1-2 minutos (espera a propósito para parecer humano).</li>
<li>Escribe <span class="copiar">#reset</span> para empezar de cero las veces que quieras.</li>
<li>Cuando todo vaya bien, en <a href="/panel">Inicio</a> pulsa «Activar para todos».</li></ol></div>
<details class="tarjeta"><summary><b>Opcional: seguimientos cuando alguien comenta una palabra clave</b></summary>
<p>Si tienes automatizaciones de comentarios que envían un recurso por MD, ${asistente()} puede hacerle el seguimiento de las 24 h si no contesta. En ese flujo, <b>después</b> de que la persona pulse el botón del mensaje, añade otra Petición externa:</p>
<ul><li>POST <span class="copiar">${esc(config.urlPublica)}/manychat/contacto</span></li><li>Misma cabecera X-Token</li><li>Cuerpo: <span class="copiar">${esc(cuerpoRecurso)}</span></li></ul>
<p class="ayuda">Tiene que ser después del botón: Instagram solo deja escribir a quien ha interactuado en las últimas 24 h.</p></details>`,
    "/panel/manychat",
  );
}

// ---------- Chat Asistente ----------

const formatoTexto = (t) => esc(t).replace(/\n/g, "<br>");

export function htmlAsistente(historial) {
  const mensajes = historial
    .map((m) =>
      m.rol === "usuario"
        ? `<div class="lead" style="margin:10px 0"><small>${esc(fecha(m.fecha))}</small> <b>Tú:</b> ${formatoTexto(m.texto)}${m.archivos?.length ? `<br><small>📎 ${esc(m.archivos.join(", "))}</small>` : ""}</div>`
        : `<div class="bot" style="margin:10px 0"><b>Asistente:</b> ${formatoTexto(m.texto)}${m.propuestaId ? `<br><a class="boton principal" href="/panel/propuesta/${esc(m.propuestaId)}">Ver y aplicar los cambios propuestos</a>` : ""}</div>`,
    )
    .join("");
  return pagina(
    "Asistente",
    `<h1>🤖 Asistente de configuración</h1>
<p class="ayuda">Pídele cambios hablando ("añade mi programa nuevo de 6 meses", "que suene más cercano", "cambia el precio del producto barato a 67") o sube documentos de tu negocio (PDF, .txt, .md) para que saque lo útil. Nunca cambia nada solo: te propone los cambios y tú decides si aplicarlos. Usa tu clave de Anthropic (~0,10 $ por mensaje, algo más con documentos largos).</p>
<div class="tarjeta chat" id="chat">${mensajes || '<span class="ayuda">Todavía no habéis hablado. Prueba, por ejemplo: "Te subo el PDF de mi programa, añade lo importante".</span>'}</div>
<form id="formAsistente" class="tarjeta"><label for="mensaje">Tu mensaje</label><textarea id="mensaje" name="mensaje"></textarea>
<label for="archivos">Documentos (opcional)</label><p class="ayuda">PDF de hasta 100 páginas o archivos de texto. Máximo 15 MB en total. Si es un Word o una presentación, guárdalo antes como PDF.</p>
<input type="file" id="archivos" multiple accept=".pdf,.txt,.md,.csv">
<p><button class="principal" id="enviar">Enviar</button> <span id="estado" class="ayuda"></span></p></form>
<form method="post" action="/panel/asistente/borrar"><button onclick="return confirm('¿Borrar el historial de este chat? El conocimiento no se toca.')">Borrar el historial del chat</button></form>
<script>
const f=document.getElementById("formAsistente"),b=document.getElementById("enviar"),e=document.getElementById("estado");
document.getElementById("chat").scrollTop=1e9;
const leer=(a)=>new Promise((ok,mal)=>{const r=new FileReader();r.onload=()=>ok({nombre:a.name,datos:String(r.result).split(",")[1]});r.onerror=mal;r.readAsDataURL(a)});
f.addEventListener("submit",async(ev)=>{ev.preventDefault();const mensaje=document.getElementById("mensaje").value.trim();const lista=[...document.getElementById("archivos").files];
if(!mensaje&&!lista.length)return;if(lista.reduce((n,a)=>n+a.size,0)>15e6){e.textContent="Los documentos pesan más de 15 MB.";return}
b.disabled=true;e.textContent=lista.length?"Leyendo tus documentos… (puede tardar 1-2 minutos)":"Pensando…";
try{const archivos=await Promise.all(lista.map(leer));const r=await fetch("/panel/asistente",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mensaje,archivos})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||("Error "+r.status));location.reload()}catch(x){e.textContent="No se ha podido enviar: "+x.message;b.disabled=false}});
</script>`,
    "/panel/asistente",
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

