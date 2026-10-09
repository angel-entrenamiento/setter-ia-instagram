// Genera informes/prompt_actual.md con el system prompt completo que recibe el asistente.
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../config.js";
import { construirPrompt } from "../cerebro/prompt.js";
import { cargarNegocioLocal } from "../negocio.js";

cargarNegocioLocal();

const prompt = construirPrompt();
const destino = path.join(RAIZ, "informes", "prompt_actual.md");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, prompt);
console.log(`Prompt: ${prompt.length} caracteres (~${Math.round(prompt.length / 3.5)} tokens). Guardado en ${destino}`);
