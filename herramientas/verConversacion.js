// Muestra conversaciones reales del panel (con horas) para analizarlas o educar al asistente con Claude Code.
//   npm run conversaciones                → las 10 últimas, resumidas
//   npm run conversaciones -- laura       → las que coinciden con "laura" (nombre o usuario), completas
// Necesita en el .env: URL_PUBLICA y PANEL_CLAVE.
import "dotenv/config";

const base = (process.env.URL_PUBLICA ?? "").replace(/\/+$/, "");
const auth = "Basic " + Buffer.from(`${process.env.PANEL_USUARIO || "admin"}:${process.env.PANEL_CLAVE ?? ""}`).toString("base64");
if (!base.startsWith("http") || !process.env.PANEL_CLAVE) {
  console.error("Falta URL_PUBLICA o PANEL_CLAVE en el .env.");
  process.exit(1);
}

const buscar = process.argv[2] ?? "";
const r = await fetch(`${base}/panel/api/conversaciones?limite=${buscar ? 20 : 10}&buscar=${encodeURIComponent(buscar)}`, {
  headers: { authorization: auth },
});
if (!r.ok) throw new Error(`El panel ha respondido ${r.status}`);
const hora = (iso) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

for (const c of await r.json()) {
  console.log(`\n=== ${c.ficha?.nombre || c.nombre || "Sin nombre"} @${c.igUsuario ?? "?"} · estado ${c.estado}${c.pausa ? ` · pausa ${c.pausa.motivo}` : ""} ===`);
  const mensajes = buscar ? c.historial : c.historial.slice(-8);
  for (const m of mensajes) console.log(`[${hora(m.fecha)}] ${m.rol.toUpperCase()}: ${m.tipo !== "texto" ? `[${m.tipo}] ` : ""}${m.texto}${m.resumen ? ` — ${m.resumen}` : ""}`);
}
