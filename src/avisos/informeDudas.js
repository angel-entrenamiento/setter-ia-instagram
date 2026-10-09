// Informe semanal (jueves 9:00): preguntas frecuentes, dudas y miedos de los leads, para crear contenido.
import { config, idModelo } from "../config.js";
import { pedirTexto } from "../cerebro/llm.js";
import { negocio, dueno } from "../negocio.js";

const DIA = 24 * 3600 * 1000;
const MAX_CARACTERES = 150_000; // ~40.000 tokens: de sobra para una semana

/** Junta lo que escribieron los leads en los últimos 7 días (sin nombres ni usuarios). */
export function recogerMensajesSemana(conversaciones, ahora = Date.now()) {
  const desde = ahora - 7 * DIA;
  const bloques = [];
  let n = 0;
  for (const conv of conversaciones) {
    const delLead = conv.historial.filter(
      (m) => m.rol === "lead" && m.tipo === "texto" && m.texto?.trim() && Date.parse(m.fecha) >= desde,
    );
    if (!delLead.length) continue;
    n++;
    const contexto = conv.ficha?.situacion ? `situación: ${conv.ficha.situacion.slice(0, 120)}` : "";
    bloques.push(`--- Persona ${n}${contexto ? ` (${contexto})` : ""}\n${delLead.map((m) => `- ${m.texto.trim()}`).join("\n")}`);
  }
  let texto = bloques.join("\n");
  if (texto.length > MAX_CARACTERES) texto = texto.slice(0, MAX_CARACTERES);
  return { texto, personas: n };
}

export async function construirInformeDudas(conversaciones, { desde, hasta }) {
  const { texto, personas } = recogerMensajesSemana(conversaciones, +hasta);
  const fmt = (d) => d.toLocaleDateString("es-ES", { timeZone: config.zonaHoraria, day: "numeric", month: "short" });
  const asunto = `[DUDAS DE LA SEMANA] Ideas de contenido (${fmt(desde)} – ${fmt(hasta)})`;
  if (!personas) {
    return {
      email: { etiqueta: "DUDAS", para: config.emailAvisos, asunto, cuerpo: "Esta semana ningún lead ha escrito por MD, así que no hay dudas que analizar." },
      coste: 0,
    };
  }
  const { texto: informe, coste } = await pedirTexto({
    model: idModelo(config.modelo),
    system:
      `Eres analista de contenido de ${dueno()}${negocio.nombreNegocio ? ` (${negocio.nombreNegocio}${negocio.cuentaInstagram ? `, @${negocio.cuentaInstagram}` : ""})` : ""}.${negocio.aQueSeDedica ? ` A qué se dedica: ${negocio.aQueSeDedica}.` : ""} Analizas lo que escriben por MD de Instagram sus leads para que cree contenido (reels, carruseles, historias) que responda a sus dudas reales. Escribes en español, claro y directo, en texto plano para un email (sin markdown: nada de asteriscos ni almohadillas; usa MAYÚSCULAS para los títulos y guiones para las listas).`,
    mensajes: [
      {
        role: "user",
        content: `Estos son los mensajes que escribieron ${personas} personas por MD esta semana (solo lo que escribieron ellas, sin nombres).

Haz un informe con estas secciones:
1. PREGUNTAS Y DUDAS MÁS FRECUENTES: agrupa las que se repiten, de más a menos frecuente, indicando cuántas personas aproximadamente. Para cada una, 1-2 frases tal y como las escribieron (literales y anónimas: quita nombres, ciudades o datos que identifiquen).
2. MIEDOS Y CREENCIAS QUE SE REPITEN (por ejemplo, "esto no es para mí", "ya lo he probado todo", "no tengo tiempo").
3. OBJECIONES Y FRENOS (precio, tiempo, desconfianza, ya probó de todo…).
4. CÓMO DESCRIBEN SU PROBLEMA CON SUS PROPIAS PALABRAS: expresiones literales que sirvan para ganchos y titulares.
5. IDEAS DE CONTENIDO: entre 5 y 8 ideas concretas, cada una con formato (reel, carrusel o historia), un gancho para los primeros 3 segundos y qué duda responde.

No inventes nada que no salga de los mensajes. Si una sección no tiene material suficiente, dilo en una línea. Si hay pocas personas, el informe puede ser corto.

MENSAJES:
${texto}`,
      },
    ],
    max_tokens: 8000,
    esfuerzo: "medium",
  });
  return {
    email: {
      etiqueta: "DUDAS",
      para: config.emailAvisos,
      asunto,
      cuerpo: `Basado en los mensajes de ${personas} persona${personas === 1 ? "" : "s"} que escribieron por MD esta semana.\n\n${informe}`,
    },
    coste,
  };
}
