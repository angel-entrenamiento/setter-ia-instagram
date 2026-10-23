// Almacén persistente en SQLite (node:sqlite, sin dependencias). Misma interfaz que AlmacenMemoria
// más lo que necesita el servidor: cola de procesamiento, control de duplicados y métricas.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { conversacionNueva } from "./conversaciones.js";

const normalizar = (t) => (t ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);

export class AlmacenSqlite {
  constructor(archivo) {
    if (archivo !== ":memory:") fs.mkdirSync(path.dirname(archivo), { recursive: true });
    this.db = new DatabaseSync(archivo);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS conversaciones (
        id TEXT PRIMARY KEY,
        manychat_id TEXT,
        ig_usuario TEXT,
        datos TEXT NOT NULL,
        procesar_en INTEGER,
        actualizada INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conv_manychat ON conversaciones(manychat_id);
      CREATE INDEX IF NOT EXISTS idx_conv_procesar ON conversaciones(procesar_en);
      CREATE TABLE IF NOT EXISTS enviados (conv_id TEXT, texto TEXT, fecha INTEGER);
      CREATE INDEX IF NOT EXISTS idx_enviados ON enviados(conv_id, fecha);
      CREATE TABLE IF NOT EXISTS procesados (mid TEXT PRIMARY KEY, fecha INTEGER);
      CREATE TABLE IF NOT EXISTS eventos (tipo TEXT, conv_id TEXT, fecha INTEGER);
      CREATE INDEX IF NOT EXISTS idx_eventos ON eventos(tipo, fecha);
      CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT);
      CREATE TABLE IF NOT EXISTS costes (usd REAL, fecha INTEGER);
    `);
    // Instalaciones anteriores: la tabla de costes no tenía el tipo de gasto (respuestas, seguimientos, panel…)
    if (!this.db.prepare("PRAGMA table_info(costes)").all().some((c) => c.name === "tipo")) {
      this.db.exec("ALTER TABLE costes ADD COLUMN tipo TEXT");
    }
  }

  // ---------- Conversaciones ----------
  #leer(fila) {
    return fila ? JSON.parse(fila.datos) : null;
  }

  obtener(id) {
    return this.#leer(this.db.prepare("SELECT datos FROM conversaciones WHERE id = ?").get(id));
  }

  obtenerPorManychat(manychatId) {
    return this.#leer(
      this.db.prepare("SELECT datos FROM conversaciones WHERE manychat_id = ?").get(String(manychatId)),
    );
  }

  obtenerOCrear(datos) {
    return this.obtener(datos.id) ?? this.guardar(conversacionNueva(datos));
  }

  guardar(conv) {
    conv.actualizadaAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO conversaciones (id, manychat_id, ig_usuario, datos, procesar_en, actualizada)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET manychat_id = excluded.manychat_id, ig_usuario = excluded.ig_usuario,
           datos = excluded.datos, procesar_en = excluded.procesar_en, actualizada = excluded.actualizada`,
      )
      .run(
        conv.id,
        conv.manychatId ? String(conv.manychatId) : null,
        conv.igUsuario || null,
        JSON.stringify(conv),
        conv.procesarEn ?? null,
        Date.now(),
      );
    return conv;
  }

  borrar(id) {
    this.db.prepare("DELETE FROM conversaciones WHERE id = ?").run(id);
  }

  todas() {
    return this.db
      .prepare("SELECT datos FROM conversaciones ORDER BY actualizada DESC")
      .all()
      .map((f) => JSON.parse(f.datos));
  }

  pendientesDeProcesar(ahora = Date.now()) {
    return this.db
      .prepare("SELECT datos FROM conversaciones WHERE procesar_en IS NOT NULL AND procesar_en <= ?")
      .all(ahora)
      .map((f) => JSON.parse(f.datos));
  }

  /** RGPD: borra conversaciones sin actividad en N días. Devuelve cuántas. */
  borrarInactivas(dias) {
    const limite = Date.now() - dias * 86400000;
    return Number(this.db.prepare("DELETE FROM conversaciones WHERE actualizada < ?").run(limite).changes);
  }

  // ---------- Mensajes enviados por el asistente (para reconocer sus ecos) ----------
  registrarEnviado(convId, texto) {
    this.db.prepare("INSERT INTO enviados VALUES (?, ?, ?)").run(convId, normalizar(texto), Date.now());
  }

  /** ¿Este eco es un mensaje que envió el asistente? (lo consume para no confundirlo dos veces) */
  esEcoDelAsistente(convId, texto) {
    const fila = this.db
      .prepare("SELECT rowid FROM enviados WHERE conv_id = ? AND texto = ? AND fecha > ? LIMIT 1")
      .get(convId, normalizar(texto), Date.now() - 2 * 3600000);
    if (!fila) return false;
    this.db.prepare("DELETE FROM enviados WHERE rowid = ?").run(fila.rowid);
    return true;
  }

  // ---------- Duplicados de webhooks (Meta reintenta) ----------
  yaProcesado(mid) {
    if (!mid) return false;
    const r = this.db.prepare("INSERT OR IGNORE INTO procesados VALUES (?, ?)").run(mid, Date.now());
    return Number(r.changes) === 0;
  }

  // ---------- Métricas ----------
  registrarEvento(tipo, convId) {
    this.db.prepare("INSERT INTO eventos VALUES (?, ?, ?)").run(tipo, convId, Date.now());
  }

  contarEventos(desde, hasta = Date.now()) {
    const filas = this.db
      .prepare(
        "SELECT tipo, COUNT(DISTINCT conv_id) AS n FROM eventos WHERE fecha >= ? AND fecha < ? GROUP BY tipo",
      )
      .all(desde, hasta);
    return Object.fromEntries(filas.map((f) => [f.tipo, Number(f.n)]));
  }

  /** @param {"respuestas"|"seguimientos"|"panel"|"informes"} tipo en qué se ha gastado */
  registrarCoste(usd, tipo = "otros") {
    if (!usd) return;
    this.db.prepare("INSERT INTO costes (usd, fecha, tipo) VALUES (?, ?, ?)").run(usd, Date.now(), tipo);
  }

  /** { respuestas: 12.3, seguimientos: 4.1, … } entre dos fechas */
  costePorTipo(desde, hasta = Date.now()) {
    const filas = this.db
      .prepare("SELECT COALESCE(tipo, 'otros') AS tipo, SUM(usd) AS s FROM costes WHERE fecha >= ? AND fecha < ? GROUP BY 1")
      .all(desde, hasta);
    return Object.fromEntries(filas.map((f) => [f.tipo, Number(f.s)]));
  }

  sumarCoste(desde, hasta = Date.now()) {
    return Number(
      this.db.prepare("SELECT COALESCE(SUM(usd), 0) AS s FROM costes WHERE fecha >= ? AND fecha < ?").get(desde, hasta).s,
    );
  }

  // ---------- Ajustes (última ejecución de tareas) ----------
  ajuste(clave) {
    return this.db.prepare("SELECT valor FROM ajustes WHERE clave = ?").get(clave)?.valor ?? null;
  }

  fijarAjuste(clave, valor) {
    this.db
      .prepare("INSERT INTO ajustes VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor")
      .run(clave, String(valor));
  }

  /** Limpieza periódica de tablas auxiliares. */
  limpiar() {
    const hace = (dias) => Date.now() - dias * 86400000;
    this.db.prepare("DELETE FROM enviados WHERE fecha < ?").run(hace(2));
    this.db.prepare("DELETE FROM procesados WHERE fecha < ?").run(hace(7));
    this.db.prepare("DELETE FROM eventos WHERE fecha < ?").run(hace(400));
    this.db.prepare("DELETE FROM costes WHERE fecha < ?").run(hace(400));
  }
}
