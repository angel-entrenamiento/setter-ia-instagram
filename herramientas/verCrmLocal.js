// Abre el panel en local con una base de datos temporal y datos de ejemplo, para ver el CRM sin tocar ningún setter real.
// node herramientas/verCrmLocal.js   → http://localhost:3999/panel/crm (usuario admin / clave prueba). No usa claves ni IA.
import os from "node:os";
import path from "node:path";
import { config } from "../src/config.js";
import { AlmacenSqlite } from "../src/almacen/sqlite.js";
import { crearServidor } from "../src/servidor.js";
import { guardarNegocio } from "../src/negocio.js";

Object.assign(config, { panelUsuario: "admin", panelClave: "prueba" });
const almacen = new AlmacenSqlite(path.join(os.tmpdir(), `crm-prueba-${Date.now()}.db`));
const { servidor, crm } = crearServidor({ almacen, manychat: {}, enviarEmail: async () => {} });
guardarNegocio(almacen, { nombreAsistente: "Lucía", nombreDueno: "Marta", modoPrueba: true });

// Datos de ejemplo (inventados) solo para ver el diseño
const c = almacen.obtenerOCrear({ id: "demo1" });
Object.assign(c, {
  origen: "espontaneo",
  nombre: "Ejemplo",
  igUsuario: "lead.ejemplo",
  ficha: { ...c.ficha, nombre: "Ejemplo", situacion: "Quiere ponerse en forma tras el embarazo", objetivo: "volver a correr", objeciones: ["precio"], preferencia_franja: "tarde" },
});
c.historial.push({ rol: "lead", tipo: "texto", texto: "hola" });
almacen.guardar(c);
crm.registrar("inbound", c);
crm.registrar("agendada", c);
crm.almacen.fijarKpi(crm.datos(String(new Date().getFullYear())).hoy, "outbound", 40);

// Diez semanas de bienvenidas y respuestas inventadas para ver el Resumen y el Embudo con datos
let semilla = 7;
const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
for (let d = 1; d <= 70; d++) {
  const fecha = new Date(Date.now() - d * 86400000);
  crm.almacen.fijarKpi(fecha.toISOString().slice(0, 10), "outbound", 15 + Math.round(azar() * 20));
  for (let r = 0; r < 2 + Math.round(azar() * 4); r++) {
    const b = almacen.obtenerOCrear({ id: `demo-b-${d}-${r}`, origen: "bienvenida" });
    const mensajes = azar() < 0.5 ? 1 : 3 + Math.round(azar() * 4);
    for (let m = 0; m < mensajes; m++) b.historial.push({ rol: "lead", tipo: "texto", texto: "hola", fecha: fecha.toISOString() });
    b.primerMensajeAt = fecha.toISOString();
    if (mensajes >= 3 && azar() < 0.4) b.estado = "cualificado";
    almacen.guardar(b);
    if (b.estado === "cualificado" && azar() < 0.5) {
      // El setter propone la llamada ese día; algunas quedan agendadas al día siguiente y se hacen 3 días después
      const dia = (dd) => new Date(fecha.getTime() + dd * 86400000).toISOString().slice(0, 10);
      const f = crm.almacen.crearFila("entrevista", dia(0).slice(0, 7), { nombre: `Ejemplo ${d}-${r}`, procedencia: "Outbound" }, { origen: "asistente" });
      almacen.db.prepare("UPDATE crm_filas SET creada = ? WHERE id = ?").run(fecha.getTime(), f.id);
      const vino = azar() < 0.8;
      if (azar() < 0.7) crm.almacen.actualizarFila(f.id, { fecha_entrevista: dia(3), _agendadaEn: dia(1), presentado: vino ? 1 : 0, no_presentado: vino ? 0 : 1, entra: vino && azar() < 0.4 ? 1 : 0 }, dia(3).slice(0, 7));
    }
  }
}

// Para «Te toca a ti»: dos personas esperando al dueño y una llamada propuesta sin fecha
for (const [id, nombre, motivo, horas, texto] of [["demo-esp1", "Laura", "agendar", 3, "Mejor por la tarde, a partir de las 6"], ["demo-esp2", "Pablo", "humano", 21, "¿Puedo hablar directamente con Marta?"]]) {
  const e = almacen.obtenerOCrear({ id, origen: "bienvenida" });
  Object.assign(e, { nombre, igUsuario: nombre.toLowerCase() + ".run", pausa: { motivo, desde: new Date().toISOString() }, ultimoMensajeLeadAt: new Date(Date.now() - horas * 3600000).toISOString() });
  e.historial.push({ rol: "lead", tipo: "texto", texto, fecha: e.ultimoMensajeLeadAt });
  almacen.guardar(e);
}
const sinFecha = crm.almacen.crearFila("entrevista", crm.datos("2026").hoy.slice(0, 7), { nombre: "Marta @marta.trail", procedencia: "Outbound", que_dice: "Dolor de rodilla al bajar cuestas · Objetivo: volver a correr 10 km" }, { origen: "asistente" });
almacen.db.prepare("UPDATE crm_filas SET creada = ? WHERE id = ?").run(Date.now() - 4 * 86400000, sinFecha.id);

crm.almacen.fijarNota("objetivo_agendas_semana", "5");

// Ejemplo de chat con ficha para ver la pantalla de una conversación (/panel/c/demo-chat)
const chat = almacen.obtenerOCrear({ id: "demo-chat", origen: "bienvenida" });
Object.assign(chat, { nombre: "Andrea", igUsuario: "andrea.trail", ficha: { ...chat.ficha, nombre: "Andrea", situacion: "Dolor en la rodilla derecha al bajar cuestas", desde_cuando: "3 meses", probado: "Fisio y descanso", objetivo: "Volver a correr 10 km sin dolor", nivel_cualificacion: "alto", preferencia_franja: "tarde" } });
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
chat.historial.push(
  { rol: "bot", tipo: "texto", texto: "¡Hola Andrea! Gracias por seguirme. ¿Qué te trae por aquí, corres o estás con alguna lesión?", fecha: hace(90) },
  { rol: "lead", tipo: "texto", texto: "Hola! Me duele la rodilla al bajar cuestas desde hace 3 meses", fecha: hace(80) },
  { rol: "bot", tipo: "texto", texto: "Vaya, 3 meses es bastante. ¿Qué has probado hasta ahora?", fecha: hace(79) },
  { rol: "lead", tipo: "texto", texto: "Fui al fisio y descansé, pero al volver a correr vuelve", fecha: hace(60) },
  { rol: "dueno", tipo: "texto", texto: "Andrea, soy Marta. Te paso el enlace para la valoración 👇", fecha: hace(30) },
);
chat.primerMensajeAt = hace(80);
almacen.guardar(chat);

servidor.listen(3999, () => console.log("CRM de prueba en http://localhost:3999/panel/crm (admin / prueba)"));
