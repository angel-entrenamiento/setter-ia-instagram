// Simulador por terminal: hablas como si fueras un lead y el asistente responde, sin Instagram.
// Usa el conocimiento y los ajustes de mi-conocimiento/ (npm run conocimiento -- bajar) o, si no existen, las plantillas.
// Uso: npm run simulador   (o: node src/simulador.js --modelo sonnet)
import readline from "node:readline/promises";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { config, RAIZ } from "./config.js";
import { negocio, cargarNegocioLocal } from "./negocio.js";
import { conversacionNueva } from "./almacen/conversaciones.js";
import { procesarEvento, aplicarEtiqueta, redactarSeguimiento, reiniciar } from "./motor.js";
import { fichaEnTexto, nombreAutor } from "./avisos/emails.js";

cargarNegocioLocal();
const A = negocio.nombreAsistente.toUpperCase();

const c = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  azul: (t) => `\x1b[36m${t}\x1b[0m`,
  amarillo: (t) => `\x1b[33m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
};

const args = process.argv.slice(2);
let modelo = args.includes("--modelo") ? args[args.indexOf("--modelo") + 1] : config.modelo;
let esfuerzo = config.esfuerzo;
let verEmailsCompletos = false;
let costeTotal = 0;

const conv = conversacionNueva({
  id: "simulador",
  igUsuario: "prueba",
  nombre: "Prueba",
  origen: "espontaneo",
});

const AYUDA = `
${c.negrita("Escribe como si fueras un lead.")} Comandos:
  /audio                     el lead envía un audio
  /imagen [texto]            el lead envía una imagen
  /historia <texto>          el lead responde a una historia
  /yo <texto>                tú (el dueño) escribes un mensaje manual
  /yo-audio                  tú (el dueño) contestas con un audio
  /nota <dijo> | <contesté>  apuntas qué dijo en el audio (y qué contestaste)
  /etiqueta IA_PAUSA|IA_ON|ALUMNO    /quitar-etiqueta <ETIQUETA>
  /seguimiento 1|2|3         redacta un seguimiento
  /nombre <nombre>  /usuario <usuario>  /origen <espontaneo|info|precio|anuncio|historia|recurso|bienvenida>
  /modelo opus|sonnet   /esfuerzo low|medium|high
  /ficha  /estado  /emails (ver completos o resumidos)
  #reset o /reset            reinicia la conversación
  /guardar                   guarda la conversación en informes/simulaciones
  /salir
`;

function mostrarResultado(r) {
  if (r.reset) return console.log(c.verde(`${A}: ${r.respuestas[0]}`));
  if (r.ignorado) console.log(c.gris(`  (${negocio.nombreAsistente} no responde: ${r.ignorado})`));
  for (const b of r.respuestas) console.log(c.verde(`${A}: ${b}`));
  if (r.respuestas.length) console.log(c.gris(`  (en real esperaría ${r.retrasoSeg} s antes de enviar)`));
  for (const p of r.problemas ?? []) {
    const color = p.bloqueante ? c.rojo : c.amarillo;
    console.log(color(`  ⚠ ${p.bloqueante ? "BLOQUEADO" : "aviso"} [${p.tipo}] ${p.detalle}`));
  }
  for (const e of r.emails) {
    console.log(c.azul(`  ✉ EMAIL de aviso: ${e.asunto}`));
    if (verEmailsCompletos) console.log(c.gris(e.cuerpo.replace(/^/gm, "    ")));
  }
  if (r.salida) {
    console.log(c.gris(`  estado=${r.salida.estado} · acción=${r.salida.accion} · nota: ${r.salida.nota_interna}`));
  }
  if (r.coste) {
    costeTotal += r.coste;
    const cache = r.uso?.cache_read_input_tokens ? ` · caché ${r.uso.cache_read_input_tokens} tk` : "";
    console.log(c.gris(`  coste turno ${r.coste.toFixed(4)} $ · total ${costeTotal.toFixed(4)} $${cache}`));
  }
  if (conv.pausa) console.log(c.amarillo(`  ⏸ ${negocio.nombreAsistente} está PAUSADO en esta conversación (${conv.pausa.motivo})`));
}

function guardar() {
  const dir = path.join(RAIZ, "informes", "simulaciones");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}_${modelo}.md`);
  const lineas = conv.historial
    .filter((m) => m.tipo !== "nota")
    .map((m) => `**${nombreAutor(m.rol)}:** ${m.tipo !== "texto" ? `[${m.tipo}] ` : ""}${m.texto}`);
  fs.writeFileSync(archivo, `# Simulación (${modelo})\n\n${lineas.join("\n\n")}\n\n## Ficha\n\n${fichaEnTexto(conv.ficha)}\n`);
  console.log(c.gris(`  Guardado en ${archivo}`));
}

async function ejecutar(evento) {
  try {
    mostrarResultado(await procesarEvento(conv, evento, { modelo, esfuerzo, simulacion: true }));
  } catch (error) {
    console.log(c.rojo(`  Error: ${error.message}`));
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(c.rojo("Falta ANTHROPIC_API_KEY. Copia .env.example como .env y pega tu clave de la API de Anthropic."));
    process.exit(1);
  }
  console.log(c.negrita(`\nSimulador de ${negocio.nombreAsistente} · modelo ${modelo} · esfuerzo ${esfuerzo} · usuario @${conv.igUsuario}`));
  console.log(AYUDA);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  while (true) {
    const linea = (await rl.question(c.negrita("TÚ (lead): "))).trim();
    if (!linea) continue;
    const [cmd, ...resto] = linea.split(" ");
    const arg = resto.join(" ").trim();
    switch (cmd.toLowerCase()) {
      case "/salir":
        rl.close();
        return;
      case "/ayuda":
        console.log(AYUDA);
        break;
      case "/audio":
        await ejecutar({ tipo: "audio" });
        break;
      case "/imagen":
        await ejecutar({ tipo: "imagen", texto: arg });
        break;
      case "/historia":
        await ejecutar({ tipo: "historia", texto: arg });
        break;
      case "/yo":
        await ejecutar({ tipo: "dueno_texto", texto: arg });
        console.log(c.gris(conv.pausa ? `  Pausado (${conv.pausa.motivo})` : "  Activo"));
        break;
      case "/yo-audio":
        await ejecutar({ tipo: "dueno_audio" });
        console.log(c.gris(conv.pausa ? `  Pausado (${conv.pausa.motivo})` : "  Activo: seguirá cuando el lead escriba"));
        break;
      case "/nota": {
        const [queDijo, queContesto] = arg.split("|").map((s) => s.trim());
        await ejecutar({ tipo: "nota_audio", queDijo, queContesto });
        console.log(c.gris("  Nota guardada"));
        break;
      }
      case "/etiqueta":
        aplicarEtiqueta(conv, arg);
        console.log(c.gris(`  Etiquetas: ${conv.etiquetas.join(", ") || "—"} · ${conv.pausa ? `pausado (${conv.pausa.motivo})` : "activo"}`));
        break;
      case "/quitar-etiqueta":
        aplicarEtiqueta(conv, arg, { quitar: true });
        console.log(c.gris(`  Etiquetas: ${conv.etiquetas.join(", ") || "—"} · ${conv.pausa ? `pausado (${conv.pausa.motivo})` : "activo"}`));
        break;
      case "/seguimiento": {
        const { texto, coste } = await redactarSeguimiento(conv, Number(arg) || 1, { modelo });
        costeTotal += coste;
        console.log(c.verde(`SEGUIMIENTO ${arg || 1}: ${texto}`));
        break;
      }
      case "/nombre":
        conv.nombre = arg;
        break;
      case "/usuario":
        conv.igUsuario = arg.replace(/^@/, "").toLowerCase();
        console.log(c.gris(`  Ahora escribes como @${conv.igUsuario}`));
        break;
      case "/origen":
        conv.origen = arg;
        break;
      case "/modelo":
        modelo = arg;
        console.log(c.gris(`  Modelo: ${modelo}`));
        break;
      case "/esfuerzo":
        esfuerzo = arg;
        break;
      case "/ficha":
        console.log(c.gris(fichaEnTexto(conv.ficha)));
        break;
      case "/estado":
        console.log(c.gris(`  estado=${conv.estado} · pausa=${conv.pausa?.motivo ?? "no"} · cerrada=${conv.cerrada} · etiquetas=${conv.etiquetas.join(",") || "—"}`));
        break;
      case "/emails":
        verEmailsCompletos = !verEmailsCompletos;
        console.log(c.gris(`  Emails ${verEmailsCompletos ? "completos" : "resumidos"}`));
        break;
      case "/reset":
        reiniciar(conv);
        console.log(c.verde(`${A}: 🔄 Conversación reiniciada.`));
        break;
      case "/guardar":
        guardar();
        break;
      default:
        if (cmd.startsWith("/")) console.log(c.amarillo("  Comando desconocido. Escribe /ayuda"));
        else await ejecutar({ tipo: "texto", texto: linea });
    }
  }
}

main();
