// Tablero de leads: cada persona que ha contestado, en la etapa a la que ha llegado. Sirve también para
// «dónde se paran»: desde el Embudo se abre la etapa con las conversaciones que se quedaron ahí.
import { diaPrimeraRespuesta, viaDeConversacion, MENSAJES_CONVERSACION, DIAS_ACTIVA } from "./metricas.js";

const SI = (v) => v === true || v === 1 || v === "1" || v === "si";
const ESTADOS_CUALIFICADO = ["cualificado", "propuesta_llamada", "cierre"];

/** Etapas del tablero, en orden. «clave» coincide con los pasos del Embudo. */
export const ETAPAS = [
  { clave: "respondieron", nombre: "Respondió" },
  { clave: "conversaciones", nombre: "+2 contactos" },
  { clave: "cualificados", nombre: "Cualificado" },
  { clave: "propuestas", nombre: "Llamada propuesta" },
  { clave: "agendadas", nombre: "Cita agendada" },
  { clave: "presentados", nombre: "Se presentó" },
  { clave: "clientes", nombre: "Cliente" },
  { clave: "descartados", nombre: "Descartado" },
];

/** Etapa a la que ha llegado una conversación (con su fila de Entrevistas, si la tiene). */
export function etapaDe(conv, fila) {
  if (fila) {
    if (SI(fila.entra)) return "clientes";
    if (SI(fila.no_entra) || fila.estado === "No hablar" || SI(fila.no_presentado)) return "descartados";
    if (SI(fila.presentado)) return "presentados";
    if (fila.fecha_entrevista) return "agendadas";
    return "propuestas";
  }
  if (conv.estado === "fuera_de_foco") return "descartados";
  if (ESTADOS_CUALIFICADO.includes(conv.estado)) return "cualificados";
  if ((conv.historial ?? []).filter((m) => m.rol === "lead").length >= MENSAJES_CONVERSACION) return "conversaciones";
  return "respondieron";
}

/**
 * Leads (conversaciones en las que la persona ha escrito), con su etapa, por el día de su primera respuesta.
 * @param {{ conversaciones: object[], entrevistas: object[], diaEn: (f: Date) => string, desde: string, hasta: string,
 *           ahora?: number, esPrueba?: (c: object) => boolean }} op
 */
export function calcularLeads({ conversaciones, entrevistas, diaEn, desde, hasta, ahora = Date.now(), esPrueba = () => false }) {
  const filaDe = new Map(entrevistas.filter((f) => f.convId).map((f) => [f.convId, f]));
  const leads = [];
  for (const c of conversaciones) {
    if (String(c.id).startsWith("panel:") || esPrueba(c)) continue;
    const dia = diaPrimeraRespuesta(c, diaEn);
    if (!dia || dia < desde || dia > hasta) continue;
    const ultimo = c.historial.at(-1);
    const fechaUltimo = Date.parse(ultimo?.fecha ?? c.actualizadaAt);
    leads.push({
      convId: c.id,
      nombre: c.ficha?.nombre || c.nombre || "Sin nombre",
      igUsuario: c.igUsuario || "",
      via: viaDeConversacion(c),
      etapa: etapaDe(c, filaDe.get(c.id)),
      desde: dia,
      mensajesLead: c.historial.filter((m) => m.rol === "lead").length,
      nivel: c.ficha?.nivel_cualificacion || "",
      situacion: String(c.ficha?.situacion ?? "").slice(0, 120),
      ultimo: { rol: ultimo?.rol ?? "", texto: String(ultimo?.texto ?? "").slice(0, 120) },
      diasSinActividad: Number.isNaN(fechaUltimo) ? null : Math.floor((ahora - fechaUltimo) / 86400000),
      pausa: c.pausa?.motivo || "",
    });
  }
  // Lo más reciente primero dentro de cada etapa
  leads.sort((a, b) => (a.diasSinActividad ?? 999) - (b.diasSinActividad ?? 999));
  const porEtapa = Object.fromEntries(ETAPAS.map((e) => [e.clave, 0]));
  for (const l of leads) porEtapa[l.etapa]++;
  return { desde, hasta, etapas: ETAPAS, porEtapa, leads };
}

/** Etapas en las que la conversación aún está viva (sin cita, sin cliente y sin descartar). */
const ETAPAS_ACTIVAS = ["respondieron", "conversaciones", "cualificados", "propuestas"];

/**
 * Conversaciones activas AHORA: el lead ha escrito en los últimos DIAS_ACTIVA días y todavía no tiene cita,
 * no es cliente ni está descartado. No depende del periodo elegido.
 * @returns {{ total: number, porVia: Record<string, number>, dias: number }}
 */
export function conversacionesActivas({ conversaciones, entrevistas, ahora = Date.now(), esPrueba = () => false }) {
  const filaDe = new Map(entrevistas.filter((f) => f.convId).map((f) => [f.convId, f]));
  const porVia = { bienvenida: 0, lead_magnet: 0, inbound: 0 };
  let total = 0;
  for (const c of conversaciones) {
    if (String(c.id).startsWith("panel:") || esPrueba(c)) continue;
    const ultimoLead = (c.historial ?? []).filter((m) => m.rol === "lead").at(-1);
    const fecha = Date.parse(ultimoLead?.fecha ?? "");
    if (Number.isNaN(fecha) || ahora - fecha > DIAS_ACTIVA * 86400000) continue;
    if (!ETAPAS_ACTIVAS.includes(etapaDe(c, filaDe.get(c.id)))) continue;
    total++;
    porVia[viaDeConversacion(c)]++;
  }
  return { total, porVia, dias: DIAS_ACTIVA };
}
