// Página del CRM (todo en un archivo: HTML + CSS + JS sin librerías). Los datos van y vienen por /panel/crm/api/…
// Cada casilla se guarda sola al cambiarla. Los datos se pintan con textContent/value (nunca innerHTML con datos).

export function paginaCrm({ titulo }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo.replace(/[<>&"]/g, "")}</title>
<style>
:root{--fondo:#f6f6f4;--papel:#fff;--tinta:#1d1d1b;--suave:#6b6b66;--linea:#e3e3e0;--acento:#0b5cad;--auto:#eef6ee;--hoy:#fff7d6;--total:#f0f0ec}
@media (prefers-color-scheme:dark){:root{--fondo:#161615;--papel:#20201f;--tinta:#ecece8;--suave:#a3a39d;--linea:#3a3a37;--acento:#6aa8ff;--auto:#1f2e21;--hoy:#3a3420;--total:#2a2a28}}
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
</style></head><body>
<header><a href="/panel">← Panel</a><h1>CRM</h1><a href="/panel/ajustes#crm">Cambiar los desplegables</a>
<nav id="pestanas"></nav>
<span class="barra">Año <select id="anio"></select></span></header>
<main id="contenido">Cargando…</main>
<div class="estado" id="estado" hidden></div>
<script>
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
// La pestaña ["lead_magnets","Lead magnets"] está oculta por ahora; el código sigue abajo por si se recupera
const PESTANAS = [["conversaciones","Conversaciones"],["entrevistas","Entrevistas"],["ventas","Ventas"]];
let D = null; // datos del año
const estado = { pestana: PESTANAS.some((p) => p[0] === leer("crm_pestana")) ? leer("crm_pestana") : "conversaciones", mes: null };

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
  if (!estado.mes) estado.mes = Number(D.hoy.slice(5, 7));
  pintar();
}
function pintar() {
  const nav = document.getElementById("pestanas"); nav.replaceChildren();
  for (const [clave, nombre] of PESTANAS) nav.append(el("button", { textContent: nombre, className: estado.pestana === clave ? "activa" : "", onclick: () => { estado.pestana = clave; guardarLocal("crm_pestana", clave); pintar(); } }));
  const c = document.getElementById("contenido"); c.replaceChildren();
  ({ conversaciones: pintarConversaciones, entrevistas: pintarEntrevistas, ventas: pintarVentas, lead_magnets: pintarLeadMagnets }[estado.pestana] || pintarConversaciones)(c);
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

// ---------- Arranque ----------
const selAnio = document.getElementById("anio");
const esteAnio = new Date().getFullYear();
for (let a = esteAnio + 1; a >= 2026; a--) selAnio.append(el("option", { value: a, textContent: a, selected: a === esteAnio }));
selAnio.onchange = cargar;
cargar().catch(() => { document.getElementById("contenido").textContent = "No se han podido cargar los datos."; });
</script></body></html>`;
}
