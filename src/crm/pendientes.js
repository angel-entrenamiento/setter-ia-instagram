// «Te toca a ti»: lo que depende del dueño para no perder citas. Se calcula al momento.
// 1. Leads esperando su respuesta: conversaciones que el asistente ha pasado al dueño (agendar, humano, alerta,
//    audio, error) y cuyo último mensaje es del lead. Instagram solo deja contestar hasta 24 h después.
// 2. Llamadas propuestas sin fecha: filas de Entrevistas sin fecha de entrevista ni decisión.
// 3. Llamadas pasadas sin marcar si se presentó, y presentados sin marcar si entran.

const SI = (v) => v === true || v === 1 || v === "1" || v === "si";
const MOTIVOS = {
  agendar: "Quiere la llamada: proponle día y hora",
  humano: "Pide hablar contigo",
  alerta: "Revisa la conversación (alerta)",
  audio: "Te ha mandado un audio",
  error: "El asistente no pudo responder",
};
const HORA = 3600000;

/**
 * @param {{ conversaciones: object[], entrevistas: object[], hoy: string, ahora?: number, esPrueba?: (c: object) => boolean }} op
 */
export function calcularPendientes({ conversaciones, entrevistas, hoy, ahora = Date.now(), esPrueba = () => false }) {
  const nombreDe = (c) => c.ficha?.nombre || c.nombre || "Sin nombre";
  const esperan = [];
  for (const c of conversaciones) {
    if (String(c.id).startsWith("panel:") || esPrueba(c) || !c.pausa || !MOTIVOS[c.pausa.motivo]) continue;
    const ultimo = c.historial?.at(-1);
    if (ultimo?.rol !== "lead") continue;
    const desde = Date.parse(c.ultimoMensajeLeadAt ?? ultimo.fecha ?? c.actualizadaAt);
    const horas = Number.isNaN(desde) ? null : Math.max(0, (ahora - desde) / HORA);
    esperan.push({
      convId: c.id,
      nombre: nombreDe(c),
      igUsuario: c.igUsuario || "",
      motivo: c.pausa.motivo,
      que: MOTIVOS[c.pausa.motivo],
      ultimo: String(ultimo.texto ?? "").slice(0, 140),
      horas: horas === null ? null : Math.round(horas * 10) / 10,
      quedan: horas === null ? null : Math.round((24 - horas) * 10) / 10,
    });
  }
  // Las que caducan antes (menos horas para contestar), primero; las ya caducadas, al final
  esperan.sort((a, b) => ((a.quedan ?? 99) < 0) - ((b.quedan ?? 99) < 0) || (a.quedan ?? 99) - (b.quedan ?? 99));
  const yaEsperan = new Set(esperan.map((e) => e.convId));

  const decidida = (f) => Boolean(f.estado) || SI(f.entra) || SI(f.no_entra);
  const fila = (f) => ({ id: f.id, nombre: f.nombre || "Sin nombre", convId: f.convId || null, procedencia: f.procedencia || "", fecha_entrevista: f.fecha_entrevista || "", que_dice: f.que_dice || "" });
  const diasDesde = (f) => (f.creada ? Math.floor((ahora - f.creada) / (24 * HORA)) : null);

  const sinFecha = entrevistas
    .filter((f) => !f.fecha_entrevista && !decidida(f) && !(f.convId && yaEsperan.has(f.convId)))
    .map((f) => ({ ...fila(f), dias: diasDesde(f) }))
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
  const sinMarcar = entrevistas
    .filter((f) => f.fecha_entrevista && f.fecha_entrevista <= hoy && !SI(f.presentado) && !SI(f.no_presentado) && !decidida(f))
    .map(fila)
    .sort((a, b) => a.fecha_entrevista.localeCompare(b.fecha_entrevista));
  const sinDecidir = entrevistas
    .filter((f) => SI(f.presentado) && !decidida(f))
    .map(fila)
    .sort((a, b) => a.fecha_entrevista.localeCompare(b.fecha_entrevista));

  return { esperan, sinFecha, sinMarcar, sinDecidir, total: esperan.length + sinFecha.length + sinMarcar.length + sinDecidir.length };
}
