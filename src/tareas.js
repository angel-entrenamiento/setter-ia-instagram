// Tareas programadas: seguimiento de las 24 h, INBOUND del CRM, resumen semanal (lunes 9:00), informe de dudas (jueves) y limpieza RGPD.
import { config } from "./config.js";
import { negocio, tieneEtiquetaNoResponder, nombreEtiqueta } from "./negocio.js";
import { licenciaPermite } from "./licencia.js";
import { loSigue } from "./seguidos.js";
import { admiteSeguimiento, redactarSeguimiento, enListaBlanca, aplicarEtiqueta } from "./motor.js";
import { revisarSeguimiento } from "./cerebro/reglas.js";
import { construirInformeDudas } from "./avisos/informeDudas.js";
import { construirEmailResumenSemanal } from "./avisos/emails.js";

const HORA = 3600000;
const ORIGENES_INBOUND = ["espontaneo", "info", "precio", "anuncio", "historia"];
const MARGEN_ALTA_MIN = 5;

/**
 * ManyChat da de alta al contacto con el PRIMER mensaje de la conversación, sea del lead o del dueño (aunque el dueño
 * escriba a mano desde Instagram). Si el alta es más de 5 min anterior al primer mensaje del lead, la conversación
 * ya existía: le escribimos nosotros antes (bienvenida) o es un contacto antiguo → no es inbound.
 */
export function altaPrevia(conv, primero) {
  if (!conv.altaManychat) return false;
  const llegada = Date.parse(conv.primerMensajeAt ?? primero?.fecha);
  return llegada - Date.parse(conv.altaManychat) > MARGEN_ALTA_MIN * 60_000;
}

export function ahoraLocal(fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: config.zonaHoraria,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), diaSemana: p.weekday };
}

const horasDesde = (iso) => (iso ? (Date.now() - Date.parse(iso)) / HORA : Infinity);

export function crearTareas({ almacen, manychat, enviarEmail, crm = null, log = console }) {
  function candidata(conv) {
    if (!conv.manychatId || conv.id.startsWith("panel:") || !admiteSeguimiento(conv)) return false;
    if (loSigue(almacen, conv.igUsuario) && !enListaBlanca(conv)) return false; // a quien sigue el dueño no se le escribe
    return !config.modoPrueba || enListaBlanca(conv);
  }

  /** Antes de escribir por iniciativa propia, mira en ManyChat si el dueño le ha puesto una etiqueta de «no contestar» o IA_PAUSA. */
  async function etiquetasPermiten(conv) {
    const { etiquetas = [] } = await manychat.infoContacto(conv.manychatId);
    if (tieneEtiquetaNoResponder(etiquetas)) aplicarEtiqueta(conv, "ALUMNO");
    else if (etiquetas.includes(nombreEtiqueta("IA_PAUSA"))) aplicarEtiqueta(conv, "IA_PAUSA");
    else return true;
    almacen.guardar(conv);
    return false;
  }

  /** Envía el seguimiento automático (n=1, a las ~24 h). Se marca aunque falle, para no reintentarlo sin fin. */
  async function enviarSeguimiento(conv, n) {
    try {
      if (!(await etiquetasPermiten(conv))) return;
      const { texto: borrador, coste } = await redactarSeguimiento(conv, n);
      almacen.registrarCoste(coste, "seguimientos");
      const texto = revisarSeguimiento(borrador);
      conv.seguimientos[`s${n}`] = new Date().toISOString();
      if (!texto) {
        log.error(`[seguimiento ${n}] ${conv.id}: texto descartado por las reglas`);
        return almacen.guardar(conv);
      }
      almacen.registrarEnviado(conv.id, texto);
      await manychat.enviarTextos(conv.manychatId, [texto]);
      conv.historial.push({ rol: "bot", tipo: "texto", texto, fecha: new Date().toISOString(), seguimiento: n });
      almacen.registrarEvento(`seguimiento_${n}`, conv.id);
      almacen.guardar(conv);
    } catch (error) {
      conv.seguimientos[`s${n}`] ??= `error ${new Date().toISOString()}`;
      almacen.guardar(conv);
      log.error(`[seguimiento ${n}] ${conv.id}: ${error.message}`);
    }
  }

  /**
   * Un único seguimiento cuando el lead deja de contestar: entre las 23 y las 23,5 h desde su último mensaje
   * (Meta solo deja escribir hasta las 24 h). No hay seguimiento de las 8 h ni email diario de seguimientos.
   */
  async function seguimientosAutomaticos() {
    if (!negocio.seguimientosAutomaticos) return;
    for (const conv of almacen.todas()) {
      if (!candidata(conv)) continue;
      conv.seguimientos ??= {};
      if (conv.seguimientos.s1) continue;
      const h = horasDesde(conv.ultimoMensajeLeadAt);
      if (h < config.seguimiento1Horas[0] || h > config.seguimiento1Horas[1]) continue;
      await enviarSeguimiento(conv, 1);
    }
  }

  async function resumenSemanal() {
    const hasta = new Date();
    const desde = new Date(hasta - 7 * 24 * HORA);
    const metricas = almacen.contarEventos(+desde, +hasta);
    const costeUsd = almacen.sumarCoste(+desde, +hasta);
    await enviarEmail(construirEmailResumenSemanal(metricas, { desde, hasta, costeUsd }));
  }

  async function informeDudas() {
    const hasta = new Date();
    const desde = new Date(hasta - 7 * 24 * HORA);
    const { email, coste } = await construirInformeDudas(almacen.todas(), { desde, hasta });
    almacen.registrarCoste(coste, "informes");
    await enviarEmail(email);
  }

  /**
   * INBOUND para el CRM: cuenta a cada persona que abrió ella la conversación (escribió sin que le escribiéramos antes:
   * pide información o cuenta su caso). No cuentan las respuestas a la bienvenida que el dueño escribe a mano (se
   * detectan por el alta en ManyChat, ver altaPrevia), ni los disparadores de ManyChat, ni las cuentas de prueba.
   * Se cuenta una vez por persona, en el día de su primer mensaje, después de que el asistente le conteste.
   * Solo conversaciones empezadas desde que existe el CRM (no rellena días pasados).
   */
  function kpiInbound() {
    if (!crm) return;
    const desde = Date.parse(almacen.ajuste("crm_desde") ?? new Date().toISOString());
    for (const conv of almacen.todas()) {
      if (conv.kpiInbound || conv.id.startsWith("panel:")) continue;
      const primero = conv.historial.find((m) => m.rol === "lead");
      if (!conv.presentado || !primero || Date.parse(conv.primerMensajeAt ?? primero.fecha) < desde) continue;
      if (!ORIGENES_INBOUND.includes(conv.origen) || enListaBlanca(conv)) continue;
      if (conv.historial[0] !== primero) continue; // escribimos antes nosotros (el dueño o un mensaje automático)
      if (altaPrevia(conv, primero)) continue; // el dueño le escribió antes a mano (bienvenida): no es inbound
      conv.kpiInbound = { dia: ahoraLocal(new Date(conv.primerMensajeAt ?? primero.fecha)).dia };
      almacen.registrarEvento("inbound", conv.id);
      crm.registrar("inbound", conv, { dia: conv.kpiInbound.dia });
      almacen.guardar(conv);
    }
  }

  function limpiezaDiaria() {
    const borradas = almacen.borrarInactivas(config.diasConservacion);
    almacen.limpiar();
    if (config.modoPrueba) {
      // En modo prueba no guardamos conversaciones de cuentas que no son de prueba
      for (const c of almacen.todas())
        if (!c.manychatId && !c.id.startsWith("panel:") && horasDesde(c.actualizadaAt) > 1) almacen.borrar(c.id);
    }
    if (borradas) log.info(`[rgpd] ${borradas} conversaciones inactivas borradas`);
  }

  /** Se llama cada 5 minutos. */
  async function cadaCincoMinutos() {
    if (!licenciaPermite()) return;
    await seguimientosAutomaticos();
    kpiInbound();
    const { dia, hora, diaSemana } = ahoraLocal();
    if (hora >= 9 && almacen.ajuste("ultimo_diario") !== dia) {
      almacen.fijarAjuste("ultimo_diario", dia);
      limpiezaDiaria();
    }
    if (negocio.resumenSemanal && diaSemana === "Mon" && hora >= 9 && almacen.ajuste("ultimo_semanal") !== dia) {
      almacen.fijarAjuste("ultimo_semanal", dia);
      await resumenSemanal();
    }
    if (negocio.informeDudas && diaSemana === "Thu" && hora >= 9 && almacen.ajuste("ultimo_informe_dudas") !== dia) {
      almacen.fijarAjuste("ultimo_informe_dudas", dia);
      await informeDudas().catch((e) => log.error(`[informe dudas] ${e.message}`));
    }
  }

  return { cadaCincoMinutos, seguimientosAutomaticos, kpiInbound, informeDudas, resumenSemanal, limpiezaDiaria };
}
