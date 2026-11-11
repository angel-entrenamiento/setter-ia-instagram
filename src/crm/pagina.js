// Página del CRM (todo en un archivo: HTML + CSS + JS sin librerías). Los datos van y vienen por /panel/crm/api/…
// Cada casilla se guarda sola al cambiarla. Los datos se pintan con textContent/value (nunca innerHTML con datos).

export function paginaCrm({ titulo }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo.replace(/[<>&"]/g, "")}</title>
<style>
:root{--fondo:#f6f6f4;--papel:#fff;--tinta:#1d1d1b;--suave:#6b6b66;--linea:#e3e3e0;--acento:#0b5cad;--auto:#eef6ee;--hoy:#fff7d6;--total:#f0f0ec;--verde:#2e8540;--amarillo:#c98a00;--rojo:#c0392b}
@media (prefers-color-scheme:dark){:root{--fondo:#161615;--papel:#20201f;--tinta:#ecece8;--suave:#a3a39d;--linea:#3a3a37;--acento:#6aa8ff;--auto:#1f2e21;--hoy:#3a3420;--total:#2a2a28;--verde:#5cbf6e;--amarillo:#e6b032;--rojo:#ef6b5b}}
*{box-sizing:border-box}
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:var(--fondo);color:var(--tinta)}
a{color:var(--acento)}
header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-bottom:12px}
h1{font-size:1.25rem;margin:0}
nav button,.barra button,.barra select{padding:7px 12px;border-radius:6px;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);font-size:.92rem;cursor:pointer}
nav button.activa{background:var(--acento);color:#fff;border-color:var(--acento)}
.barra{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
.tabla{overflow-x:auto;background:var(--papel);border:1px solid var(--linea);border-radius:8px;max-width:100%}
table{border-collapse:collapse;min-width:100%}
th,td{border-bottom:1px solid var(--linea);padding:4px 6px;font-size:.85rem;text-align:left;vertical-align:top;white-space:nowrap}
th{position:sticky;top:0;background:var(--total);font-weight:600}
td input,td select,td textarea{width:100%;min-width:70px;border:1px solid transparent;background:transparent;color:var(--tinta);font:inherit;padding:3px 4px;border-radius:4px}
td input:hover,td select:hover,td textarea:hover{border-color:var(--linea)}
td input:focus,td select:focus,td textarea:focus{border-color:var(--acento);outline:none;background:var(--papel)}
td input[type=number]{width:70px;min-width:60px;border-color:var(--linea)}
td input[type=text]{min-width:130px}
td input[type=checkbox]{width:auto;min-width:0}
td textarea{min-width:180px;min-height:30px;resize:vertical;white-space:pre-wrap}
tr.hoy td{background:var(--hoy)}
tr.total td{background:var(--total);font-weight:600}
tr.asistente td:first-child{border-left:3px solid #3a8a3a}
.auto{background:var(--auto)}
.nota{display:block;width:100%;min-height:60px;margin:4px 0 12px;padding:8px;border:1px solid var(--linea);border-radius:6px;background:var(--papel);color:var(--tinta);font:inherit}
.resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0}
.resumen div{background:var(--papel);border:1px solid var(--linea);border-radius:8px;padding:8px 10px}
.resumen b{display:block;font-size:1.3rem}
.resumen span{color:var(--suave);font-size:.8rem}
.suave{color:var(--suave);font-size:.85rem}
.estado{position:fixed;right:12px;bottom:12px;background:var(--papel);border:1px solid var(--linea);border-radius:6px;padding:6px 10px;font-size:.85rem}
h2{font-size:1.05rem;margin:18px 0 6px}
.borrar{border:none;background:none;cursor:pointer;color:var(--suave)}
.periodo{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 12px}
.periodo button{padding:6px 10px;border-radius:6px;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);cursor:pointer;font-size:.88rem}
.periodo button.activa{border-color:var(--acento);color:var(--acento);font-weight:600}
.periodo input{padding:5px 6px;border:1px solid var(--linea);border-radius:6px;background:var(--papel);color:var(--tinta);font:inherit;font-size:.88rem}
.tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:8px 0 16px}
.tarjeta-kpi{background:var(--papel);border:1px solid var(--linea);border-radius:10px;padding:12px 14px;border-top:4px solid var(--linea)}
.tarjeta-kpi.verde{border-top-color:var(--verde)}.tarjeta-kpi.amarillo{border-top-color:var(--amarillo)}.tarjeta-kpi.rojo{border-top-color:var(--rojo)}
.tarjeta-kpi .titulo{font-size:.85rem;color:var(--suave)}
.tarjeta-kpi .valor{font-size:2rem;font-weight:700;margin:2px 0;font-variant-numeric:tabular-nums}
.tarjeta-kpi .detalle{font-size:.82rem;color:var(--suave)}
.pastilla{display:inline-block;font-size:.78rem;font-weight:600;padding:2px 8px;border-radius:99px;margin-top:6px;border:1px solid var(--linea);color:var(--tinta)}
.pastilla.verde{border-color:var(--verde)}.pastilla.amarillo{border-color:var(--amarillo)}.pastilla.rojo{border-color:var(--rojo)}
.pastilla i{font-style:normal;margin-right:4px}
.pastilla.verde i{color:var(--verde)}.pastilla.amarillo i{color:var(--amarillo)}.pastilla.rojo i{color:var(--rojo)}
.camino{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0 16px}
@media (max-width:900px){.camino{grid-template-columns:repeat(2,1fr)}}
@media (max-width:520px){.camino{grid-template-columns:1fr}}
.bloque{display:flex;flex-direction:column;gap:10px}
.bloque h3{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--suave)}
.bloque h3 b{color:var(--acento)}
.bloque .tarjeta-kpi{flex:1;cursor:pointer}
.tarjeta-kpi .mas{display:none}
.tarjeta-kpi:hover .mas,.tarjeta-kpi.abierta .mas{display:block}
.debil{background:var(--papel);border:1px solid var(--linea);border-left:6px solid var(--linea);border-radius:10px;padding:12px 16px;margin:8px 0 16px}
.debil.rojo{border-left-color:var(--rojo)}.debil.amarillo{border-left-color:var(--amarillo)}.debil.bien{border-left-color:var(--verde)}
.debil .frase{font-size:1.1rem;font-weight:600;margin:0 0 4px}
.debil p{margin:4px 0}
.caja{background:var(--papel);border:1px solid var(--linea);border-radius:10px;padding:12px 14px;margin:8px 0 16px}
.caja h2{margin-top:0}
.rapido{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rapido input{width:90px;padding:6px;border:1px solid var(--linea);border-radius:6px;background:var(--papel);color:var(--tinta);font:inherit}
.rapido button{padding:7px 12px;border-radius:6px;border:1px solid var(--acento);background:var(--acento);color:#fff;cursor:pointer}
.grafico{position:relative}
.grafico svg{width:100%;height:auto;max-height:300px;display:block}
.tip{position:absolute;pointer-events:none;background:var(--papel);border:1px solid var(--linea);border-radius:6px;padding:6px 8px;font-size:.8rem;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap}
.embudo{display:flex;flex-direction:column;gap:4px}
.paso{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center}
.paso .nombre{font-size:.88rem;text-align:right}
.paso .barra-emb{height:30px;background:var(--acento);border-radius:0 4px 4px 0;min-width:2px}
.paso .fila-barra{display:flex;align-items:center;gap:8px}
.paso .cifra{font-weight:700;font-variant-numeric:tabular-nums}
.paso.final .barra-emb{background:var(--verde)}
.caida{display:grid;grid-template-columns:150px 1fr;gap:10px;font-size:.78rem;color:var(--suave)}
.caida span:last-child{padding-left:4px}
.pend{display:flex;flex-direction:column;gap:8px}
.item{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:space-between;background:var(--papel);border:1px solid var(--linea);border-left:4px solid var(--acento);border-radius:8px;padding:10px 12px}
.item.urgente{border-left-color:var(--rojo)}.item.aviso{border-left-color:var(--amarillo)}.item.caducado{border-left-color:var(--linea);opacity:.75}
.item .quien{font-weight:600}
.item .que{font-size:.85rem;color:var(--suave)}
.item .cita{font-size:.82rem;color:var(--suave);font-style:italic;max-width:520px}
.item .acciones{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.item .acciones button,.item .acciones a.boton{padding:6px 10px;border-radius:6px;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);cursor:pointer;font-size:.85rem;text-decoration:none}
.item .acciones button.si{border-color:var(--verde)}.item .acciones button.no{border-color:var(--rojo)}
.item .acciones input{padding:5px;border:1px solid var(--linea);border-radius:6px;background:var(--papel);color:var(--tinta);font:inherit}
.reloj{font-size:.8rem;font-weight:600}
.reloj.urgente{color:var(--rojo)}.reloj.aviso{color:var(--amarillo)}
.vacio{color:var(--suave);font-size:.9rem;padding:4px 0}
.tablero{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:10px;overflow-x:auto;padding-bottom:8px}
.columna{background:var(--total);border-radius:10px;padding:8px;min-height:80px}
.columna h3{font-size:.85rem;margin:2px 4px 8px;display:flex;justify-content:space-between}
.columna.foco{outline:2px solid var(--acento)}
.ficha-lead{display:block;background:var(--papel);border:1px solid var(--linea);border-radius:8px;padding:8px 10px;margin-bottom:6px;color:var(--tinta);text-decoration:none;font-size:.82rem}
.ficha-lead:hover{border-color:var(--acento)}
.ficha-lead b{display:block;font-size:.9rem}
.ficha-lead .meta{color:var(--suave);font-size:.75rem;margin-top:2px}
.ficha-lead .ult{color:var(--suave);font-style:italic;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ficha-lead .parado{color:var(--rojo);font-weight:600;font-size:.75rem;margin-top:4px}
.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}
.chips button{padding:5px 10px;border-radius:99px;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);cursor:pointer;font-size:.85rem}
.chips button.activa{border-color:var(--acento);color:var(--acento);font-weight:600}
.chips input{padding:6px 8px;border:1px solid var(--linea);border-radius:6px;background:var(--papel);color:var(--tinta);font:inherit;font-size:.88rem;min-width:180px}
.caja h2 button,.columna>button{margin-left:8px;padding:5px 10px;border-radius:6px;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);cursor:pointer;font-size:.82rem;font-weight:400}
.lista-foco{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.reg{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
@media (max-width:900px){.reg{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){table.diario th,table.diario td{padding:7px 6px;font-size:.8rem}.subpestanas button{padding:8px 7px;font-size:.85rem}}
.subpestanas{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--linea);margin:-4px -14px 12px;padding:0 14px}
.subpestanas button{border:none;background:none;color:var(--suave);padding:10px 12px;font-size:.95rem;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
.subpestanas button.activa{color:var(--tinta);font-weight:600;border-bottom-color:var(--acento)}
.navmes{display:flex;justify-content:center;align-items:center;gap:16px;margin:6px 0 10px}
.navmes button{width:34px;height:34px;border-radius:50%;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);cursor:pointer;font-size:1rem}
.navmes b{font-size:1.05rem;min-width:150px;text-align:center}
table.diario{width:100%}
table.diario th,table.diario td{padding:9px 10px;font-size:.9rem}
table.diario th{text-transform:uppercase;font-size:.72rem;letter-spacing:.04em;color:var(--suave)}
table.diario td+td,table.diario th+th{text-align:right;font-variant-numeric:tabular-nums}
.lateral{background:var(--papel);border:1px solid var(--linea);border-radius:10px;padding:12px 14px}
.lateral .eti{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--suave)}
.segmentado{display:flex;background:var(--total);border-radius:99px;padding:3px;margin:8px 0 10px}
.segmentado button{flex:1;border:none;background:none;border-radius:99px;padding:6px 4px;color:var(--suave);cursor:pointer;font-size:.88rem}
.segmentado button.activa{background:var(--tinta);color:var(--papel);font-weight:600}
.lateral h3{text-align:center;margin:4px 0 8px;font-size:1rem}
.bloque{border-top:1px solid var(--linea);padding:8px 0}
.linea{display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:.85rem;color:var(--suave);font-variant-numeric:tabular-nums}
.linea.fuerte{color:var(--tinta);font-weight:600;font-size:.95rem}
.linea.fuerte b{font-size:1.05rem}
.comp{font-size:.72rem;margin-right:8px;color:var(--suave);font-weight:600}.comp.sube{color:var(--verde)}.comp.baja{color:var(--rojo)}
@media (max-width:560px){.paso,.caida{grid-template-columns:100px 1fr}.paso .nombre{font-size:.8rem}}
.res-compacto .res-arriba{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}
.res-compacto .res-arriba>*{margin:0}
.res-compacto .debil{padding:8px 12px}.res-compacto .debil .frase{font-size:.95rem}.res-compacto .debil p{margin:2px 0;font-size:.88rem}
.res-compacto .res-arriba .caja{padding:8px 12px;font-size:.88rem}
.res-compacto .res-medio{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start;margin-top:10px}
.res-compacto .camino{gap:8px;margin:6px 0 8px}.res-compacto .bloque{gap:8px}
.res-compacto .tarjeta-kpi{padding:8px 10px;border-top-width:3px}
.res-compacto .tarjeta-kpi .titulo{font-size:.78rem}
.res-compacto .tarjeta-kpi .valor{font-size:1.45rem;margin:0}
.res-compacto .tarjeta-kpi .detalle,.res-compacto .pastilla{font-size:.74rem}
.res-compacto .pastilla{margin-top:4px;padding:1px 7px}
.res-compacto .ver-quien{margin-top:4px;font-size:.76rem}
.res-compacto .objetivo-mini{margin:20px 0 0;padding:10px 12px}
.res-compacto .objetivo-mini h2{font-size:.95rem}
.res-compacto .objetivo-mini input{width:4.5em}
.res-compacto .caja{padding:10px 12px;margin:8px 0 10px}
.res-compacto .caja h2{font-size:.95rem;margin-bottom:4px}
.res-compacto .caja>p.suave{font-size:.8rem;margin:2px 0 6px}
.res-compacto #embudo .paso .barra-emb{height:20px}.res-compacto #embudo .paso .nombre{font-size:.84rem}.res-compacto #embudo .caida{font-size:.74rem}
.res-compacto .res-abajo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}
.res-compacto .res-abajo .grafico svg{max-height:200px}
.res-compacto #embudo{margin-top:8px}.res-compacto .embudo{gap:2px}
.res-compacto .resumen{margin:4px 0 8px}.res-compacto .resumen b{font-size:1.1rem}
@media (max-width:900px){.res-compacto .res-arriba,.res-compacto .res-medio,.res-compacto .res-abajo{grid-template-columns:1fr}.res-compacto .objetivo-mini{margin-top:0}}
.ver-quien{display:block;margin-top:8px;width:max-content;font-size:.82rem;font-weight:600}
.tarjeta-kpi.aviso{border-top-color:var(--amarillo)}.pastilla.aviso{border-color:var(--amarillo)}.pastilla.aviso i{color:var(--amarillo)}
.quien-lista{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.quien-lista a{border:1px solid var(--linea);border-radius:6px;padding:3px 8px;text-decoration:none;color:var(--tinta);font-size:.84rem;background:var(--fondo)}
.quien-lista a:hover{border-color:var(--acento)}
.item{padding:6px 10px}.item>div:first-child{display:flex;flex-wrap:wrap;gap:0 12px;align-items:baseline;min-width:0;flex:1}
.item .cita{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px}
.item .acciones button,.item .acciones a.boton{padding:4px 9px;font-size:.8rem}
.pend{gap:4px}
.ficha-lead{padding:5px 8px;margin-bottom:4px}.ficha-lead b{font-size:.84rem}
.tablero{grid-auto-columns:minmax(165px,1fr)}
</style></head><body>
<header><a href="/panel">← Panel</a><h1>CRM</h1><a href="/panel/ajustes#crm">Cambiar los desplegables</a>
<nav id="pestanas"></nav>
<span class="barra">Año <select id="anio"></select></span></header>
<main id="contenido">Cargando…</main>
<div class="estado" id="estado" hidden></div>
<script>
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
// La pestaña ["lead_magnets","Lead magnets"] está oculta por ahora; el código sigue abajo por si se recupera
// 5 pestañas. El Embudo va dentro de Resumen; Conversaciones, Entrevistas y Ventas, dentro de Datos.
const PESTANAS = [["registro","Registro"],["resumen","Resumen y embudo"],["pendientes","Te toca a ti"],["leads","Leads"],["datos","Datos"]];
const SUB_DATOS = [["conversaciones","Conversaciones (por día)"],["entrevistas","Entrevistas"],["ventas","Ventas"]];
// Nombres antiguos (enlaces o lo guardado en el navegador) → pestaña nueva
const ANTIGUAS = { embudo: "resumen", conversaciones: "datos", entrevistas: "datos", ventas: "datos" };
let D = null; // datos del año
const PEND = { total: 0 }; // cuántas cosas hay en «Te toca a ti» (para la pestaña)
// Se puede abrir una pestaña desde un enlace (p. ej. /panel/crm#pendientes desde el inicio del panel)
const pedida = [location.hash.slice(1), leer("crm_pestana")].find((v) => v && (PESTANAS.some((p) => p[0] === v) || ANTIGUAS[v]));
const pestanaInicial = pedida ? ANTIGUAS[pedida] || pedida : "registro";
const subInicial = SUB_DATOS.some((x) => x[0] === pedida) ? pedida : SUB_DATOS.some((x) => x[0] === leer("crm_datos")) ? leer("crm_datos") : "entrevistas";
const estado = { pestana: pestanaInicial, sub: subInicial, mes: null };

function leer(k){ try { return localStorage.getItem(k); } catch { return null; } }
function guardarLocal(k,v){ try { localStorage.setItem(k,v); } catch {} }
const el = (tag, props = {}, ...hijos) => { const e = document.createElement(tag); Object.assign(e, props); for (const h of hijos) if (h != null) e.append(h); return e; };
const SI = (v) => v === true || v === 1 || v === "1" || v === "si";

function aviso(texto, error) {
  const e = document.getElementById("estado");
  e.hidden = false; e.textContent = texto; e.style.color = error ? "#c0392b" : "";
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (e.hidden = true), error ? 6000 : 1200);
}
async function api(ruta, metodo = "GET", cuerpo) {
  // location.origin: sin usuario:clave en la URL (si la página se abrió así, fetch fallaría)
  const r = await fetch(location.origin + "/panel/crm/api/" + ruta, { method: metodo, headers: { "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) { aviso("No se ha podido guardar. Revisa la conexión.", true); throw new Error(await r.text()); }
  return r.json();
}
async function cargar() {
  const anio = document.getElementById("anio").value;
  D = await api("datos?anio=" + anio);
  try { PEND.total = (await api("pendientes")).total; } catch {}
  if (!estado.mes) estado.mes = Number(D.hoy.slice(5, 7));
  pintar();
}
function pintar() {
  const nav = document.getElementById("pestanas"); nav.replaceChildren();
  for (const [clave, nombre] of PESTANAS) nav.append(el("button", { textContent: nombre + (clave === "pendientes" && PEND.total ? " (" + PEND.total + ")" : ""), className: estado.pestana === clave ? "activa" : "", onclick: () => { estado.pestana = clave; if (clave === "leads") LD.foco = null; guardarLocal("crm_pestana", clave); try { history.replaceState(null, "", "#" + clave); } catch {} pintar(); } }));
  const c = document.getElementById("contenido"); c.replaceChildren();
  ({ registro: pintarRegistro, pendientes: pintarPendientes, leads: pintarLeads, resumen: pintarResumen, datos: pintarDatos, conversaciones: pintarConversaciones, entrevistas: pintarEntrevistas, ventas: pintarVentas, lead_magnets: pintarLeadMagnets }[estado.pestana] || pintarConversaciones)(c);
}
function pintarDatos(c) {
  c.append(el("div", { className: "periodo" }, ...SUB_DATOS.map(([k, n]) => el("button", { textContent: n, className: estado.sub === k ? "activa" : "", onclick: () => { estado.sub = k; guardarLocal("crm_datos", k); pintar(); } }))));
  ({ conversaciones: pintarConversaciones, entrevistas: pintarEntrevistas, ventas: pintarVentas }[estado.sub])(c);
}
function selectorMes(alCambiar) {
  const s = el("select", { onchange: () => { estado.mes = Number(s.value); alCambiar(); } });
  MESES.forEach((m, i) => s.append(el("option", { value: i + 1, textContent: m[0].toUpperCase() + m.slice(1), selected: estado.mes === i + 1 })));
  return s;
}
const pad = (n) => String(n).padStart(2, "0");
const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate();
const num = (v) => Number(v) || 0;

function campoNota(clave, placeholder) {
  return el("textarea", { className: "nota", value: D.notas[clave] || "", placeholder, onchange: async (e) => { D.notas[clave] = e.target.value; await api("nota", "POST", { clave, texto: e.target.value }); aviso("Guardado"); } });
}

// ---------- Conversaciones ----------
function totalMes(anio, mes, campo) {
  let t = 0;
  for (let d = 1; d <= diasDelMes(anio, mes); d++) t += num(D.kpis[anio + "-" + pad(mes) + "-" + pad(d)]?.[campo]);
  return t;
}
function pintarConversaciones(c) {
  const anio = D.anio, mes = estado.mes, campos = D.opciones.CAMPOS_KPI;
  c.append(el("div", { className: "barra" }, "Mes ", selectorMes(pintar), el("span", { className: "suave", textContent: " " + D.asistente + " rellena solo Inbound, Lead magnet y Agendadas. Tú pones el Outbound. Las Cerradas se suman al marcar «Entra» en Entrevistas (también puedes corregir cualquier número a mano)." })));
  const tabla = el("table");
  tabla.append(el("tr", {}, el("th", { textContent: MESES[mes - 1] + " " + anio }), ...campos.map((k) => el("th", { textContent: k.nombre }))));
  for (let d = 1; d <= diasDelMes(anio, mes); d++) {
    const fecha = anio + "-" + pad(mes) + "-" + pad(d);
    const fila = el("tr", { className: fecha === D.hoy ? "hoy" : "" }, el("td", { textContent: "Día " + d }));
    for (const k of campos) {
      const inp = el("input", { type: "number", min: 0, value: D.kpis[fecha]?.[k.clave] ?? "", onchange: async (e) => {
        (D.kpis[fecha] ??= {})[k.clave] = e.target.value === "" ? undefined : num(e.target.value);
        await api("kpi", "POST", { fecha, campo: k.clave, valor: e.target.value }); aviso("Guardado"); pintarTotales();
      } });
      fila.append(el("td", {}, inp));
    }
    tabla.append(fila);
  }
  const filaTotal = el("tr", { className: "total" });
  const objetivoClave = "objetivo:" + anio + "-" + pad(mes) + ":outbound";
  const filaGoal = el("tr", { className: "total" }, el("td", { textContent: "GOAL" }),
    el("td", {}, el("input", { type: "number", min: 0, value: D.notas[objetivoClave] || "", placeholder: "Objetivo", onchange: async (e) => { D.notas[objetivoClave] = e.target.value; await api("nota", "POST", { clave: objetivoClave, texto: e.target.value }); aviso("Guardado"); pintarTotales(); } })),
    el("td", { colSpan: campos.length - 1, id: "progreso" }));
  tabla.append(filaTotal, filaGoal);
  function pintarTotales() {
    filaTotal.replaceChildren(el("td", { textContent: "TOTAL" }), ...campos.map((k) => el("td", { textContent: totalMes(anio, mes, k.clave) })));
    const obj = num(D.notas[objetivoClave]);
    document.getElementById("progreso").textContent = obj ? Math.round((totalMes(anio, mes, "outbound") / obj) * 100) + " % del objetivo de outbound" : "";
    pintarResumenes();
  }
  c.append(el("div", { className: "tabla" }, tabla));
  c.append(el("h2", { textContent: "Notas del mes" }), el("label", { textContent: "Escribir próxima semana:" }), campoNota("escribir:" + anio + "-" + pad(mes), ""), el("label", { textContent: "Comprobar agendada:" }), campoNota("comprobar:" + anio + "-" + pad(mes), ""));
  const res = el("div"); c.append(res);
  function pintarResumenes() {
    res.replaceChildren();
    const t = Math.floor((mes - 1) / 3) + 1, mesesT = [3 * t - 2, 3 * t - 1, 3 * t];
    const suma = (meses, campo) => meses.reduce((s, m) => s + totalMes(anio, m, campo), 0);
    const bloque = (titulo, meses, notaClave, notaTitulo) => {
      const agIn = suma(meses, "agendadas_inbound"), agOut = suma(meses, "agendadas_outbound"), inb = suma(meses, "inbound"), out = suma(meses, "outbound"), cer = suma(meses, "cerradas");
      const pct = (a, b) => (b ? Math.round((a / b) * 100) + " %" : "—");
      res.append(el("h2", { textContent: titulo }), el("div", { className: "resumen" },
        ...[["Outbound", out], ["Inbound", inb], ["Lead magnet", suma(meses, "lead_magnet")], ["Agendadas", agIn + agOut + " (" + agOut + " out · " + agIn + " in)"], ["Cerradas", cer], ["Agendadas / inbound", pct(agIn, inb)], ["Cerradas / agendadas", pct(cer, agIn + agOut)]]
          .map(([n, v]) => el("div", {}, el("b", { textContent: v }), el("span", { textContent: n })))),
        el("label", { textContent: notaTitulo }), campoNota(notaClave, ""));
    };
    bloque(t + "º trimestre " + anio, mesesT, "obs_trimestre:" + anio + "-T" + t, "Resumen y observaciones del trimestre:");
    bloque("Año " + anio, [1,2,3,4,5,6,7,8,9,10,11,12], "obs_anual:" + anio, "Resumen y observaciones del año:");
  }
  pintarTotales();
}

// ---------- Celdas editables de filas ----------
function celda(fila, col, alGuardar) {
  const guardar = async (valor) => { fila[col.clave] = valor; const r = await api("fila/" + fila.id, "POST", { cambios: { [col.clave]: valor } }); Object.assign(fila, r); aviso("Guardado"); alGuardar?.(r, col); };
  const v = fila[col.clave] ?? "";
  if (col.tipo === "si_no") return el("input", { type: "checkbox", checked: SI(v), onchange: (e) => guardar(e.target.checked ? 1 : 0) });
  if (col.tipo === "fecha") return el("input", { type: "date", value: v, onchange: (e) => guardar(e.target.value) });
  if (col.tipo === "numero") return el("input", { type: "number", min: 0, value: v, onchange: (e) => guardar(e.target.value === "" ? "" : num(e.target.value)) });
  if (col.tipo === "largo") return el("textarea", { value: v, rows: 1, onchange: (e) => guardar(e.target.value) });
  if (col.tipo === "lista") {
    const s = el("select", { onchange: (e) => guardar(e.target.value) }, el("option", { value: "", textContent: "—" }));
    const ops = D.opciones.LISTAS[col.lista || col.clave] || [];
    for (const o of ops.includes(v) || !v ? ops : [...ops, v]) s.append(el("option", { value: o, textContent: o, selected: o === v }));
    return s;
  }
  const inp = el("input", { type: "text", value: v, onchange: (e) => guardar(e.target.value) });
  if (col.tipo === "sugerencias") { inp.setAttribute("list", "lista-" + (col.lista || col.clave)); }
  return inp;
}
function listasSugerencias() {
  return Object.entries(D.opciones.LISTAS).map(([k, ops]) => el("datalist", { id: "lista-" + k }, ...ops.map((o) => el("option", { value: o }))));
}
async function nuevaFila(tabla, periodo, datos = {}) { const f = await api("fila", "POST", { tabla, periodo, datos }); D.filas.push(f); pintar(); }
async function borrarFila(f) { if (!confirm("¿Borrar esta fila?")) return; await api("fila/" + f.id, "DELETE"); D.filas = D.filas.filter((x) => x.id !== f.id); aviso("Borrada"); await cargar(); }

function tablaFilas(filas, columnas, { conAsistente = false, alGuardar } = {}) {
  const t = el("table");
  t.append(el("tr", {}, ...columnas.map((c) => el("th", { textContent: c.nombre, title: c.ayuda || "" })), el("th")));
  for (const f of filas) {
    const tr = el("tr", { className: f.origen === "asistente" ? "asistente" : "" });
    columnas.forEach((col, i) => {
      const td = el("td", {}, celda(f, col, alGuardar));
      if (i === 0 && conAsistente && f.origen === "asistente") td.append(el("div", { className: "suave" }, "🤖 " + D.asistente + " · ", f.convId ? el("a", { href: "/panel/c/" + encodeURIComponent(f.convId), textContent: "ver conversación" }) : ""));
      tr.append(td);
    });
    tr.append(el("td", {}, el("button", { className: "borrar", title: "Borrar fila", textContent: "🗑", onclick: () => borrarFila(f) })));
    t.append(tr);
  }
  if (!filas.length) t.append(el("tr", {}, el("td", { colSpan: columnas.length + 1, className: "suave", textContent: "Vacío" })));
  return el("div", { className: "tabla" }, t);
}

// ---------- Entrevistas ----------
function pintarEntrevistas(c) {
  const periodo = D.anio + "-" + pad(estado.mes);
  const filas = D.filas.filter((f) => f.tabla === "entrevista" && f.periodo === periodo);
  c.append(...listasSugerencias());
  c.append(el("div", { className: "barra" }, "Mes ", selectorMes(pintar), el("button", { textContent: "+ Añadir persona", onclick: () => nuevaFila("entrevista", periodo) }),
    el("span", { className: "suave", textContent: " Cuando " + D.asistente + " agenda una llamada, añade aquí a la persona (🤖) con lo que sabe de ella. Al poner la fecha de la entrevista, la fila pasa a ese mes. Marcar «Entra» suma una cerrada en Conversaciones." })));
  c.append(tablaFilas(filas, D.opciones.COLUMNAS_ENTREVISTA, { conAsistente: true, alGuardar: (r, col) => { if (r.periodo !== periodo || ["entra", "presentado", "enviado", "contesta"].includes(col.clave)) cargar(); } }));
  const n = filas.length, pres = filas.filter((f) => SI(f.presentado)).length, entran = filas.filter((f) => SI(f.entra)).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + " %" : "—");
  c.append(el("div", { className: "resumen" }, ...[["Entrevistas", n], ["Presentados", pres + " (" + pct(pres, n) + ")"], ["Entran", entran], ["Cierre sobre presentados", pct(entran, pres)], ["Mensajes enviados", filas.filter((f) => SI(f.enviado)).length], ["Contestan", filas.filter((f) => SI(f.contesta)).length]]
    .map(([t, v]) => el("div", {}, el("b", { textContent: v }), el("span", { textContent: t })))));
  c.append(el("label", { textContent: "Observaciones del mes:" }), campoNota("obs_entrevistas:" + periodo, ""));
}

// ---------- Ventas ----------
function pintarVentas(c) {
  c.append(...listasSugerencias());
  for (let m = 1; m <= 12; m++) {
    const periodo = D.anio + "-" + pad(m);
    const filas = D.filas.filter((f) => f.tabla === "venta" && f.periodo === periodo);
    c.append(el("h2", {}, MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + " " + D.anio + " ", el("button", { textContent: "+ Añadir venta", onclick: () => nuevaFila("venta", periodo) })));
    if (filas.length) c.append(tablaFilas(filas, D.opciones.COLUMNAS_VENTA));
  }
}

// ---------- Lead magnets ----------
function pintarLeadMagnets(c) {
  const cols = D.opciones.COLUMNAS_LEAD_MAGNET;
  const conAuto = (f) => {
    const a = D.autoLeadMagnet[f.id];
    return a ? { ...f, ...a } : f;
  };
  c.append(el("p", { className: "suave", textContent: "Si rellenas «Recurso en ManyChat» con el mismo texto del disparador, " + D.asistente + " cuenta solo las solicitudes, respuestas y agendadas (casillas verdes)." }));
  const bloque = (titulo, tabla, periodo) => {
    const filas = D.filas.filter((f) => f.tabla === tabla && f.periodo === periodo);
    c.append(el("h2", {}, titulo + " ", el("button", { textContent: "+ Añadir", onclick: () => nuevaFila(tabla, periodo) })));
    const envoltorio = tablaFilas(filas.map(conAuto), cols, { alGuardar: () => cargar() });
    // Las columnas automáticas con recurso puesto: verdes y de solo lectura
    filas.forEach((f, i) => {
      if (!D.autoLeadMagnet[f.id]) return;
      const tr = envoltorio.querySelectorAll("tr")[i + 1];
      cols.forEach((col, j) => { if (col.auto) { const td = tr.children[j]; td.className = "auto"; td.replaceChildren(el("span", { textContent: D.autoLeadMagnet[f.id][col.clave] })); } });
    });
    const tot = (clave) => filas.map(conAuto).reduce((s, f) => s + num(f[clave]), 0);
    if (filas.length) envoltorio.querySelector("table").append(el("tr", { className: "total" }, el("td", { textContent: "Totales" }), el("td"), el("td"), ...["solicitudes", "respuestas", "agendadas", "cerradas"].map((k) => el("td", { textContent: tot(k) })), el("td"), el("td")));
    c.append(envoltorio);
  };
  for (let t = 1; t <= 4; t++) bloque(t + "º trimestre " + D.anio, "lead_magnet", D.anio + "-T" + t);
  bloque("Feedback " + D.anio, "feedback", D.anio);
}

// ---------- Leads (tablero por etapas y «dónde se paran») ----------
const LD = { via: leer("crm_leads_via") || "todas", buscar: "", foco: null, abiertas: {} };
const NOMBRE_VIA = { bienvenida: "Bienvenida", lead_magnet: "Lead magnet", inbound: "Inbound" };
const QUIEN = { lead: "Lead", bot: "", dueno: "Tú" };
// Resumen: pulsar una métrica abre debajo la lista de personas que hay detrás (según las conversaciones del periodo)
const QUIEN_METRICA = {
  respuesta: { vias: ["bienvenida"], desde: "respondieron", texto: "Contestaron a la bienvenida" },
  conversaciones: { vias: ["bienvenida"], desde: "conversaciones", texto: "Siguieron hablando (vía bienvenida)" },
  citas: { vias: ["bienvenida"], desde: "agendadas", texto: "Agendaron llamada (vía bienvenida)" },
  citasInbound: { vias: ["inbound", "lead_magnet"], desde: "agendadas", texto: "Agendaron llamada (te escribieron o palabra clave)" },
  asistencia: { vias: null, desde: "presentados", texto: "Se presentaron a la llamada" },
  cierre: { vias: null, desde: "clientes", texto: "Son clientes" },
};
const LEADS_CACHE = { clave: "", datos: null };
async function leadsDelPeriodo() {
  const k = R.desde + "|" + R.hasta;
  if (LEADS_CACHE.clave !== k) { LEADS_CACHE.datos = await api("leads?desde=" + R.desde + "&hasta=" + R.hasta); LEADS_CACHE.clave = k; }
  return LEADS_CACHE.datos;
}
async function verQuienEsta(q) {
  const caja = document.getElementById("quien"); if (!caja) return;
  if (caja.dataset.abierta === q.texto) { caja.replaceChildren(); caja.dataset.abierta = ""; return; }
  caja.dataset.abierta = q.texto;
  caja.replaceChildren(el("div", { className: "caja" }, el("p", { className: "suave", textContent: "Cargando…" })));
  try {
    const L = await leadsDelPeriodo(), orden = L.etapas.map((e) => e.clave).filter((c) => c !== "descartados");
    const min = orden.indexOf(q.desde), nombreEtapa = Object.fromEntries(L.etapas.map((e) => [e.clave, e.nombre]));
    const suyos = L.leads.filter((l) => (!q.vias || q.vias.includes(l.via)) && orden.indexOf(l.etapa) >= min);
    suyos.sort((a, b) => orden.indexOf(b.etapa) - orden.indexOf(a.etapa)); // primero los que más avanzaron
    const ficha = (l) => el("a", { href: "/panel/c/" + encodeURIComponent(l.convId), title: NOMBRE_VIA[l.via] + (l.situacion ? " · " + l.situacion : "") },
      el("b", { textContent: l.nombre }), el("span", { className: "suave", textContent: (l.igUsuario ? " @" + l.igUsuario : "") + " · " + nombreEtapa[l.etapa] }));
    const lista = el("div", { className: "quien-lista" }, ...suyos.slice(0, 40).map(ficha));
    if (suyos.length > 40) lista.append(el("button", { className: "boton", textContent: "Ver " + (suyos.length - 40) + " más", onclick: (e) => e.target.replaceWith(...suyos.slice(40).map(ficha)) }));
    caja.replaceChildren(el("div", { className: "caja" },
      el("h2", {}, q.texto + " (" + suyos.length + ") ", el("button", { className: "boton", textContent: "Cerrar", onclick: () => { caja.replaceChildren(); caja.dataset.abierta = ""; } })),
      suyos.length ? lista : el("p", { className: "suave", textContent: "Nadie en este periodo (o se apuntó a mano en Datos sin conversación)." })));
    caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch { caja.replaceChildren(el("p", { className: "suave", textContent: "No se ha podido cargar la lista." })); }
}
function verDondeSeParan(clave, via) { LD.foco = clave; LD.via = via || "bienvenida"; estado.pestana = "leads"; guardarLocal("crm_pestana", "leads"); pintar(); window.scrollTo(0, 0); }
function fichaLead(l, completa) {
  const parado = l.ultimo.rol === "bot" && l.diasSinActividad >= 2 && !["clientes", "descartados"].includes(l.etapa);
  const cuando = l.diasSinActividad === null ? "" : l.diasSinActividad === 0 ? "activo hoy" : "hace " + l.diasSinActividad + (l.diasSinActividad === 1 ? " día" : " días");
  // En el tablero, tarjeta pequeña (nombre, @ y última actividad); el resto, al pasar el ratón
  if (!completa) return el("a", { className: "ficha-lead", href: "/panel/c/" + encodeURIComponent(l.convId),
      title: [NOMBRE_VIA[l.via] + " · " + l.mensajesLead + (l.mensajesLead === 1 ? " mensaje" : " mensajes") + (l.nivel ? " · nivel " + l.nivel : ""), l.situacion, l.ultimo.texto ? ((QUIEN[l.ultimo.rol] ?? "") || D.asistente) + ": " + l.ultimo.texto : ""].filter(Boolean).join("\\n") },
    el("b", { textContent: l.nombre }),
    el("div", { className: parado ? "parado" : "meta", textContent: (l.igUsuario ? "@" + l.igUsuario + " · " : "") + (parado ? "no contesta " + cuando : cuando) }));
  return el("a", { className: "ficha-lead", href: "/panel/c/" + encodeURIComponent(l.convId) },
    el("b", { textContent: l.nombre }),
    el("div", { className: "meta", textContent: (l.igUsuario ? "@" + l.igUsuario + " · " : "") + NOMBRE_VIA[l.via] + " · " + l.mensajesLead + (l.mensajesLead === 1 ? " mensaje" : " mensajes") + (l.nivel ? " · nivel " + l.nivel : "") }),
    l.situacion ? el("div", { className: "meta", textContent: l.situacion }) : null,
    l.ultimo.texto ? el("div", { className: "ult", textContent: ((QUIEN[l.ultimo.rol] ?? "") || D.asistente) + ": " + l.ultimo.texto }) : null,
    parado ? el("div", { className: "parado", textContent: "No contesta desde hace " + l.diasSinActividad + " días" }) : l.diasSinActividad !== null ? el("div", { className: "meta", textContent: l.diasSinActividad === 0 ? "Activo hoy" : "Última actividad hace " + l.diasSinActividad + (l.diasSinActividad === 1 ? " día" : " días") }) : null);
}
function pintarLeads(c) {
  const cuerpo = el("div", {}, el("p", { className: "suave", textContent: "Cargando…" }));
  c.append(barraPeriodo(pintar), cuerpo);
  api("leads?desde=" + R.desde + "&hasta=" + R.hasta).then((L) => {
    const texto = LD.buscar.trim().toLowerCase();
    const visibles = L.leads.filter((l) => (LD.via === "todas" || l.via === LD.via) && (!texto || (l.nombre + " " + l.igUsuario + " " + l.situacion).toLowerCase().includes(texto)));
    const buscar = el("input", { type: "search", placeholder: "Buscar nombre o @usuario", value: LD.buscar });
    buscar.oninput = () => { LD.buscar = buscar.value; clearTimeout(buscar.t); buscar.t = setTimeout(() => { pintar(); const b = document.querySelector(".chips input"); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 300); };
    const chips = el("div", { className: "chips" }, ...[["todas", "Todas las vías"], ["bienvenida", "Bienvenida"], ["lead_magnet", "Lead magnet"], ["inbound", "Inbound"]]
      .map(([v, n]) => el("button", { textContent: n, className: LD.via === v ? "activa" : "", onclick: () => { LD.via = v; guardarLocal("crm_leads_via", v); pintar(); } })), buscar);
    const columna = (e, todas) => {
      const suyos = visibles.filter((l) => l.etapa === e.clave), max = todas || LD.abiertas[e.clave] ? Infinity : 8;
      return el("div", { className: "columna" + (LD.foco === e.clave ? " foco" : "") },
        el("h3", {}, el("span", { textContent: e.nombre }), el("span", { textContent: suyos.length })),
        ...suyos.slice(0, max).map((l) => fichaLead(l)),
        suyos.length > max ? el("button", { className: "boton", textContent: "Ver " + (suyos.length - max) + " más", onclick: () => { LD.abiertas[e.clave] = true; pintar(); } }) : null,
        suyos.length ? null : el("div", { className: "vacio", textContent: "Nadie" }));
    };
    const partes = [chips];
    if (LD.foco) {
      const e = L.etapas.find((x) => x.clave === LD.foco) || L.etapas[0], suyos = visibles.filter((l) => l.etapa === e.clave);
      partes.push(el("div", { className: "caja" },
        el("h2", {}, "Se pararon en «" + e.nombre + "» (" + suyos.length + ") ", el("button", { className: "boton", textContent: "Ver el tablero completo", onclick: () => { LD.foco = null; pintar(); } })),
        el("p", { className: "suave", textContent: "Personas que llegaron a este paso y no avanzaron más. Abre sus conversaciones para ver en qué mensaje se quedaron: es la pista para mejorar lo que dice " + D.asistente + "." }),
        suyos.length ? el("div", { className: "lista-foco" }, ...suyos.map((l) => fichaLead(l, true))) : el("div", { className: "vacio", textContent: "Nadie se ha parado aquí en este periodo." })));
    } else {
      partes.push(el("p", { className: "suave", textContent: visibles.length + " personas que contestaron en el periodo, cada una en la etapa más avanzada a la que ha llegado. Pulsa una para abrir su conversación. Las etapas de la llamada salen de Entrevistas." }),
        el("div", { className: "tablero" }, ...L.etapas.map((e) => columna(e))));
    }
    cuerpo.replaceChildren(...partes);
  }).catch(() => { cuerpo.textContent = "No se han podido cargar los leads."; });
}

// ---------- Te toca a ti ----------
function pintarPendientes(c) {
  const cuerpo = el("div", {}, el("p", { className: "suave", textContent: "Cargando…" }));
  c.append(el("p", { className: "suave", textContent: "Lo que depende de ti para no perder citas. Cada cosa desaparece de aquí en cuanto la resuelves." }), cuerpo);
  const recargar = async () => { try { PEND.total = (await api("pendientes")).total; } catch {} pintar(); };
  const cambiar = async (id, cambios, texto) => { await api("fila/" + id, "POST", { cambios }); aviso(texto || "Guardado"); recargar(); };
  const enlaceConv = (convId) => convId ? el("a", { className: "boton", href: "/panel/c/" + encodeURIComponent(convId), textContent: "Ver conversación" }) : null;
  // Lo de hace más de 30 días se agrupa plegado, para que lo reciente no quede enterrado
  const antiguo = (x) => (x.dias ?? 0) > 30 || (x.fecha_entrevista && (Date.parse(D.hoy) - Date.parse(x.fecha_entrevista)) / 864e5 > 30);
  const seccion = (titulo, ayuda, items, pintarItem, vacio) => {
    const recientes = items.filter((x) => !antiguo(x)), viejos = items.filter(antiguo);
    return el("div", { className: "caja" }, el("h2", { textContent: titulo + " (" + items.length + ")" }), el("p", { className: "suave", textContent: ayuda }),
      items.length ? el("div", { className: "pend" }, ...recientes.map(pintarItem)) : el("div", { className: "vacio", textContent: "✓ " + vacio }),
      viejos.length ? el("details", { style: "margin-top:8px" }, el("summary", { className: "suave", textContent: "De hace más de 30 días (" + viejos.length + ")" }), el("div", { className: "pend", style: "margin-top:8px" }, ...viejos.map(pintarItem))) : null);
  };
  const fechaLarga = (dia) => dia ? Number(dia.slice(8)) + " de " + MESES[Number(dia.slice(5, 7)) - 1] : "";
  api("pendientes").then((P) => {
    PEND.total = P.total;
    const reloj = (e) => {
      if (e.quedan === null) return null;
      if (e.quedan <= 0) return el("span", { className: "reloj", textContent: "Pasaron las 24 h: Instagram ya no deja contestarle desde aquí" });
      const h = Math.floor(e.quedan), clase = e.quedan < 4 ? "urgente" : e.quedan < 12 ? "aviso" : "";
      return el("span", { className: "reloj " + clase, textContent: "Te quedan " + (h ? h + " h" : Math.round(e.quedan * 60) + " min") + " para contestar" });
    };
    cuerpo.replaceChildren(
      seccion("Esperan que les escribas tú", "Personas a las que " + D.asistente + " ha dejado de contestar para que sigas tú, y cuyo último mensaje está sin responder. Instagram solo deja contestar durante 24 horas desde su último mensaje.", P.esperan, (e) =>
        el("div", { className: "item " + (e.quedan !== null && e.quedan <= 0 ? "caducado" : e.quedan !== null && e.quedan < 4 ? "urgente" : e.quedan !== null && e.quedan < 12 ? "aviso" : "") },
          el("div", {}, el("div", { className: "quien", textContent: e.nombre + (e.igUsuario ? " @" + e.igUsuario : "") }), el("div", { className: "que", textContent: e.que }), e.ultimo ? el("div", { className: "cita", textContent: "«" + e.ultimo + "»" }) : null, reloj(e)),
          el("div", { className: "acciones" }, enlaceConv(e.convId))), "Nadie está esperando respuesta tuya."),
      seccion("Llamadas propuestas sin fecha", D.asistente + " les propuso la llamada pero todavía no tienen día. Cuando acuerdes la fecha, ponla aquí y contará como agendada.", P.sinFecha, (f) => {
        const fecha = el("input", { type: "date" });
        return el("div", { className: "item" + (f.dias >= 3 ? " aviso" : "") },
          el("div", {}, el("div", { className: "quien", textContent: f.nombre }), el("div", { className: "que", textContent: (f.procedencia ? f.procedencia + " · " : "") + (f.dias === null ? "" : f.dias === 0 ? "propuesta hoy" : "propuesta hace " + f.dias + (f.dias === 1 ? " día" : " días")) }), f.que_dice ? el("div", { className: "cita", textContent: f.que_dice }) : null),
          el("div", { className: "acciones" }, fecha, el("button", { className: "si", textContent: "Agendar", onclick: () => fecha.value ? cambiar(f.id, { fecha_entrevista: fecha.value }, "Agendada") : aviso("Elige la fecha primero", true) }),
            el("button", { textContent: "Más adelante", title: "Estado «Hablar en un futuro»", onclick: () => cambiar(f.id, { estado: "Hablar en un futuro" }) }),
            el("button", { className: "no", textContent: "Descartar", title: "Estado «No hablar»", onclick: () => cambiar(f.id, { estado: "No hablar" }) }), enlaceConv(f.convId)));
      }, "Todas las llamadas propuestas tienen fecha."),
      seccion("¿Se presentaron?", "Llamadas cuya fecha ya ha pasado. Marca si la persona se presentó: así salen bien el % de aparición y el de cierre.", P.sinMarcar, (f) =>
        el("div", { className: "item" }, el("div", {}, el("div", { className: "quien", textContent: f.nombre }), el("div", { className: "que", textContent: "Llamada del " + fechaLarga(f.fecha_entrevista) })),
          el("div", { className: "acciones" }, el("button", { className: "si", textContent: "Se presentó", onclick: () => cambiar(f.id, { presentado: 1 }) }), el("button", { className: "no", textContent: "No se presentó", onclick: () => cambiar(f.id, { no_presentado: 1 }) }), enlaceConv(f.convId))), "No hay llamadas pasadas sin marcar."),
      seccion("¿Entran?", "Personas que hicieron la llamada y aún no has marcado si entran en el programa.", P.sinDecidir, (f) =>
        el("div", { className: "item" }, el("div", {}, el("div", { className: "quien", textContent: f.nombre }), el("div", { className: "que", textContent: "Llamada del " + fechaLarga(f.fecha_entrevista) })),
          el("div", { className: "acciones" }, el("button", { className: "si", textContent: "Entra", onclick: () => cambiar(f.id, { entra: 1 }, "¡Cerrada!") }), el("button", { className: "no", textContent: "No entra", onclick: () => cambiar(f.id, { no_entra: 1 }) }), enlaceConv(f.convId))), "No hay llamadas pendientes de decisión."));
  }).catch(() => { cuerpo.textContent = "No se ha podido cargar la lista."; });
}

// ---------- Registro diario (como el CRM de la academia) ----------
const RG = { via: leer("crm_via") || "general", lat: leer("crm_lateral") || "mensual", mes: null, datos: null };
const VIAS_REG = [["general", "General"], ["bienvenida", "Bienvenida"], ["lead_magnet", "Lead Magnet"], ["inbound", "Inbound"]];
const AYUDA_VIA = {
  general: "Totales de todas las vías. Se rellena solo con lo que hace " + "{a}" + " y con las bienvenidas que apuntas.",
  bienvenida: "Conversac. = bienvenidas enviadas. % resp. = cuántas contestaron. +2 contactos = escribieron {m} mensajes o más.",
  lead_magnet: "Conversac. = personas que pidieron un recurso por ManyChat (palabra clave).",
  inbound: "Conversac. = personas que te escribieron primero. Aquí no hay % de respuesta porque ya empiezan ellas.",
};
const pct = (v) => (v === null || v === undefined ? "—" : fmt(v, 1) + "%");
async function cargarRegistro() { RG.datos = await api("registro?mes=" + RG.mes); }
function pintarRegistro(c) {
  if (!RG.mes) RG.mes = (D && D.hoy ? D.hoy : diaLocal(new Date())).slice(0, 7);
  const cuerpo = el("div", {}, el("p", { className: "suave", textContent: "Cargando…" }));
  if (PEND.total) c.append(el("div", { className: "caja", style: "border-left:4px solid var(--amarillo)" }, el("b", { textContent: "Tienes " + PEND.total + (PEND.total === 1 ? " cosa pendiente" : " cosas pendientes") + " para no perder citas. " }),
    el("a", { href: "#", textContent: "Ver «Te toca a ti» →", onclick: (e) => { e.preventDefault(); estado.pestana = "pendientes"; guardarLocal("crm_pestana", "pendientes"); pintar(); } })));
  c.append(cajaBienvenidas(pintar), cuerpo);
  cargarRegistro().then(() => {
    const R2 = RG.datos, [a, m] = RG.mes.split("-").map(Number);
    const nombreMes = MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + " " + a;
    const cambiarMes = (d) => { const f = new Date(a, m - 1 + d, 1); RG.mes = f.getFullYear() + "-" + pad(f.getMonth() + 1); pintar(); };
    const sub = el("div", { className: "subpestanas" }, ...VIAS_REG.map(([v, nombre]) => el("button", { textContent: nombre, className: RG.via === v ? "activa" : "", onclick: () => { RG.via = v; guardarLocal("crm_via", v); pintar(); } })));
    const t = el("table", { className: "diario" });
    t.append(el("tr", {}, ...["Día", "Conversac.", "% resp.", "+2 contactos", "Propuestas", "Agendadas"].map((x) => el("th", { textContent: x }))));
    const filaT = (etiqueta, f, clase) => el("tr", { className: clase || "" }, el("td", { textContent: etiqueta }), el("td", { textContent: fmt(f.conversaciones, 0) }), el("td", { textContent: RG.via === "inbound" ? "—" : pct(f.respuesta) }), el("td", { textContent: fmt(f.contactos, 0) }), el("td", { textContent: fmt(f.propuestas, 0) }), el("td", { textContent: fmt(f.agendadas, 0) }));
    const mesDia = window.innerWidth < 600 ? MESES[m - 1].slice(0, 3) : MESES[m - 1];
    for (const d of R2.dias) t.append(filaT(Number(d.dia.slice(8)) + "-" + mesDia, d[RG.via], d.dia === R2.hoy ? "hoy" : ""));
    if (!R2.dias.length) t.append(el("tr", {}, el("td", { colSpan: 6, className: "suave", textContent: "Todavía no hay datos este mes." })));
    t.append(filaT(window.innerWidth < 600 ? "Total" : "Total " + nombreMes, R2.total[RG.via], "total"));
    const principal = el("div", { className: "caja" }, sub,
      el("div", { className: "navmes" }, el("button", { textContent: "‹", title: "Mes anterior", onclick: () => cambiarMes(-1) }), el("b", { textContent: nombreMes }), el("button", { textContent: "›", title: "Mes siguiente", onclick: () => cambiarMes(1) })),
      el("h2", { textContent: nombreMes }), el("p", { className: "suave", textContent: AYUDA_VIA[RG.via].replace("{a}", D.asistente).replace("{m}", R2.mensajesConversacion) + " Propuestas: " + D.asistente + " propone la llamada y te pasa la conversación. Agendadas: el día en que pones la fecha de la entrevista en Entrevistas." }),
      el("div", { className: "tabla" }, t));
    const L = R2.lateral[RG.lat], A = L.anterior || null;
    const nombreAnt = A ? (A.mes ? MESES[Number(A.mes.slice(5, 7)) - 1] : A.nombre) : "";
    // Flecha frente al periodo anterior: ↑ verde si sube, ↓ roja si baja (en % la diferencia es en puntos)
    const flecha = (ahora, antes, esPct) => {
      if (!A || ahora === null || ahora === undefined || antes === null || antes === undefined) return null;
      const d = Math.round((ahora - antes) * 10) / 10;
      if (!d) return el("small", { className: "comp", textContent: "= " + nombreAnt, title: "Igual que " + nombreAnt });
      return el("small", { className: "comp " + (d > 0 ? "sube" : "baja"), textContent: (d > 0 ? "↑ " : "↓ ") + fmt(Math.abs(d), 1) + (esPct ? " pts" : ""), title: "Frente a " + nombreAnt + ": " + (esPct ? pct(antes) : fmt(antes, 0)) });
    };
    const linea = (n, v, fuerte, comp) => el("div", { className: "linea" + (fuerte ? " fuerte" : "") }, el("span", { textContent: n }), el("span", {}, comp, fuerte ? el("b", { textContent: v }) : el("span", { textContent: v })));
    const bloqueVia = (titulo, x, y) => el("div", { className: "bloque" }, linea(titulo, fmt(x.entradas, 0), true, flecha(x.entradas, y && y.entradas)), linea("Agendadas", fmt(x.agendadas, 0), false, flecha(x.agendadas, y && y.agendadas)), linea("Tasa de inducción", pct(x.induccion), false, flecha(x.induccion, y && y.induccion, true)));
    const lat = el("div", { className: "lateral" }, el("div", { className: "eti", textContent: "Métricas" }),
      el("div", { className: "segmentado" }, ...[["mensual", "Mensual"], ["trimestral", "Trimestral"], ["anual", "Anual"]].map(([k, n]) => el("button", { textContent: n, className: RG.lat === k ? "activa" : "", onclick: () => { RG.lat = k; guardarLocal("crm_lateral", k); pintar(); } }))),
      el("h3", { textContent: L.nombre || nombreMes }),
      A ? el("p", { className: "suave", style: "text-align:center;margin:-4px 0 6px", textContent: "Flechas: frente a " + (A.parcial ? (A.mes ? "los días 1-" + Number(A.hasta.slice(8)) + " de " : "el mismo tramo de ") : "") + nombreAnt }) : null,
      bloqueVia("Outbound", L.outbound, A && A.outbound), bloqueVia("Inbound", L.inbound, A && A.inbound), bloqueVia("Lead Magnet", L.lead_magnet, A && A.lead_magnet),
      el("div", { className: "bloque" }, linea("Realizadas + no presentadas", fmt(L.llamadas.total, 0), false, flecha(L.llamadas.total, A && A.llamadas.total)), linea("Realizadas", fmt(L.llamadas.realizadas, 0), false, flecha(L.llamadas.realizadas, A && A.llamadas.realizadas)), linea("Cerradas", fmt(L.llamadas.cerradas, 0), false, flecha(L.llamadas.cerradas, A && A.llamadas.cerradas)), linea("% de cierre", pct(L.llamadas.cierre), false, flecha(L.llamadas.cierre, A && A.llamadas.cierre, true)), linea("% de aparición", pct(L.llamadas.aparicion), false, flecha(L.llamadas.aparicion, A && A.llamadas.aparicion, true))),
      el("p", { className: "suave", textContent: "Tasa de inducción = agendadas ÷ conversaciones. Las llamadas salen de Entrevistas (fecha, «Presentado» y «Entra»)." }));
    cuerpo.replaceChildren(el("div", { className: "reg" }, principal, lat));
  }).catch(() => { cuerpo.textContent = "No se ha podido cargar el registro."; });
}

// ---------- Resumen y Embudo (semáforos, gráfico semanal y embudo de bienvenida a cliente) ----------
const R = { periodo: leer("crm_periodo") || "30", desde: "", hasta: "", datos: null };
// Si la última vez elegiste fechas a mano, se recuperan
if (R.periodo === "libre") { const [a, b] = (leer("crm_libre") || "").split("|"); if (a && b) { R.desde = a; R.hasta = b; } else R.periodo = "30"; }
const fmt = (v, dec) => v === null || v === undefined ? "—" : Number(v).toLocaleString("es-ES", { maximumFractionDigits: dec ?? 1 });
const diaLocal = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const fechaCorta = (dia) => Number(dia.slice(8)) + " " + MESES[Number(dia.slice(5, 7)) - 1].slice(0, 3);
function rangoPeriodo(clave, hoy) {
  const h = new Date(hoy + "T12:00:00");
  const menos = (dias) => { const d = new Date(h); d.setDate(d.getDate() - dias); return diaLocal(d); };
  if (clave === "semana") return [menos((h.getDay() + 6) % 7), hoy];
  if (clave === "mes") return [hoy.slice(0, 8) + "01", hoy];
  if (clave === "mes_pasado") { const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1), fin = new Date(h.getFullYear(), h.getMonth(), 0); return [diaLocal(ini), diaLocal(fin)]; }
  if (clave === "90") return [menos(89), hoy];
  if (clave === "libre" && R.desde && R.hasta) return [R.desde, R.hasta];
  return [menos(29), hoy];
}
async function cargarResumen(c) {
  const desde = R.desde, hasta = R.hasta;
  c.replaceChildren(el("p", { className: "suave", textContent: "Calculando…" }));
  R.datos = await api("resumen?desde=" + desde + "&hasta=" + hasta);
}
function barraPeriodo(alCambiar) {
  [R.desde, R.hasta] = rangoPeriodo(R.periodo, (D && D.hoy) || diaLocal(new Date()));
  const b = el("div", { className: "periodo" });
  for (const [clave, nombre] of [["semana", "Esta semana"], ["mes", "Este mes"], ["30", "Últimos 30 días"], ["mes_pasado", "Mes pasado"], ["90", "Últimos 90 días"]])
    b.append(el("button", { textContent: nombre, className: R.periodo === clave ? "activa" : "", onclick: () => { R.periodo = clave; guardarLocal("crm_periodo", clave); alCambiar(); } }));
  const d = el("input", { type: "date", value: R.desde }), h = el("input", { type: "date", value: R.hasta });
  const libre = () => { if (d.value && h.value) { R.periodo = "libre"; R.desde = d.value; R.hasta = h.value; guardarLocal("crm_periodo", "libre"); guardarLocal("crm_libre", d.value + "|" + h.value); alCambiar(); } };
  d.onchange = libre; h.onchange = libre;
  b.append(el("span", { className: "suave", textContent: " o del " }), d, el("span", { className: "suave", textContent: " al " }), h);
  return b;
}
const SEMAFORO = { verde: ["✓", "En la meta"], amarillo: ["●", "Cerca de la meta"], rojo: ["!", "Por debajo de la meta"], sin_datos: ["–", "Sin datos"], info: ["", ""] };
// Tarjeta: número grande, semáforo y la meta. El detalle (de dónde sale el número) aparece al pasar el ratón o al tocarla.
function tarjetaKpi(titulo, t, unidad, detalle, meta, clave) {
  const [icono, texto] = t.faltanBienvenidas ? ["!", "Faltan bienvenidas por apuntar"] : SEMAFORO[t.semaforo] || SEMAFORO.info;
  if (t.faltanBienvenidas) detalle = "Hay más respuestas (" + t.a + ") que bienvenidas apuntadas (" + t.b + "), así que el porcentaje no es real. Suma las bienvenidas que faltan con «+ Sumar» en el Registro. " + detalle;
  const quien = clave && QUIEN_METRICA[clave];
  const tarjeta = el("div", { className: "tarjeta-kpi " + (t.faltanBienvenidas ? "aviso" : t.semaforo), title: detalle },
    el("div", { className: "titulo", textContent: titulo }),
    el("div", { className: "valor", textContent: t.valor === null ? "—" : fmt(t.valor) + unidad }),
    meta ? el("div", { className: "detalle", textContent: meta }) : null,
    texto ? el("span", { className: "pastilla " + (t.faltanBienvenidas ? "aviso" : t.semaforo) }, el("i", { textContent: icono }), texto) : null,
    el("div", { className: "detalle mas", style: "margin-top:6px", textContent: detalle }),
    quien ? el("a", { href: "#", className: "ver-quien", textContent: "Ver quién →", onclick: (e) => { e.preventDefault(); e.stopPropagation(); verQuienEsta(quien); } }) : null);
  tarjeta.onclick = () => tarjeta.classList.toggle("abierta");
  return tarjeta;
}
function bloque(numero, titulo, ...tarjetas) { return el("div", { className: "bloque" }, el("h3", {}, el("b", { textContent: numero + " · " }), titulo), ...tarjetas); }
function cajaPuntoDebil(p) {
  if (!p) return null;
  if (p.estado === "bien") return el("div", { className: "debil bien" }, el("p", { className: "frase", textContent: "✓ Vas en la meta en todos los pasos de este periodo." }), el("p", { className: "suave", textContent: "Sigue así y mira que se cumpla tu objetivo de agendas." }));
  return el("div", { className: "debil " + p.estado },
    el("p", { className: "frase", textContent: (p.estado === "rojo" ? "Tu punto débil: " : "Lo que más puedes mejorar: ") + p.nombre + " (" + fmt(p.valor) + p.unidad + ", meta " + p.meta + ")" }),
    el("p", { textContent: p.consejo }),
    p.etapa ? el("p", {}, el("a", { href: "#", textContent: "Ver quién se paró aquí →", onclick: (e) => { e.preventDefault(); verDondeSeParan(p.etapa); } })) : null);
}
function cajaBienvenidas(alGuardar) {
  const hoyKpi = (D.kpis[D.hoy] && D.kpis[D.hoy].outbound) || 0;
  const inp = el("input", { type: "number", min: 1, placeholder: "Nº" });
  const enviar = async () => {
    const n = Math.round(Number(inp.value));
    if (!n) return;
    const r = await api("bienvenidas", "POST", { cantidad: n });
    (D.kpis[D.hoy] ??= {}).outbound = r.outbound; aviso("Sumadas " + n + " bienvenidas"); alGuardar();
  };
  inp.onkeydown = (e) => { if (e.key === "Enter") enviar(); };
  return el("div", { className: "caja" }, el("div", { className: "rapido" },
    el("b", { textContent: "Bienvenidas enviadas hoy: " + hoyKpi }), el("span", { className: "suave", textContent: "Sumar " }), inp, el("button", { textContent: "+ Sumar", onclick: enviar }),
    el("span", { className: "suave", textContent: "Cuando " + D.asistente + " o Claude envíen las bienvenidas, se sumarán aquí solas. También puedes corregir cualquier día en Datos → Conversaciones (columna Outbound)." })));
}
function cajaObjetivo(o, semanal, mini) {
  const inp = el("input", { type: "number", min: 1, max: 100, value: o.objetivo || "", placeholder: "Nº", style: "width:5em" });
  const guardar = async () => { await api("nota", "POST", { clave: "objetivo_agendas_semana", texto: String(Math.max(0, Math.round(Number(inp.value) || 0)) || "") }); aviso("Objetivo guardado"); pintar(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") guardar(); };
  const pct = o.objetivo ? Math.min(100, Math.round((o.llevas / o.objetivo) * 100)) : 0;
  const color = !o.objetivo ? "var(--linea)" : o.llevas >= o.objetivo ? "var(--verde)" : "var(--amarillo)";
  if (mini) return el("div", { className: "caja objetivo-mini" },
    el("h2", { textContent: o.objetivo ? "Agendas esta semana: " + o.llevas + " de " + o.objetivo + (o.llevas >= o.objetivo ? " ✓" : "") : "Agendas esta semana: " + o.llevas }),
    o.objetivo ? el("div", { style: "background:var(--fondo,#eee);border:1px solid var(--linea);border-radius:8px;height:10px;overflow:hidden;margin:4px 0 8px" }, el("div", { style: "height:100%;width:" + pct + "%;background:" + color })) : null,
    el("div", { className: "rapido" }, el("span", { className: "suave", textContent: "Objetivo:" }), inp, el("button", { textContent: "Guardar", onclick: guardar })),
    semanal && semanal.length ? graficoAgendas(semanal, o.objetivo, true) : null);
  return el("div", { className: "caja" },
    el("h2", { textContent: o.objetivo ? "Agendas esta semana: " + o.llevas + " de " + o.objetivo + (o.llevas >= o.objetivo ? " ✓ objetivo cumplido" : "") : "Objetivo de agendas semanales" }),
    o.objetivo ? el("div", { style: "background:var(--fondo,#eee);border:1px solid var(--linea);border-radius:8px;height:14px;overflow:hidden;margin:6px 0 10px" }, el("div", { style: "height:100%;width:" + pct + "%;background:" + color })) : el("p", { className: "suave", textContent: "Es lo que de verdad tienes que perseguir. Escribe cuántas llamadas quieres agendar cada semana." }),
    el("div", { className: "rapido" }, el("span", { className: "suave", textContent: "Mi objetivo: " }), inp, el("span", { className: "suave", textContent: " agendas por semana " }), el("button", { textContent: "Guardar", onclick: guardar }),
      el("span", { className: "suave", textContent: "Cuenta las citas con fecha puesta desde el lunes " + fechaCorta(o.semana) + ", de todas las vías." })),
    semanal && semanal.length ? graficoAgendas(semanal, o.objetivo, mini) : null);
}
// Barras: citas agendadas cada semana (últimas 12), con la línea de tu objetivo. Verde si llegó al objetivo.
function graficoAgendas(semanal, objetivo, mini) {
  const W = mini ? 320 : window.innerWidth < 600 ? 380 : 720, H = mini ? 150 : 200, iz = 34, de = 16, ar = 18, ab = 30, aw = W - iz - de, ah = H - ar - ab;
  const max = Math.max(objetivo || 0, ...semanal.map((s) => s.citas), 1), tope = Math.max(4, Math.ceil((max * 1.15) / 2) * 2);
  const Y = (v) => ar + ah - (v / tope) * ah, ancho = aw / semanal.length, X = (i) => iz + i * ancho;
  const svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Citas agendadas por semana frente a tu objetivo" });
  for (let v = 0; v <= tope; v += tope / 2) {
    svg.append(svgEl("line", { x1: iz, x2: W - de, y1: Y(v), y2: Y(v), stroke: "var(--linea)", "stroke-width": 1 }));
    svg.append(svgEl("text", { x: iz - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--suave)" }, fmt(v, 0)));
  }
  const cada = mini ? 4 : W < 600 ? 3 : 2;
  semanal.forEach((s, i) => {
    const alto = Math.max(s.citas ? 2 : 0, ah - (Y(s.citas) - ar));
    const color = objetivo && s.citas >= objetivo ? "var(--verde)" : "var(--acento)";
    const barra = svgEl("rect", { x: X(i) + ancho * 0.18, y: ar + ah - alto, width: ancho * 0.64, height: alto, rx: 3, fill: color, opacity: i === semanal.length - 1 ? 0.55 : 1 });
    barra.append(svgEl("title", {}, "Semana del " + fechaCorta(s.semana) + (i === semanal.length - 1 ? " (en curso)" : "") + ": " + s.citas + " citas"));
    svg.append(barra);
    if (s.citas) svg.append(svgEl("text", { x: X(i) + ancho / 2, y: ar + ah - alto - 4, "text-anchor": "middle", "font-size": 11, fill: "var(--tinta)" }, String(s.citas)));
    if ((semanal.length - 1 - i) % cada === 0) svg.append(svgEl("text", { x: X(i) + ancho / 2, y: H - 10, "text-anchor": "middle", "font-size": 11, fill: "var(--suave)" }, fechaCorta(s.semana)));
  });
  if (objetivo) {
    svg.append(svgEl("line", { x1: iz, x2: W - de, y1: Y(objetivo), y2: Y(objetivo), stroke: "var(--verde)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    svg.append(svgEl("text", { x: W - de, y: Y(objetivo) - 5, "text-anchor": "end", "font-size": 11, fill: "var(--suave)" }, "Objetivo " + objetivo));
  }
  return el("div", { className: "grafico", style: "margin-top:" + (mini ? 6 : 12) + "px" }, el("p", { className: "suave", style: "margin:0 0 4px" + (mini ? ";font-size:.75rem" : ""), textContent: mini ? "Citas por semana (12 últimas). Verde: llegaste al objetivo." : "Citas agendadas por semana (últimas 12). La barra clara es la semana en curso; en verde, las semanas en que llegaste al objetivo." }), svg);
}
function svgEl(tag, attrs, ...hijos) { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) e.setAttribute(k, attrs[k]); for (const h of hijos) if (h != null) e.append(h); return e; }
function graficoSemanal(semanal, meta) {
  const W = window.innerWidth < 600 ? 380 : 720, H = window.innerWidth < 600 ? 220 : 240, iz = 44, de = 16, ar = 16, ab = 34, aw = W - iz - de, ah = H - ar - ab;
  const vals = semanal.map((s) => s.respuesta).filter((v) => v !== null);
  const max = Math.max(meta * 1.25, ...vals, 10), paso = Math.ceil(max / 4 / 5) * 5, tope = paso * 4;
  const X = (i) => iz + (semanal.length === 1 ? aw / 2 : (i / (semanal.length - 1)) * aw), Y = (v) => ar + ah - (v / tope) * ah;
  const svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Porcentaje de respuesta a bienvenidas por semana" });
  for (let v = 0; v <= tope; v += paso) {
    svg.append(svgEl("line", { x1: iz, x2: W - de, y1: Y(v), y2: Y(v), stroke: "var(--linea)", "stroke-width": 1 }));
    svg.append(svgEl("text", { x: iz - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--suave)" }, fmt(v, 0) + " %"));
  }
  svg.append(svgEl("line", { x1: iz, x2: W - de, y1: Y(meta), y2: Y(meta), stroke: "var(--verde)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
  svg.append(svgEl("text", { x: W - de, y: Y(meta) - 6, "text-anchor": "end", "font-size": 11, fill: "var(--suave)" }, "Meta " + meta + " %"));
  const cada = W < 600 ? 3 : 2;
  semanal.forEach((s, i) => { if ((semanal.length - 1 - i) % cada === 0) svg.append(svgEl("text", { x: X(i), y: H - 12, "text-anchor": "middle", "font-size": 11, fill: "var(--suave)" }, fechaCorta(s.semana))); });
  // Línea, cortada en las semanas sin bienvenidas apuntadas
  let d = "", dentro = false;
  semanal.forEach((s, i) => { if (s.respuesta === null) { dentro = false; return; } d += (dentro ? "L" : "M") + X(i) + " " + Y(s.respuesta); dentro = true; });
  svg.append(svgEl("path", { d, fill: "none", stroke: "var(--acento)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const caja = el("div", { className: "grafico" }, svg);
  const tip = el("div", { className: "tip", hidden: true });
  caja.append(tip);
  semanal.forEach((s, i) => {
    if (s.respuesta !== null) svg.append(svgEl("circle", { cx: X(i), cy: Y(s.respuesta), r: 4, fill: "var(--acento)", stroke: "var(--papel)", "stroke-width": 2 }));
    const zona = svgEl("rect", { x: X(i) - aw / semanal.length / 2, y: ar, width: aw / semanal.length, height: ah, fill: "transparent" });
    zona.addEventListener("mouseenter", () => {
      tip.hidden = false;
      tip.replaceChildren(el("b", { textContent: "Semana del " + fechaCorta(s.semana) + (i === semanal.length - 1 ? " (en curso)" : "") }), el("br"),
        "Respuesta: " + (s.respuesta === null ? "sin bienvenidas apuntadas" : fmt(s.respuesta) + " %"), el("br"),
        s.respondieron + " respuestas de " + s.bienvenidas + " bienvenidas", el("br"), s.citas + " citas");
      const r = caja.getBoundingClientRect(), escala = r.width / W;
      tip.style.left = Math.min(Math.max(0, X(i) * escala - 80), r.width - 180) + "px"; tip.style.top = "0px";
    });
    zona.addEventListener("mouseleave", () => { tip.hidden = true; });
    svg.append(zona);
  });
  return caja;
}
function tablaOrigen(o) {
  const t = el("table");
  t.append(el("tr", {}, el("th"), el("th", { textContent: "Outbound", title: "Personas a las que enviaste la bienvenida" }), el("th", { textContent: "Inbound", title: "Personas que te escribieron primero" }), el("th", { textContent: "Lead magnet" })));
  for (const [nombre, clave] of [["Entradas", "entradas"], ["+2 contactos", "conversaciones"], ["Cualificados", "cualificados"], ["Llamada propuesta", "propuestas"], ["Cita agendada", "citas"]])
    t.append(el("tr", {}, el("td", { textContent: nombre }), ...["outbound", "inbound", "lead_magnet"].map((v) => el("td", { textContent: fmt(o[v][clave], 0) }))));
  return el("div", { className: "tabla" }, t);
}
// Resumen al estilo del Registro: tabla de métricas con semáforo y flechas, embudo compacto y panel lateral.
function pintarResumen(c) {
  const cuerpo = el("div"); c.append(barraPeriodo(pintar), cuerpo);
  cargarResumen(cuerpo).then(() => {
    const { metricas: m, semanal, metas, mensajesConversacion } = R.datos, t = m.tarjetas;
    const ac = R.datos.activas;
    cuerpo.replaceChildren(el("div", { className: "res-compacto" },
      el("div", { className: "res-arriba" }, cajaPuntoDebil(m.puntoDebil) || el("div"), cajaBienvenidas(pintar)),
      el("div", { className: "res-medio" }, el("div", {},
      el("p", { className: "suave", style: "margin:0", textContent: "El camino de tus leads, de izquierda a derecha. Toca una tarjeta (o pasa el ratón) para ver de dónde sale el número." }),
      el("div", { className: "camino" },
        bloque(1, "Bienvenida",
          tarjetaKpi("Bienvenidas enviadas", { valor: t.respuesta.b, semaforo: "info" }, "", "Las que has apuntado en el periodo (botón «+ Sumar» o columna Outbound).", ""),
          tarjetaKpi("Respuesta a bienvenidas", t.respuesta, " %", t.respuesta.a + " respuestas de " + t.respuesta.b + " bienvenidas.", "Meta: 20 % o más", "respuesta")),
        bloque(2, "Conversación",
          tarjetaKpi("Conversaciones activas ahora", { valor: ac.total, semaforo: "info" }, "", "Te han escrito en los últimos " + ac.dias + " días y aún no tienen cita: " + ac.porVia.bienvenida + " outbound y " + (ac.porVia.inbound + ac.porVia.lead_magnet) + " inbound. No depende del periodo elegido.", "Ahora mismo"),
          tarjetaKpi("Conversaciones por cada 100 bienvenidas", t.conversaciones, "", t.conversaciones.a + " conversaciones (" + mensajesConversacion + " mensajes o más del lead).", "Meta: unas 10", "conversaciones")),
        bloque(3, "Agenda",
          tarjetaKpi("Agendas outbound", t.citas, " %", t.citas.a + " citas de " + t.citas.b + " bienvenidas (las conversaciones que inicias tú).", "Lo normal: 1-3 %", "citas"),
          tarjetaKpi("Agendas inbound", t.citasInbound, " %", t.citasInbound.a + " citas de " + t.citasInbound.b + (t.citasInbound.b === 1 ? " persona que te escribió o mandó" : " personas que te escribieron o mandaron") + " palabra clave.", "Lo normal: 30-50 %", "citasInbound")),
        bloque(4, "Llamada",
          tarjetaKpi("Llamadas que se realizan", t.asistencia, " %", t.asistencia.a + " de " + t.asistencia.b + " llamadas marcadas como «Se presentó» o «No se presentó»" + (t.asistencia.sinMarcar ? " (" + t.asistencia.sinMarcar + " sin marcar, no cuentan)" : "") + ". Si fallan más del 20 %, algo falla en cómo se agendan.", "Meta: 80 % o más", "asistencia"),
          tarjetaKpi("Llamadas que acaban en cliente", t.cierre, " %", t.cierre.a + " clientes de " + t.cierre.b + " llamadas realizadas (casillas «Presentado» y «Entra» de Entrevistas).", "Clientes / llamadas", "cierre"))),
      el("div", { id: "quien" })),
      cajaObjetivo(R.datos.objetivo, semanal, true)),
      el("div", { className: "res-abajo" },
        cajaEmbudo(),
        el("div", {}, el("div", { className: "caja" }, el("h2", { textContent: "Respuesta a bienvenidas, semana a semana" }),
          el("p", { className: "suave", textContent: "Últimas 12 semanas. Pasa el ratón por una semana para ver los números." }), graficoSemanal(semanal, metas.respuesta.meta)),
        el("div", { className: "caja" }, el("h2", { textContent: "De dónde salen tus citas" }), tablaOrigen(m.origen)))),
      el("div", { className: "resumen" },
        ...[["Citas agendadas", m.citas], ["Llamadas realizadas", m.presentados], ["Clientes", m.clientes], ["Gasto de IA", fmt(m.gastoUsd, 2) + " $"], ["Gasto de IA por cita", m.costePorCita === null ? "—" : fmt(m.costePorCita, 2) + " $"]]
          .map(([n, v]) => el("div", {}, el("b", { textContent: v }), el("span", { textContent: n })))),
      el("p", { className: "suave", textContent: "Del " + fechaCorta(m.desde) + " al " + fechaCorta(m.hasta) + ". Las respuestas se cuentan por el día en que la persona contestó. No cuentan tus cuentas de prueba." })));
  }).catch(() => { cuerpo.textContent = "No se ha podido calcular el resumen."; });
}
// Embudo por vía: Bienvenidas (outbound), Palabra clave (lead magnet), Te escriben (piden información) o Todas.
const VIAS_EMBUDO = [
  ["bienvenida", "Bienvenidas", "De la bienvenida al cliente (outbound)", "Bienvenidas enviadas", "Respondieron"],
  ["lead_magnet", "Palabra clave", "De la palabra clave al cliente", "Pidieron el recurso", "Respondieron"],
  ["inbound", "Te escriben (piden información)", "De quien te escribe al cliente", "Te escribieron", "Te escribieron"],
  ["todas", "Todas", "Todas las vías juntas", "Entradas (bienvenidas + palabra clave + te escriben)", "Respondieron o te escribieron"],
];
let viaEmbudo = VIAS_EMBUDO.some((v) => v[0] === leer("crm_embudo_via")) ? leer("crm_embudo_via") : "bienvenida";
function cajaEmbudo() {
  const caja = el("div");
  const dibujar = () => {
    const [via, , titulo, nombreEntrada, nombreRespuesta] = VIAS_EMBUDO.find((v) => v[0] === viaEmbudo);
    const NOMBRES = { bienvenidas: nombreEntrada, respondieron: nombreRespuesta, conversaciones: "+2 contactos", cualificados: "Cualificados", propuestas: "Llamada propuesta", agendadas: "Cita agendada", presentados: "Se presentaron", clientes: "Clientes" };
    let pasos = R.datos.metricas.embudos[via].map((p) => ({ ...p, nombre: NOMBRES[p.clave] }));
    if (via === "inbound") pasos = pasos.filter((p) => p.clave !== "respondieron"); // quien te escribe ya ha respondido
    const base = Math.max(1, ...pasos.map((p) => p.valor));
    const selector = el("div", { className: "periodo" }, el("span", { className: "suave", textContent: "Ver la vía: " }),
      ...VIAS_EMBUDO.map(([v, n]) => el("button", { textContent: n, className: v === via ? "activa" : "", onclick: () => { viaEmbudo = v; guardarLocal("crm_embudo_via", v); dibujar(); } })));
    const emb = el("div", { className: "embudo" });
    pasos.forEach((p, i) => {
      if (i > 0) {
        const ant = pasos[i - 1].valor;
        emb.append(el("div", { className: "caida" }, el("span"), el("span", { textContent: ant ? "↓ pasa el " + fmt((p.valor / ant) * 100, 0) + " %" : "↓" })));
      }
      emb.append(el("div", { className: "paso" + (i === pasos.length - 1 ? " final" : "") },
        el("div", { className: "nombre", textContent: p.nombre }),
        el("div", { className: "fila-barra" }, el("div", { className: "barra-emb", style: "width:" + Math.max(0.4, (p.valor / base) * 85) + "%" }), el("span", { className: "cifra", textContent: fmt(p.valor, 0) }),
          i > 0 && i < pasos.length - 1 && p.valor ? el("a", { href: "#", className: "suave", style: "font-size:.78rem", textContent: "quién se paró aquí", onclick: (e) => { e.preventDefault(); verDondeSeParan(p.clave, via); } }) : null)));
    });
    const ultimo = pasos[pasos.length - 1].valor, primero = pasos[0].valor, agendadas = (pasos.find((p) => p.clave === "agendadas") || {}).valor || 0;
    caja.replaceChildren(el("div", { className: "caja", id: "embudo" }, el("h2", { textContent: "Embudo: " + titulo.charAt(0).toLowerCase() + titulo.slice(1) }), selector,
      el("p", { className: "suave", textContent: "Cada barra es proporcional al primer paso. Donde más cae el porcentaje es donde más gente se pierde. Pulsa «quién se paró aquí» para ver esas conversaciones." }),
      primero ? el("p", { textContent: "Resultado: " + fmt(agendadas, 0) + " citas (el " + fmt((agendadas / primero) * 100) + " % del primer paso) y " + fmt(ultimo, 0) + " clientes." }) : null,
      emb,
      el("p", { className: "suave", textContent: "+2 contactos: escribieron " + R.datos.mensajesConversacion + " mensajes o más. Cualificados: " + D.asistente + " los marcó como cualificados. Llamada propuesta: " + D.asistente + " propuso la llamada y te pasó la conversación. Cita agendada: tiene fecha en Entrevistas. Se presentaron y Clientes salen de las casillas «Presentado» y «Entra»." })));
  };
  dibujar();
  return caja;
}

// ---------- Arranque ----------
const selAnio = document.getElementById("anio");
const esteAnio = new Date().getFullYear();
for (let a = esteAnio + 1; a >= 2026; a--) selAnio.append(el("option", { value: a, textContent: a, selected: a === esteAnio }));
selAnio.onchange = cargar;
cargar().catch(() => { document.getElementById("contenido").textContent = "No se han podido cargar los datos."; });
</script></body></html>`;
}
