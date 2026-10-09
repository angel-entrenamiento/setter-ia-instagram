// Sincroniza el conocimiento entre tu panel (Railway) y la carpeta mi-conocimiento/ de tu ordenador.
//   npm run conocimiento -- bajar   → descarga el conocimiento y los ajustes del panel a mi-conocimiento/
//   npm run conocimiento -- subir   → sube al panel los cambios de mi-conocimiento/*.md (se aplican al momento)
// Necesita en el .env: URL_PUBLICA y PANEL_CLAVE (y PANEL_USUARIO si no es "admin").
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA = path.join(RAIZ, "mi-conocimiento");
const base = (process.env.URL_PUBLICA ?? "").replace(/\/+$/, "");
const auth = "Basic " + Buffer.from(`${process.env.PANEL_USUARIO || "admin"}:${process.env.PANEL_CLAVE ?? ""}`).toString("base64");

if (!base.startsWith("http") || !process.env.PANEL_CLAVE) {
  console.error("Falta URL_PUBLICA o PANEL_CLAVE en el .env (copia .env.example como .env y rellénalo).");
  process.exit(1);
}

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${base}${ruta}`, { ...opciones, headers: { authorization: auth, "content-type": "application/json", ...opciones.headers } });
  if (r.status === 401) throw new Error("Usuario o contraseña del panel incorrectos");
  if (!r.ok) throw new Error(`${ruta} → ${r.status}`);
  return r.json();
}

const orden = process.argv[2];
if (orden === "bajar") {
  fs.mkdirSync(CARPETA, { recursive: true });
  const secciones = await pedir("/panel/api/conocimiento");
  for (const [archivo, texto] of Object.entries(secciones)) fs.writeFileSync(path.join(CARPETA, archivo), `${texto}\n`);
  fs.writeFileSync(path.join(CARPETA, "ajustes.json"), JSON.stringify(await pedir("/panel/api/ajustes"), null, 2));
  console.log(`✅ Descargadas ${Object.keys(secciones).length} secciones y los ajustes en ${CARPETA}`);
} else if (orden === "subir") {
  if (!fs.existsSync(CARPETA)) throw new Error("No existe mi-conocimiento/: primero ejecuta «npm run conocimiento -- bajar»");
  const datos = Object.fromEntries(
    fs
      .readdirSync(CARPETA)
      .filter((a) => /^\d\d_.*\.md$/.test(a))
      .map((a) => [a, fs.readFileSync(path.join(CARPETA, a), "utf8")]),
  );
  const r = await pedir("/panel/api/conocimiento", { method: "POST", body: JSON.stringify(datos) });
  console.log(r.cambiados.length ? `✅ Actualizadas en el panel: ${r.cambiados.join(", ")}` : "Sin cambios: el panel ya tenía lo mismo.");
} else {
  console.log("Uso: npm run conocimiento -- bajar   |   npm run conocimiento -- subir");
}
