// Métricas del CRM: registro diario por vía (como el CRM de la academia), panel lateral mensual/trimestral/anual,
// semáforos frente a las metas, embudo de bienvenida a cliente y evolución semanal.
// Todo se calcula al momento con lo que ya se guarda (conversaciones, KPI diarios, filas de Entrevistas y gasto de IA).
// Las conversaciones sin actividad se borran a los DIAS_CONSERVACION días (180 por defecto): en periodos más
// antiguos las respuestas y los «+2 contactos» pueden salir más bajos de lo que fueron.
//
// Vías: bienvenida (outbound), lead_magnet (disparador de ManyChat con recurso) e inbound (te escriben primero).
// Propuesta = el setter propone la llamada y te pasa la conversación (fila 🤖 en Entrevistas, por el día en que se crea).
// Agendada = ya tiene fecha de entrevista (por el día en que pusiste la fecha).

/** Metas de referencia. «menor» = por debajo de esto es rojo; entre menor y meta, amarillo; desde la meta, verde. */
export const METAS = Object.freeze({
  respuesta: { meta: 20, menor: 12 }, // % de bienvenidas que reciben respuesta
  conversaciones: { meta: 10, menor: 6 }, // conversaciones reales por cada 100 bienvenidas
  citas: { meta: 1, menor: 0.5 }, // % de bienvenidas (outbound) que acaban en cita agendada (lo normal: 1-3 %)
  citasInbound: { meta: 30, menor: 20 }, // % de agendas cuando te escriben ellos o mandan palabra clave (lo normal: 30-50 %)
  asistencia: { meta: 80, menor: 80 }, // % de llamadas agendadas que se realizan: si fallan más del 20 %, algo falla al agendar
});

/** Días sin escribir a partir de los cuales una conversación deja de contar como «activa». */
export const DIAS_ACTIVA = 7;

/** Mensajes del lead a partir de los cuales la respuesta cuenta como «conversación real» (+2 contactos). */
export const MENSAJES_CONVERSACION = 3;

export const VIAS = ["bienvenida", "lead_magnet", "inbound"];
const KPI_DE_VIA = { bienvenida: "outbound", lead_magnet: "lead_magnet", inbound: "inbound" };

const ESTADOS_CUALIFICADO = ["cualificado", "propuesta_llamada", "cierre"];
const SI = (v) => v === true || v === 1 || v === "1" || v === "si";
const n = (v) => Number(v) || 0;
const porcentaje = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Vía de una conversación según cómo llegó. */
export const viaDeConversacion = (conv) => (conv.origen === "bienvenida" ? "bienvenida" : conv.origen === "recurso" ? "lead_magnet" : "inbound");

/** Vía de una fila de Entrevistas según su procedencia. */
export function viaDeEntrevista(fila) {
  const p = String(fila.procedencia ?? "").trim().toLowerCase();
  if (p === "outbound") return "bienvenida";
  if (p === "lead magnet") return "lead_magnet";
  return "inbound";
}

/** Día (AAAA-MM-DD) del primer mensaje del lead en la zona horaria del negocio, o null si nunca escribió. */
export function diaPrimeraRespuesta(conv, diaEn) {
  const primero = (conv.historial ?? []).find((m) => m.rol === "lead");
  if (!primero) return null;
  const fecha = new Date(conv.primerMensajeAt ?? primero.fecha ?? conv.creadaAt);
  return Number.isNaN(+fecha) ? null : diaEn(fecha);
}

/** Semáforo de un valor frente a su meta: verde | amarillo | rojo | sin_datos */
export function semaforo(valor, { meta, menor }) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "sin_datos";
  if (valor >= meta) return "verde";
  if (valor >= menor) return "amarillo";
  return "rojo";
}

/** Lunes (AAAA-MM-DD) de la semana de un día. */
export function lunesDe(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function sumarDias(dia, dias) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const ultimoDiaDelMes = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);

/**
 * Hechos con fecha, cada uno con su día y su vía. Es la base de todos los cálculos.
 * @returns {{ dia: string, via: string, tipo: "entrada"|"respuesta"|"contactos"|"cualificado"|"propuesta"|"agendada"|"cita", fila?: object }[]}
 */
function hechos({ conversaciones, kpis, entrevistas, diaEn, esPrueba = () => false }) {
  const lista = [];
  for (const [dia, v] of Object.entries(kpis)) {
    for (const via of VIAS) for (let i = 0; i < n(v[KPI_DE_VIA[via]]); i++) lista.push({ dia, via, tipo: "entrada" });
  }
  for (const c of conversaciones) {
    if (String(c.id).startsWith("panel:") || esPrueba(c)) continue;
    const dia = diaPrimeraRespuesta(c, diaEn);
    if (!dia) continue;
    const via = viaDeConversacion(c);
    lista.push({ dia, via, tipo: "respuesta" });
    if ((c.historial ?? []).filter((m) => m.rol === "lead").length >= MENSAJES_CONVERSACION) lista.push({ dia, via, tipo: "contactos" });
    if (ESTADOS_CUALIFICADO.includes(c.estado)) lista.push({ dia, via, tipo: "cualificado" });
  }
  for (const f of entrevistas) {
    const via = viaDeEntrevista(f);
    const creada = f.creada ? diaEn(new Date(f.creada)) : `${f.periodo}-01`;
    lista.push({ dia: creada, via, tipo: "propuesta" });
    if (f.fecha_entrevista) {
      lista.push({ dia: f._agendadaEn || f.fecha_entrevista, via, tipo: "agendada" });
      lista.push({ dia: f.fecha_entrevista, via, tipo: "cita", fila: f });
    }
  }
  return lista;
}

/** Cuenta hechos de un tipo (y vía, opcional) entre dos días incluidos. */
const contar = (lista, tipo, desde, hasta, via = null) =>
  lista.reduce((s, h) => (h.tipo === tipo && h.dia >= desde && h.dia <= hasta && (!via || h.via === via) ? s + 1 : s), 0);

/** Llamadas que ya tocaban (fecha de entrevista hasta hoy): realizadas, no presentadas y cerradas. */
function llamadas(lista, desde, hasta, hoy) {
  const fin = hasta < hoy ? hasta : hoy;
  const citas = lista.filter((h) => h.tipo === "cita" && h.dia >= desde && h.dia <= fin).map((h) => h.fila);
  const realizadas = citas.filter((f) => SI(f.presentado)).length;
  const cerradas = lista.filter((h) => h.tipo === "cita" && h.dia >= desde && h.dia <= hasta && SI(h.fila.entra)).length;
  // Asistencia: solo las llamadas ya marcadas («Presentado» o «No se presentó»), para no contar como fallo lo que aún no has marcado
  const noPresentadas = citas.filter((f) => !SI(f.presentado) && SI(f.no_presentado)).length;
  return {
    total: citas.length,
    realizadas,
    noPresentadas,
    sinMarcar: citas.length - realizadas - noPresentadas,
    asistencia: porcentaje(realizadas, realizadas + noPresentadas),
    cerradas,
    cierre: porcentaje(cerradas, realizadas),
    aparicion: porcentaje(realizadas, citas.length),
  };
}

/** Una fila del registro diario: conversaciones, % respuesta, +2 contactos, propuestas y agendadas. */
function filaDiaria(lista, desde, hasta, via) {
  const vias = via === "general" ? VIAS : [via];
  const suma = (tipo) => vias.reduce((s, v) => s + contar(lista, tipo, desde, hasta, v), 0);
  const conversaciones = suma("entrada");
  // En inbound la persona escribe primero: no hay «respuesta» que medir. En General, inbound cuenta como respondida.
  const respondieron = vias.reduce((s, v) => s + (v === "inbound" ? contar(lista, "entrada", desde, hasta, v) : contar(lista, "respuesta", desde, hasta, v)), 0);
  return {
    conversaciones,
    respuesta: via === "inbound" ? null : porcentaje(respondieron, conversaciones),
    respondieron,
    contactos: suma("contactos"),
    propuestas: suma("propuesta"),
    agendadas: suma("agendada"),
  };
}

/** Panel lateral de un periodo: outbound / inbound / lead magnet con sus agendadas y tasa de inducción, y las llamadas. */
function lateral(lista, desde, hasta, hoy) {
  const via = (v) => {
    const entradas = contar(lista, "entrada", desde, hasta, v);
    const agendadas = contar(lista, "agendada", desde, hasta, v);
    return { entradas, agendadas, induccion: porcentaje(agendadas, entradas) };
  };
  return { desde, hasta, outbound: via("bienvenida"), inbound: via("inbound"), lead_magnet: via("lead_magnet"), llamadas: llamadas(lista, desde, hasta, hoy) };
}

/**
 * Registro diario de un mes (pestaña Registro), por vía, y el panel lateral mensual, trimestral y anual.
 * @param {object} op  conversaciones, kpis, entrevistas, diaEn, esPrueba (como calcularMetricas), mes "AAAA-MM", hoy "AAAA-MM-DD"
 */
export function registroDiario({ mes, hoy, ...datos }) {
  const lista = hechos(datos);
  const desde = `${mes}-01`, hasta = ultimoDiaDelMes(mes);
  const vias = ["general", ...VIAS];
  const dias = [];
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    const fila = { dia };
    for (const v of vias) fila[v] = filaDiaria(lista, dia, dia, v);
    const g = fila.general;
    if (g.conversaciones || g.contactos || g.propuestas || g.agendadas || fila.bienvenida.respondieron) dias.push(fila);
  }
  const total = Object.fromEntries(vias.map((v) => [v, filaDiaria(lista, desde, hasta, v)]));
  const anio = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)), t = Math.floor((m - 1) / 3);
  const mesTexto = (a, mm) => `${a}-${String(mm).padStart(2, "0")}`;
  /** Mes «AAAA-MM» desplazado n meses. */
  const otroMes = (n) => { const d = new Date(Date.UTC(anio, m - 1 + n, 1)); return mesTexto(d.getUTCFullYear(), d.getUTCMonth() + 1); };
  const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
  /** Periodo con el anterior para comparar. Si el periodo está en curso, el anterior se corta al mismo número de días. */
  const conAnterior = (desdeP, hastaP, desdeA, hastaA, extra = {}, extraA = {}) => {
    const parcial = hoy >= desdeP && hoy < hastaP;
    const finA = parcial ? [hastaA, sumarDias(desdeA, diasEntre(desdeP, hoy))].sort()[0] : hastaA;
    return { ...lateral(lista, desdeP, hastaP, hoy), ...extra, anterior: { ...lateral(lista, desdeA, finA, hoy), ...extraA, parcial, hasta: finA } };
  };
  const mesA = otroMes(-1);
  const iniT = (a, tt) => `${mesTexto(a, 3 * tt + 1)}-01`, finT = (a, tt) => ultimoDiaDelMes(mesTexto(a, 3 * tt + 3));
  const tAnt = t === 0 ? [anio - 1, 3] : [anio, t - 1];
  return {
    mes,
    dias,
    total,
    // Cada periodo lleva el anterior (mes, trimestre o año) para comparar
    lateral: {
      mensual: conAnterior(desde, hasta, `${mesA}-01`, ultimoDiaDelMes(mesA), {}, { mes: mesA }),
      trimestral: conAnterior(iniT(anio, t), finT(anio, t), iniT(...tAnt), finT(...tAnt), { nombre: `${t + 1}º trimestre ${anio}` }, { nombre: `${tAnt[1] + 1}º trimestre ${tAnt[0]}` }),
      anual: conAnterior(`${anio}-01-01`, `${anio}-12-31`, `${anio - 1}-01-01`, `${anio - 1}-12-31`, { nombre: `Año ${anio}` }, { nombre: `${anio - 1}` }),
    },
  };
}

/**
 * Resumen de un periodo: semáforos, embudo de outbound, outbound frente a inbound y gasto.
 * @param {object} op
 * @param {object[]} op.conversaciones  conversaciones del setter
 * @param {Record<string, Record<string, number>>} op.kpis  { "2026-11-10": { outbound: 40, … } }
 * @param {object[]} op.entrevistas  filas de la pestaña Entrevistas
 * @param {number} op.gastoUsd  gasto de IA del periodo
 * @param {string} op.desde  primer día (incluido), AAAA-MM-DD
 * @param {string} op.hasta  último día (incluido), AAAA-MM-DD
 * @param {(fecha: Date) => string} op.diaEn  fecha → día en la zona horaria del negocio
 * @param {(conv: object) => boolean} [op.esPrueba]  cuentas de prueba (no cuentan)
 * @param {string} [op.hoy]  día de hoy (las llamadas futuras aún no cuentan como realizadas o no presentadas)
 */
export function calcularMetricas({ gastoUsd = 0, desde, hasta, hoy = hasta, ...datos }) {
  const lista = hechos(datos);
  const c = (tipo, via) => contar(lista, tipo, desde, hasta, via);
  const bienvenidas = c("entrada", "bienvenida");
  const out = { respondieron: c("respuesta", "bienvenida"), conversaciones: c("contactos", "bienvenida"), cualificados: c("cualificado", "bienvenida"), propuestas: c("propuesta", "bienvenida"), agendadas: c("agendada", "bienvenida") };
  const llamadasOut = (() => {
    const fin = hasta < hoy ? hasta : hoy;
    const citas = lista.filter((h) => h.tipo === "cita" && h.via === "bienvenida" && h.dia >= desde && h.dia <= fin).map((h) => h.fila);
    return { presentados: citas.filter((f) => SI(f.presentado)).length, clientes: lista.filter((h) => h.tipo === "cita" && h.via === "bienvenida" && h.dia >= desde && h.dia <= hasta && SI(h.fila.entra)).length };
  })();
  const todas = llamadas(lista, desde, hasta, hoy);
  const agendadas = VIAS.reduce((s, v) => s + c("agendada", v), 0);
  const origen = (via) => ({
    entradas: c("entrada", via),
    conversaciones: c("contactos", via),
    cualificados: c("cualificado", via),
    propuestas: c("propuesta", via),
    citas: c("agendada", via),
  });

  const tarjetas = {
    respuesta: { valor: porcentaje(out.respondieron, bienvenidas), a: out.respondieron, b: bienvenidas },
    conversaciones: { valor: porcentaje(out.conversaciones, bienvenidas), a: out.conversaciones, b: bienvenidas },
    citas: { valor: porcentaje(out.agendadas, bienvenidas), a: out.agendadas, b: bienvenidas },
    citasInbound: { valor: porcentaje(c("agendada", "inbound") + c("agendada", "lead_magnet"), c("entrada", "inbound") + c("entrada", "lead_magnet")), a: c("agendada", "inbound") + c("agendada", "lead_magnet"), b: c("entrada", "inbound") + c("entrada", "lead_magnet") },
    asistencia: { valor: todas.asistencia, a: todas.realizadas, b: todas.realizadas + todas.noPresentadas, sinMarcar: todas.sinMarcar },
    cierre: { valor: todas.cierre, a: todas.cerradas, b: todas.realizadas },
  };
  for (const [clave, t] of Object.entries(tarjetas)) t.semaforo = METAS[clave] ? semaforo(t.valor, METAS[clave]) : t.valor === null ? "sin_datos" : "info";
  // Más respuestas que bienvenidas apuntadas: faltan bienvenidas por sumar y los % de outbound no son reales
  if (out.respondieron > bienvenidas) for (const k of ["respuesta", "conversaciones", "citas"]) Object.assign(tarjetas[k], { semaforo: "sin_datos", faltanBienvenidas: true });

  /** Embudo de una o varias vías. En «Te escriben» la persona ya escribió: entrar = responder. */
  const embudoDe = (vias) => {
    const suma = (fn) => vias.reduce((s, v) => s + fn(v), 0);
    const fin = hasta < hoy ? hasta : hoy;
    const citas = lista.filter((h) => h.tipo === "cita" && vias.includes(h.via) && h.dia >= desde && h.dia <= hasta);
    return [
      { clave: "bienvenidas", valor: suma((v) => c("entrada", v)) },
      { clave: "respondieron", valor: suma((v) => (v === "inbound" ? c("entrada", v) : c("respuesta", v))) },
      { clave: "conversaciones", valor: suma((v) => c("contactos", v)) },
      { clave: "cualificados", valor: suma((v) => c("cualificado", v)) },
      { clave: "propuestas", valor: suma((v) => c("propuesta", v)) },
      { clave: "agendadas", valor: suma((v) => c("agendada", v)) },
      { clave: "presentados", valor: citas.filter((h) => h.dia <= fin && SI(h.fila.presentado)).length },
      { clave: "clientes", valor: citas.filter((h) => SI(h.fila.entra)).length },
    ];
  };

  return {
    desde,
    hasta,
    tarjetas,
    puntoDebil: puntoDebil(tarjetas),
    embudos: { bienvenida: embudoDe(["bienvenida"]), lead_magnet: embudoDe(["lead_magnet"]), inbound: embudoDe(["inbound"]), todas: embudoDe(VIAS) },
    embudo: [
      { clave: "bienvenidas", nombre: "Bienvenidas enviadas", valor: bienvenidas },
      { clave: "respondieron", nombre: "Respondieron", valor: out.respondieron },
      { clave: "conversaciones", nombre: "+2 contactos", valor: out.conversaciones },
      { clave: "cualificados", nombre: "Cualificados", valor: out.cualificados },
      { clave: "propuestas", nombre: "Llamada propuesta", valor: out.propuestas },
      { clave: "agendadas", nombre: "Cita agendada", valor: out.agendadas },
      { clave: "presentados", nombre: "Se presentaron", valor: llamadasOut.presentados },
      { clave: "clientes", nombre: "Clientes", valor: llamadasOut.clientes },
    ],
    origen: { outbound: origen("bienvenida"), inbound: origen("inbound"), lead_magnet: origen("lead_magnet") },
    citas: agendadas,
    presentados: todas.realizadas,
    clientes: todas.cerradas,
    gastoUsd: Math.round(gastoUsd * 100) / 100,
    costePorCita: agendadas ? Math.round((gastoUsd / agendadas) * 100) / 100 : null,
  };
}

/** Las últimas `semanas` semanas (de lunes a domingo) hasta la que contiene `hoy`, con lo justo para el gráfico. */
export function evolucionSemanal({ semanas = 12, hoy, ...datos }) {
  const lista = hechos(datos);
  const ultimaLunes = lunesDe(hoy);
  const res = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const desde = sumarDias(ultimaLunes, -7 * i), hasta = sumarDias(desde, 6);
    const bienvenidas = contar(lista, "entrada", desde, hasta, "bienvenida");
    const respondieron = contar(lista, "respuesta", desde, hasta, "bienvenida");
    res.push({
      semana: desde,
      bienvenidas,
      respondieron,
      citas: VIAS.reduce((s, v) => s + contar(lista, "agendada", desde, hasta, v), 0),
      respuesta: porcentaje(respondieron, bienvenidas),
    });
  }
  return res;
}

/** Pasos que se miran para el «punto débil», en el orden del camino del lead. «etapa» = etapa del tablero de Leads donde se quedaron. */
const PASOS_DEBILES = [
  { clave: "respuesta", nombre: "la respuesta a bienvenidas", meta: "20 %", unidad: " %", consejo: "Revisa el mensaje de bienvenida: la primera frase y la pregunta del final." },
  { clave: "conversaciones", nombre: "las conversaciones", meta: "unas 10 por cada 100 bienvenidas", unidad: "", consejo: "Contestan una vez y se paran: revisa el segundo mensaje del setter.", etapa: "respondieron" },
  { clave: "citas", nombre: "las agendas outbound", meta: "1-3 %", unidad: " %", consejo: "Hablan pero no agendan: revisa cuándo y cómo propone la llamada.", etapa: "cualificados" },
  { clave: "citasInbound", nombre: "las agendas inbound", meta: "30-50 %", unidad: " %", consejo: "Te escriben pero no agendan: revisa la respuesta a la palabra clave y a quien escribe primero." },
  { clave: "asistencia", nombre: "las llamadas que se realizan", meta: "80 % o más", unidad: " %", consejo: "Fallan más del 20 %: algo falla en cómo se agendan (confirmación y recordatorio de la llamada)." },
];

/**
 * El paso del camino que más hay que mejorar: el primero en rojo y, si no hay, el primero en amarillo.
 * @returns {null | { estado: "bien" } | { estado: "rojo"|"amarillo", clave, nombre, valor, meta, unidad, consejo, etapa? }}
 *          null si no hay datos para ningún paso.
 */
export function puntoDebil(tarjetas) {
  const conDatos = PASOS_DEBILES.filter((p) => tarjetas[p.clave] && tarjetas[p.clave].semaforo !== "sin_datos");
  if (!conDatos.length) return null;
  const paso = conDatos.find((p) => tarjetas[p.clave].semaforo === "rojo") ?? conDatos.find((p) => tarjetas[p.clave].semaforo === "amarillo");
  if (!paso) return { estado: "bien" };
  return { estado: tarjetas[paso.clave].semaforo, valor: tarjetas[paso.clave].valor, ...paso };
}

/** Citas agendadas (todas las vías) entre dos días incluidos: para el objetivo semanal. */
export function agendadasEntre({ desde, hasta, ...datos }) {
  const lista = hechos(datos);
  return VIAS.reduce((s, v) => s + contar(lista, "agendada", desde, hasta, v), 0);
}
