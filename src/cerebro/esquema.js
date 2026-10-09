import { z } from "zod";

export const ESTADOS = [
  "descubriendo",
  "cualificado",
  "propuesta_llamada",
  "low_ticket",
  "fuera_de_foco",
  "cierre",
  "alerta",
  "humano",
];

export const ACCIONES = ["ninguna", "traspaso_agendar", "alerta", "humano", "enviar_link_pago", "cerrar"];

const texto = z.string();
const opciones = (valores) => z.enum(valores);
const SI_NO = ["si", "no", "desconocido"];

export const FichaSchema = z.object({
  nombre: texto,
  situacion: texto,
  encaja_perfil: opciones(SI_NO),
  desde_cuando: texto,
  afectacion: texto,
  probado: texto,
  objetivo: texto,
  prioridad_1a10: z.number().int().min(0).max(10),
  dispuesto_implicarse: opciones(SI_NO),
  decisor_economico: texto,
  decisor_en_llamada: opciones(["no_hace_falta", "acordado", "pendiente", ""]),
  escribe_familiar: z.boolean(),
  pais_zona_horaria: texto,
  preferencia_franja: opciones(["mañana", "tarde", ""]),
  objeciones: z.array(texto),
  senales_alarma: z.array(texto),
  nivel_cualificacion: opciones(["alto", "medio", "bajo", "dudoso"]),
  apto_producto_barato: opciones(SI_NO),
  datos_extra: texto,
});

export const SalidaSchema = z.object({
  mensajes: z.array(texto),
  estado: z.enum(ESTADOS),
  accion: z.enum(ACCIONES),
  ficha: FichaSchema,
  nota_interna: texto,
});

export const FICHA_VACIA = Object.freeze({
  nombre: "",
  situacion: "",
  encaja_perfil: "desconocido",
  desde_cuando: "",
  afectacion: "",
  probado: "",
  objetivo: "",
  prioridad_1a10: 0,
  dispuesto_implicarse: "desconocido",
  decisor_economico: "",
  decisor_en_llamada: "",
  escribe_familiar: false,
  pais_zona_horaria: "",
  preferencia_franja: "",
  objeciones: [],
  senales_alarma: [],
  nivel_cualificacion: "dudoso",
  apto_producto_barato: "desconocido",
  datos_extra: "",
});

// JSON Schema equivalente para la salida estructurada de la API (output_config.format)
const s = { type: "string" };
const en = (valores) => ({ type: "string", enum: valores });

export const SALIDA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mensajes", "estado", "accion", "ficha", "nota_interna"],
  properties: {
    mensajes: { type: "array", items: s },
    estado: en(ESTADOS),
    accion: en(ACCIONES),
    nota_interna: s,
    ficha: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(FICHA_VACIA),
      properties: {
        nombre: s,
        situacion: s,
        encaja_perfil: en(SI_NO),
        desde_cuando: s,
        afectacion: s,
        probado: s,
        objetivo: s,
        prioridad_1a10: { type: "integer" },
        dispuesto_implicarse: en(SI_NO),
        decisor_economico: s,
        decisor_en_llamada: en(["no_hace_falta", "acordado", "pendiente", ""]),
        escribe_familiar: { type: "boolean" },
        pais_zona_horaria: s,
        preferencia_franja: en(["mañana", "tarde", ""]),
        objeciones: { type: "array", items: s },
        senales_alarma: { type: "array", items: s },
        nivel_cualificacion: en(["alto", "medio", "bajo", "dudoso"]),
        apto_producto_barato: en(SI_NO),
        datos_extra: s,
      },
    },
  },
};
