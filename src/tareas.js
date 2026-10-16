// Tareas programadas: seguimientos, email diario de seguimientos (9:00), resumen semanal (lunes 9:00) y limpieza RGPD.
import { config } from "./config.js";
import { negocio, tieneEtiquetaNoResponder, nombreEtiqueta } from "./negocio.js";
import { licenciaPermite } from "./licencia.js";
import { admiteSeguimiento, redactarSeguimiento, enListaBlanca, aplicarEtiqueta, soloRecurso } from "./motor.js";
import { revisarSeguimiento } from "./cerebro/reglas.js";
import { construirInformeDudas } from "./avisos/informeDudas.js";
import { construirEmailSeguimientos, construirEmailResumenSemanal } from "./avisos/emails.js";

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

  /** Envía un seguimiento automático (n=0 a las 8 h, n=1 a las ~24 h). Se marca aunque falle, para no reintentarlo sin fin. */
  async function enviarSeguimiento(conv, n) {
    try {
      if (!(await etiquetasPermiten(conv))) return;
      const { texto: borrador, coste } = await redactarSeguimiento(conv, n);
      almacen.registrarCoste(coste);
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
   * Seguimientos que envía el asistente, contando desde la última interacción del lead (Meta solo deja escribir 24 h):
   * - a las 8 h (no de noche: de 22:00 a 9:00 espera a la mañana; si ya es tarde para eso, se lo salta),
   * - entre las 23 y las 23,5 h, nunca antes (y al menos 4 h después del de las 8 h).
   */
  async function seguimientosAutomaticos() {
    if (!negocio.seguimientosAutomaticos) return;
    const { hora } = ahoraLocal();
    const deNoche = hora >= 22 || hora < 9;
    for (const conv of almacen.todas()) {
      if (!candidata(conv)) continue;
      conv.seguimientos ??= {};
      const h = horasDesde(conv.ultimoMensajeLeadAt);
      const { s0, s1 } = conv.seguimientos;
      if (!s0 && !s1 && h >= config.seguimiento0Horas && h < config.seguimiento1Horas[0] - 4 && !deNoche) {
        await enviarSeguimiento(conv, 0);
        continue;
      }
      if (s1) continue;
      if (h < config.seguimiento1Horas[0] || h > config.seguimiento1Horas[1]) continue;
      if (s0 && horasDesde(s0.replace(/^error /, "")) < 4) continue;
      await enviarSeguimiento(conv, 1);
    }
  }

  /** Email de las 9:00 con los seguimientos 2 (día 3) y 3 (día 6-7) redactados para el dueño. */
  async function emailSeguimientos() {
    if (!negocio.emailSeguimientos) return 0;
    const lista = [];
    for (const conv of almacen.todas()) {
      if (!candidata(conv) || soloRecurso(conv)) continue; // a quien solo comentó no le escribe el dueño a mano
      const h = horasDesde(conv.ultimoMensajeLeadAt);
      const numero = h >= 72 && h < 144 && !conv.seguimientos?.s2 ? 2 : h >= 144 && h < 168 && !conv.seguimientos?.s3 ? 3 : null;
      if (!numero) continue;
      try {
        const { texto, coste } = await redactarSeguimiento(conv, numero);
        almacen.registrarCoste(coste);
        conv.seguimientos[`s${numero}`] = new Date().toISOString();
        almacen.guardar(conv);
        lista.push({ conv, numero, texto });
      } catch (error) {
        log.error(`[seguimiento ${numero}] ${conv.id}: ${error.message}`);
      }
    }
    if (lista.length) await enviarEmail(construirEmailSeguimientos(lista));
    return lista.length;
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
    almacen.registrarCoste(coste);
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
      await emailSeguimientos();
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

  return { cadaCincoMinutos, seguimientosAutomaticos, kpiInbound, informeDudas, emailSeguimientos, resumenSemanal, limpiezaDiaria };
}
