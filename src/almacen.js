// Datos del CRM en la misma base SQLite del setter (tablas crm_*). Empieza vacío.
// - crm_kpi: contador por día y columna (Outbound, Inbound…). El asistente suma solo; la persona puede corregir a mano.
// - crm_notas: textos libres (objetivo del mes, "Escribir próxima semana", observaciones…).
// - crm_filas: filas de Entrevistas, Ventas, Lead magnets y Feedback (columnas en JSON, ver opciones.js).

const TABLAS = ["entrevista", "venta", "lead_magnet", "feedback"];

export function crearAlmacenCrm(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_kpi (fecha TEXT, campo TEXT, valor INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (fecha, campo));
    CREATE TABLE IF NOT EXISTS crm_notas (clave TEXT PRIMARY KEY, texto TEXT);
    CREATE TABLE IF NOT EXISTS crm_filas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tabla TEXT NOT NULL, periodo TEXT NOT NULL,
      datos TEXT NOT NULL DEFAULT '{}', conv_id TEXT, origen TEXT NOT NULL DEFAULT 'manual', creada INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS crm_filas_periodo ON crm_filas (tabla, periodo);
  `);

  const leerFila = (f) => (f ? { id: f.id, tabla: f.tabla, periodo: f.periodo, convId: f.conv_id, origen: f.origen, ...JSON.parse(f.datos) } : null);

  return {
    // ---------- Conversaciones (KPI diarios) ----------
    sumarKpi(fecha, campo, n = 1) {
      db.prepare(
        "INSERT INTO crm_kpi (fecha, campo, valor) VALUES (?, ?, ?) ON CONFLICT (fecha, campo) DO UPDATE SET valor = MAX(0, valor + excluded.valor)",
      ).run(fecha, campo, n);
    },
    fijarKpi(fecha, campo, valor) {
      if (valor === null || valor === "" || valor === undefined) {
        db.prepare("DELETE FROM crm_kpi WHERE fecha = ? AND campo = ?").run(fecha, campo);
        return;
      }
      db.prepare("INSERT INTO crm_kpi (fecha, campo, valor) VALUES (?, ?, ?) ON CONFLICT (fecha, campo) DO UPDATE SET valor = excluded.valor").run(
        fecha,
        campo,
        Math.max(0, Math.round(Number(valor) || 0)),
      );
    },
    /** { "2026-10-15": { inbound: 3, outbound: 50 }, … } del año indicado */
    kpisDelAnio(anio) {
      const res = {};
      for (const f of db.prepare("SELECT fecha, campo, valor FROM crm_kpi WHERE fecha LIKE ?").all(`${anio}-%`)) {
        (res[f.fecha] ??= {})[f.campo] = f.valor;
      }
      return res;
    },

    // ---------- Notas ----------
    nota(clave) {
      return db.prepare("SELECT texto FROM crm_notas WHERE clave = ?").get(clave)?.texto ?? "";
    },
    fijarNota(clave, texto) {
      db.prepare("INSERT INTO crm_notas VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET texto = excluded.texto").run(clave, String(texto ?? ""));
    },
    notasDelAnio(anio) {
      return Object.fromEntries(
        db
          .prepare("SELECT clave, texto FROM crm_notas WHERE clave LIKE ?")
          .all(`%${anio}%`)
          .map((n) => [n.clave, n.texto]),
      );
    },

    // ---------- Filas (Entrevistas, Ventas, Lead magnets, Feedback) ----------
    crearFila(tabla, periodo, datos = {}, { convId = null, origen = "manual" } = {}) {
      if (!TABLAS.includes(tabla)) throw new Error(`Tabla desconocida: ${tabla}`);
      const r = db
        .prepare("INSERT INTO crm_filas (tabla, periodo, datos, conv_id, origen, creada) VALUES (?, ?, ?, ?, ?, ?)")
        .run(tabla, periodo, JSON.stringify(datos), convId, origen, Date.now());
      return this.fila(Number(r.lastInsertRowid));
    },
    fila(id) {
      return leerFila(db.prepare("SELECT * FROM crm_filas WHERE id = ?").get(id));
    },
    /** Cambia campos de una fila; devuelve { antes, despues }. */
    actualizarFila(id, cambios, periodo) {
      const antes = this.fila(id);
      if (!antes) return null;
      const { id: _i, tabla: _t, periodo: _p, convId: _c, origen: _o, ...datos } = antes;
      const nuevos = { ...datos, ...cambios };
      db.prepare("UPDATE crm_filas SET datos = ?, periodo = ? WHERE id = ?").run(JSON.stringify(nuevos), periodo ?? antes.periodo, id);
      return { antes, despues: this.fila(id) };
    },
    borrarFila(id) {
      const antes = this.fila(id);
      db.prepare("DELETE FROM crm_filas WHERE id = ?").run(id);
      return antes;
    },
    filasDelAnio(anio) {
      return db
        .prepare("SELECT * FROM crm_filas WHERE periodo LIKE ? ORDER BY periodo, id")
        .all(`${anio}%`)
        .map(leerFila);
    },
    filaDeConversacion(tabla, convId) {
      return leerFila(db.prepare("SELECT * FROM crm_filas WHERE tabla = ? AND conv_id = ? ORDER BY id DESC LIMIT 1").get(tabla, convId));
    },
  };
}
