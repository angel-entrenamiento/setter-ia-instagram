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

servidor.listen(3999, () => console.log("CRM de prueba en http://localhost:3999/panel/crm (admin / prueba)"));
