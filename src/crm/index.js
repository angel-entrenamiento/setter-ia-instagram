// CRM del panel: Conversaciones (KPI diarios), Entrevistas, Ventas y Lead magnets.
// Módulo independiente: se engancha al servidor con crm.manejar() y al asistente con crm.registrar() (ver LEEME.md).
import { crearAlmacenCrm } from "./almacen.js";
import { CAMPOS_KPI, listasCrm, COLUMNAS_ENTREVISTA, COLUMNAS_VENTA, COLUMNAS_LEAD_MAGNET, entrevistaDesdeConversacion, esOutbound } from "./opciones.js";
import { paginaCrm } from "./pagina.js";
import { calcularPendientes } from "./pendientes.js";
import { calcularLeads, conversacionesActivas } from "./leads.js";
import { calcularMetricas, evolucionSemanal, registroDiario, agendadasEntre, lunesDe, METAS, MENSAJES_CONVERSACION, sumarDias } from "./metricas.js";

export function diaEn(zonaHoraria, fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

const trimestre = (fecha) => `${fecha.slice(0, 4)}-T${Math.floor((Number(fecha.slice(5, 7)) - 1) / 3) + 1}`;
const norm = (t) => String(t ?? "").trim().toLowerCase();
const SI = (v) => v === true || v === 1 || v === "1" || v === "si";

/**
 * @param {{ db: import("node:sqlite").DatabaseSync, zonaHoraria: string | (() => string), conversaciones: () => object[],
 *          nombreAsistente?: string | (() => string), esPrueba?: (conv: object) => boolean, log?: Console }} op
 *        (zona y nombre pueden ser funciones: cambian en Ajustes; esPrueba = cuentas de prueba, no cuentan en el Resumen)
 */
export function crearCrm({ db, zonaHoraria = "Europe/Madrid", conversaciones = () => [], nombreAsistente = "el asistente", esPrueba = () => false, log = console }) {
  const almacen = crearAlmacenCrm(db);
  const valor = (v) => (typeof v === "function" ? v() : v);
  const hoy = () => diaEn(valor(zonaHoraria));
  const asistente = () => valor(nombreAsistente);

  // ---------- Lo que rellena el asistente solo ----------

  /**
   * - inbound: una persona abrió ella la conversación (se cuenta en el día de su primer mensaje).
   * - lead_magnet: un disparador de ManyChat le envió un recurso.
   * - agendada: el asistente propuso la llamada y pasó la conversación (crea la fila en Entrevistas).
   */
  function registrar(evento, conv, { dia } = {}) {
    try {
      if (evento === "inbound") return almacen.sumarKpi(dia ?? hoy(), "inbound");
      if (evento === "lead_magnet") return almacen.sumarKpi(dia ?? hoy(), "lead_magnet");
      if (evento === "agendada") {
        if (almacen.filaDeConversacion("entrevista", conv.id)) return; // ya estaba apuntada
        almacen.sumarKpi(dia ?? hoy(), esOutbound(conv) ? "agendadas_outbound" : "agendadas_inbound");
        almacen.crearFila("entrevista", (dia ?? hoy()).slice(0, 7), entrevistaDesdeConversacion(conv), { convId: conv.id, origen: "asistente" });
      }
    } catch (error) {
      log.error?.(`[crm] ${evento}: ${error.message}`);
    }
  }

  // ---------- Reglas al editar ----------

  /** Al marcar/desmarcar "Entra" en una entrevista, suma o resta una cerrada en la pestaña Conversaciones. */
  function actualizarEntrevista(id, cambios) {
    const actual = almacen.fila(id);
    if (!actual) return null;
    const fecha = cambios.fecha_entrevista ?? actual.fecha_entrevista;
    const periodo = fecha ? fecha.slice(0, 7) : actual.periodo;
    const extra = {};
    // Día en que se puso la fecha de la entrevista = día en que quedó agendada (para el registro diario)
    if (cambios.fecha_entrevista && !actual._agendadaEn) extra._agendadaEn = hoy();
    if ("fecha_entrevista" in cambios && !cambios.fecha_entrevista) extra._agendadaEn = null;
    if ("entra" in cambios && SI(cambios.entra) !== SI(actual.entra)) {
      if (SI(cambios.entra)) {
        extra._cerradaEn = fecha || hoy();
        almacen.sumarKpi(extra._cerradaEn, "cerradas", 1);
      } else if (actual._cerradaEn) {
        almacen.sumarKpi(actual._cerradaEn, "cerradas", -1);
        extra._cerradaEn = null;
      }
    }
    return almacen.actualizarFila(id, { ...cambios, ...extra }, periodo).despues;
  }

  /** Solicitudes, respuestas y agendadas de cada lead magnet, contadas desde las conversaciones. */
  function contarLeadMagnets(filas) {
    const res = {};
    const convs = conversaciones();
    for (const f of filas.filter((x) => (x.tabla === "lead_magnet" || x.tabla === "feedback") && norm(x.clave_manychat))) {
      const deEste = convs.filter((c) => norm(c.recurso) === norm(f.clave_manychat));
      res[f.id] = {
        solicitudes: deEste.length,
        respuestas: deEste.filter((c) => c.historial.some((m) => m.rol === "lead")).length,
        agendadas: deEste.filter((c) => almacen.filaDeConversacion("entrevista", c.id)).length,
      };
    }
    return res;
  }

  function datos(anio) {
    const filas = almacen.filasDelAnio(anio);
    return {
      anio,
      hoy: hoy(),
      asistente: asistente(),
      opciones: { CAMPOS_KPI, LISTAS: listasCrm(), COLUMNAS_ENTREVISTA, COLUMNAS_VENTA, COLUMNAS_LEAD_MAGNET },
      kpis: almacen.kpisDelAnio(anio),
      notas: almacen.notasDelAnio(anio),
      filas,
      autoLeadMagnet: contarLeadMagnets(filas),
    };
  }

  // ---------- Resumen (semáforos, embudo y evolución semanal) ----------

  const DIA = /^\d{4}-\d{2}-\d{2}$/;
  const baseMetricas = () => ({
    conversaciones: conversaciones(),
    kpis: almacen.todosLosKpis(),
    entrevistas: almacen.filasDeTabla("entrevista"),
    diaEn: (fecha) => diaEn(valor(zonaHoraria), fecha),
    esPrueba,
  });

  /** «Te toca a ti»: leads esperando respuesta y llamadas por fijar o marcar. */
  function pendientes() {
    return { hoy: hoy(), ...calcularPendientes({ conversaciones: conversaciones(), entrevistas: almacen.filasDeTabla("entrevista"), hoy: hoy(), esPrueba }) };
  }

  /** Tablero de leads: cada persona que contestó en el periodo, con la etapa a la que ha llegado. */
  function leads(desde, hasta) {
    const hoyDia = hoy();
    hasta = DIA.test(hasta ?? "") ? hasta : hoyDia;
    desde = DIA.test(desde ?? "") ? desde : sumarDias(hasta, -29);
    const { conversaciones: convs, entrevistas, diaEn: d } = baseMetricas();
    return { hoy: hoyDia, ...calcularLeads({ conversaciones: convs, entrevistas, diaEn: d, desde, hasta, esPrueba }) };
  }

  /** Registro diario de un mes ("AAAA-MM") por vía, con el panel lateral mensual, trimestral y anual. */
  function registro(mes) {
    const hoyDia = hoy();
    if (!/^\d{4}-\d{2}$/.test(mes ?? "")) mes = hoyDia.slice(0, 7);
    return { hoy: hoyDia, asistente: asistente(), mensajesConversacion: MENSAJES_CONVERSACION, ...registroDiario({ ...baseMetricas(), mes, hoy: hoyDia }) };
  }

  function resumen(desde, hasta) {
    const hoyDia = hoy();
    hasta = DIA.test(hasta ?? "") ? hasta : hoyDia;
    desde = DIA.test(desde ?? "") ? desde : sumarDias(hasta, -29);
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    const base = baseMetricas();
    // El gasto se guarda por instante: aproximamos el día con la hora UTC (diferencia de 1-2 h, sin efecto práctico)
    const gastoUsd = almacen.gastoEntre(Date.parse(`${desde}T00:00:00Z`), Date.parse(`${sumarDias(hasta, 1)}T00:00:00Z`));
    return {
      hoy: hoyDia,
      asistente: asistente(),
      metas: METAS,
      mensajesConversacion: MENSAJES_CONVERSACION,
      metricas: calcularMetricas({ ...base, gastoUsd, desde, hasta, hoy: hoyDia }),
      semanal: evolucionSemanal({ ...base, hoy: hasta, semanas: 12 }),
      activas: conversacionesActivas({ ...base }),
      objetivo: objetivoSemanal(),
    };
  }

  /** Objetivo de agendas por semana (lo escribe el dueño en el Resumen) y cuántas lleva esta semana, de lunes a hoy. */
  const CLAVE_OBJETIVO = "objetivo_agendas_semana";
  function objetivoSemanal(dia = hoy()) {
    const objetivo = Math.max(0, Math.round(Number(almacen.nota(CLAVE_OBJETIVO)) || 0));
    const semana = lunesDe(dia);
    return { objetivo: objetivo || null, semana, llevas: agendadasEntre({ ...baseMetricas(), desde: semana, hasta: dia }) };
  }

  /** Suma bienvenidas enviadas (columna Outbound) en un día. */
  function sumarBienvenidas(cantidad, dia = hoy()) {
    almacen.sumarKpi(dia, "outbound", cantidad);
    return almacen.todosLosKpis()[dia]?.outbound ?? 0;
  }

  // ---------- HTTP (rutas /panel/crm…, ya autenticadas por el servidor) ----------

  /** @returns {Promise<boolean>} true si la ruta era del CRM */
  async function manejar(req, res, ruta, { leerCuerpo, responder, url }) {
    if (!ruta.startsWith("/panel/crm")) return false;
    const json = async () => JSON.parse((await leerCuerpo(req)).toString("utf8") || "{}");
    const ok = (cuerpo) => responder(res, 200, cuerpo);
    const mal = (codigo, error) => responder(res, codigo, { error });
    try {
      if (ruta === "/panel/crm" && req.method === "GET") {
        responder(res, 200, paginaCrm({ titulo: `${asistente()} · CRM` }), "text/html; charset=utf-8");
        return true;
      }
      if (ruta === "/panel/crm/api/datos" && req.method === "GET") {
        ok(datos(String(url.searchParams.get("anio") ?? hoy().slice(0, 4)).replace(/\D/g, "").slice(0, 4)));
        return true;
      }
      if (ruta === "/panel/crm/api/leads" && req.method === "GET") {
        ok(leads(url.searchParams.get("desde"), url.searchParams.get("hasta")));
        return true;
      }
      if (ruta === "/panel/crm/api/pendientes" && req.method === "GET") {
        ok(pendientes());
        return true;
      }
      if (ruta === "/panel/crm/api/registro" && req.method === "GET") {
        ok(registro(url.searchParams.get("mes")));
        return true;
      }
      if (ruta === "/panel/crm/api/resumen" && req.method === "GET") {
        ok(resumen(url.searchParams.get("desde"), url.searchParams.get("hasta")));
        return true;
      }
      if (ruta === "/panel/crm/api/bienvenidas" && req.method === "POST") {
        const { cantidad, fecha } = await json();
        const c = Math.round(Number(cantidad));
        if (!Number.isFinite(c) || c === 0 || Math.abs(c) > 1000 || (fecha && !DIA.test(fecha))) return mal(400, "cantidad"), true;
        const dia = fecha || hoy();
        ok({ ok: true, fecha: dia, outbound: sumarBienvenidas(c, dia) });
        return true;
      }
      if (ruta === "/panel/crm/api/kpi" && req.method === "POST") {
        const { fecha, campo, valor } = await json();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !CAMPOS_KPI.some((c) => c.clave === campo)) return mal(400, "datos"), true;
        almacen.fijarKpi(fecha, campo, valor);
        ok({ ok: true });
        return true;
      }
      if (ruta === "/panel/crm/api/nota" && req.method === "POST") {
        const { clave, texto } = await json();
        if (!/^[\w:-]{1,60}$/.test(clave ?? "")) return mal(400, "clave"), true;
        almacen.fijarNota(clave, String(texto ?? "").slice(0, 5000));
        ok({ ok: true });
        return true;
      }
      if (ruta === "/panel/crm/api/fila" && req.method === "POST") {
        const { tabla, periodo, datos: d = {} } = await json();
        if (!/^\d{4}(-\d{2}|-T[1-4])?$/.test(periodo ?? "")) return mal(400, "periodo"), true;
        ok(almacen.crearFila(tabla, periodo, d));
        return true;
      }
      const m = ruta.match(/^\/panel\/crm\/api\/fila\/(\d+)$/);
      if (m && req.method === "POST") {
        const id = Number(m[1]);
        const { cambios = {} } = await json();
        delete cambios._cerradaEn;
        delete cambios._agendadaEn;
        const fila = almacen.fila(id);
        if (!fila) return mal(404, "no existe"), true;
        ok(fila.tabla === "entrevista" ? actualizarEntrevista(id, cambios) : almacen.actualizarFila(id, cambios).despues);
        return true;
      }
      if (m && req.method === "DELETE") {
        const antes = almacen.borrarFila(Number(m[1]));
        if (antes?.tabla === "entrevista" && antes._cerradaEn) almacen.sumarKpi(antes._cerradaEn, "cerradas", -1);
        ok({ ok: true });
        return true;
      }
      mal(404, "ruta");
      return true;
    } catch (error) {
      log.error?.(`[crm] ${ruta}: ${error.message}`);
      mal(500, error.message);
      return true;
    }
  }

  return { registrar, manejar, datos, resumen, objetivoSemanal, registro, pendientes, leads, sumarBienvenidas, almacen, actualizarEntrevista, trimestre };
}
