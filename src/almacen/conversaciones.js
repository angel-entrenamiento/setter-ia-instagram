// Memoria de conversaciones en memoria (simulador y pruebas). El servidor usa AlmacenSqlite, con la misma interfaz.
import fs from "node:fs";
import path from "node:path";
import { FICHA_VACIA } from "../cerebro/esquema.js";

export function conversacionNueva({ id, igUsuario = "", igId = "", nombre = "", origen = "espontaneo", recurso = "" }) {
  const ahora = new Date().toISOString();
  return {
    id,
    igUsuario: igUsuario.replace(/^@/, "").toLowerCase(),
    igId,
    nombre,
    origen, // espontaneo | recurso | anuncio | historia | bienvenida | info | precio
    recurso,
    estado: "nuevo",
    pausa: null, // { motivo: agendar|audio|manual|humano|alerta|alumno|etiqueta|error, desde }
    etiquetas: [],
    ficha: structuredClone(FICHA_VACIA),
    historial: [], // { rol: lead|bot|dueno|sistema, tipo: texto|audio|imagen|historia|nota, texto, fecha }
    presentado: false,
    enlacePagoEnviado: false,
    cerrada: false,
    ultimoMensajeLeadAt: null,
    seguimientos: { s0: null, s1: null, s2: null, s3: null },
    avisos: [], // avisos internos para el modelo en el próximo turno
    creadaAt: ahora,
    actualizadaAt: ahora,
  };
}

export class AlmacenMemoria {
  constructor({ archivo = null } = {}) {
    this.archivo = archivo;
    this.mapa = new Map();
    if (archivo && fs.existsSync(archivo)) {
      for (const c of JSON.parse(fs.readFileSync(archivo, "utf8"))) this.mapa.set(c.id, c);
    }
  }

  obtener(id) {
    return this.mapa.get(id) ?? null;
  }

  obtenerOCrear(datos) {
    return this.obtener(datos.id) ?? this.guardar(conversacionNueva(datos));
  }

  guardar(conv) {
    conv.actualizadaAt = new Date().toISOString();
    this.mapa.set(conv.id, conv);
    this.#persistir();
    return conv;
  }

  borrar(id) {
    this.mapa.delete(id);
    this.#persistir();
  }

  todas() {
    return [...this.mapa.values()];
  }

  #persistir() {
    if (!this.archivo) return;
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true });
    fs.writeFileSync(this.archivo, JSON.stringify(this.todas(), null, 2));
  }
}
