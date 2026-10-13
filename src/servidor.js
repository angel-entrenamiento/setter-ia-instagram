// Servidor del setter: recibe los mensajes de ManyChat (y de Meta si se activa), procesa la cola, ejecuta las tareas
// y sirve el panel donde cada dueño configura, prueba y educa a su asistente. Arranque: npm start
import http from "node:http";
import { config } from "./config.js";
import { negocio, cargarNegocio, guardarNegocio, fijarModoPrueba } from "./negocio.js";
import { AlmacenSqlite } from "./almacen/sqlite.js";
import * as manychat from "./integraciones/manychat.js";
import { enviarEmail, comprobarEmail } from "./integraciones/email.js";
import { verificarSuscripcion, firmaValida, extraerEventos } from "./integraciones/meta.js";
import { crearOrquestador } from "./orquestador.js";
import { crearTareas } from "./tareas.js";
import { procesarEvento, aplicarEtiqueta, reiniciar, enListaBlanca } from "./motor.js";
import { firmaCorrecta } from "./utilidades/enlaces.js";
import { paginaPrivacidad, paginaBorradoDatos } from "./paginasLegales.js";
import { clienteAnthropic } from "./cerebro/llm.js";
import { construirPrompt } from "./cerebro/prompt.js";
import { SECCIONES, usarAlmacenConocimiento, guardarSeccion, restaurarAnterior, todoElConocimiento } from "./cerebro/conocimiento.js";
import { crearConocimientoConIA, proponerCorreccion, leerPropuesta, aplicarPropuesta } from "./panel/educar.js";
import * as P from "./panel/paginas.js";
import { licenciaPermite, estadoLicencia, comprobarLicencia } from "./licencia.js";

const ID_PRUEBA = "panel:prueba";

const MENSAJES = {
  guardado: "✅ Guardado. Se aplica desde la próxima respuesta.",
  deshecho: "↩ Has vuelto a la versión anterior.",
  creado: "✨ Conocimiento creado. Repasa cada sección (busca los [RELLENAR] que queden) y prueba a tu asistente en «Probar».",
  ajustes: "✅ Ajustes guardados.",
};

export function crearServidor({ almacen, manychat: mc = manychat, enviarEmail: email = enviarEmail } = {}) {
  cargarNegocio(almacen);
  usarAlmacenConocimiento(almacen);
  const orq = crearOrquestador({ almacen, manychat: mc, enviarEmail: email });
  const tareas = crearTareas({ almacen, manychat: mc, enviarEmail: email });

  // ---------- Utilidades HTTP ----------
  const leerCuerpo = (req) =>
    new Promise((ok, mal) => {
      const trozos = [];
      let tam = 0;
      req.on("data", (c) => {
        tam += c.length;
        if (tam > 2_000_000) req.destroy(new Error("cuerpo demasiado grande"));
        trozos.push(c);
      });
      req.on("end", () => ok(Buffer.concat(trozos)));
      req.on("error", mal);
    });
  const leerFormulario = async (req) => new URLSearchParams((await leerCuerpo(req)).toString("utf8"));
  const leerJson = async (req) => JSON.parse((await leerCuerpo(req)).toString("utf8") || "{}");

  const responder = (res, codigo, cuerpo, tipo = "application/json; charset=utf-8") => {
    res.writeHead(codigo, { "Content-Type": tipo });
    res.end(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
  };
  const html = (res, cuerpo, codigo = 200) => responder(res, codigo, cuerpo, "text/html; charset=utf-8");
  const redirigir = (res, destino) => {
    res.writeHead(303, { Location: destino });
    res.end();
  };
  const paginaError = (titulo, detalle, vuelta = "/panel") =>
    P.pagina(titulo, `<h1>${P.esc(titulo)}</h1><div class="tarjeta mal">${P.esc(detalle)}</div><p><a href="${vuelta}">← Volver</a></p>`);

  function autorizadoPanel(req) {
    if (!config.panelClave) return false;
    const [tipo, valor] = (req.headers.authorization ?? "").split(" ");
    if (tipo !== "Basic" || !valor) return false;
    const [u, ...c] = Buffer.from(valor, "base64").toString().split(":");
    return u === config.panelUsuario && c.join(":") === config.panelClave;
  }

  async function accionConversacion(conv, form) {
    const accion = form.get("accion");
    if (accion === "pausar") {
      aplicarEtiqueta(conv, "IA_PAUSA");
      if (conv.manychatId) await mc.ponerEtiqueta(conv.manychatId, "IA_PAUSA").catch(() => {});
    } else if (accion === "reactivar") {
      aplicarEtiqueta(conv, "IA_ON");
      if (conv.manychatId) await mc.quitarEtiqueta(conv.manychatId, "IA_PAUSA").catch(() => {});
    } else if (accion === "reiniciar" && enListaBlanca(conv)) {
      reiniciar(conv);
    } else if (accion === "nota") {
      return guardarNota(conv, form);
    }
    almacen.guardar(conv);
  }

  /** Nota de audio: la apunta y, si el asistente estaba pausado por el audio, lo reactiva (el dueño ya ha contestado). */
  async function guardarNota(conv, form) {
    await procesarEvento(conv, { tipo: "nota_audio", queDijo: form.get("queDijo"), queContesto: form.get("queContesto") });
    if (conv.pausa?.motivo === "audio") {
      conv.pausa = null;
      conv.avisos.push(
        `${negocio.nombreDueno || "El dueño"} ha contestado personalmente al audio. Sigue a partir de lo que dice su nota, sin contradecirle. Si no hay nota de lo que contestó, sé prudente y haz una pregunta abierta.`,
      );
    }
    almacen.guardar(conv);
  }

  // ---------- Probar desde el panel (no envía nada a nadie) ----------
  function conversacionDePrueba() {
    return almacen.obtenerOCrear({ id: ID_PRUEBA, igUsuario: "prueba", nombre: "Prueba" });
  }

  async function turnoDePrueba(form) {
    const conv = conversacionDePrueba();
    const accion = form.get("accion");
    const texto = (form.get("texto") ?? "").trim();
    let r = null;
    try {
      if (accion === "reiniciar") reiniciar(conv);
      else if (accion === "audio") r = await procesarEvento(conv, { tipo: "audio" }, { simulacion: true });
      else if (accion === "dueno" && texto) r = await procesarEvento(conv, { tipo: "dueno_texto", texto }, { simulacion: true });
      else if (texto) r = await procesarEvento(conv, { tipo: "texto", texto }, { simulacion: true });
    } catch (error) {
      r = { error: error.message };
    }
    almacen.guardar(conv);
    if (r) {
      if (r.coste) almacen.registrarCoste(r.coste);
      if (r.respuestas?.length && !almacen.ajuste("probado_panel")) almacen.fijarAjuste("probado_panel", new Date().toISOString());
      const { salida, problemas, emails, coste, ignorado, error } = r;
      almacen.fijarAjuste("probar_ultimo", JSON.stringify({ salida, problemas, emails, coste, ignorado, error }));
    } else almacen.fijarAjuste("probar_ultimo", "null");
  }

  async function comprobarClaves() {
    const resultados = [];
    if (!process.env.ANTHROPIC_API_KEY) resultados.push([false, "Anthropic: falta ANTHROPIC_API_KEY"]);
    else
      await clienteAnthropic()
        .models.retrieve("claude-opus-5-5")
        .then(() => resultados.push([true, "Anthropic: clave correcta"]))
        .catch((e) => resultados.push([false, `Anthropic: ${e.message}`]));
    if (!config.manychatApiKey) resultados.push([false, "ManyChat: falta MANYCHAT_API_KEY"]);
    else
      await mc
        .comprobarClave()
        .then((d) => resultados.push([true, `ManyChat: clave correcta (cuenta: ${d?.name ?? "?"})`]))
        .catch((e) => resultados.push([false, `ManyChat: ${e.message}`]));
    await comprobarEmail()
      .then((via) => resultados.push([true, `Email: enviado un correo de prueba a ${config.emailAvisos} (vía ${via}). Revisa tu bandeja y el spam.`]))
      .catch((e) => resultados.push([false, `Email: ${e.message}`]));
    return resultados;
  }

  function conversacionesParaApi(buscar, limite) {
    const b = (buscar ?? "").toLowerCase();
    return almacen
      .todas()
      .filter((c) => c.historial.length)
      .filter((c) => !b || [c.nombre, c.igUsuario, c.ficha?.nombre, c.id].some((x) => String(x ?? "").toLowerCase().includes(b)))
      .slice(0, limite)
      .map(({ id, nombre, igUsuario, estado, pausa, ficha, historial, origen, actualizadaAt }) => ({
        id, nombre, igUsuario, estado, pausa, origen, actualizadaAt, ficha, historial,
      }));
  }

  // ---------- Rutas del panel (con contraseña) ----------
  async function manejarPanel(req, res, ruta, url) {
    const m = (re) => ruta.match(re);
    const metodo = req.method;
    const aviso = MENSAJES[url.searchParams.get("m")] ?? "";

    if (ruta === "/panel/licencia" && metodo === "POST") {
      await comprobarLicencia(almacen, { cuenta: negocio.cuentaInstagram, url: config.urlPublica });
      return redirigir(res, "/panel");
    }
    if (!licenciaPermite()) return html(res, P.htmlSinLicencia(estadoLicencia()), 403);

    if (ruta === "/panel") return html(res, P.htmlInicio(almacen));

    if (ruta === "/panel/modo" && metodo === "POST") {
      const form = await leerFormulario(req);
      fijarModoPrueba(almacen, form.get("activo") !== "no");
      return redirigir(res, "/panel#modo");
    }

    let r;
    if ((r = m(/^\/panel\/c\/([^/]+)$/))) {
      const conv = almacen.obtener(decodeURIComponent(r[1]));
      if (!conv) return responder(res, 404, "No encontrada", "text/plain; charset=utf-8");
      if (metodo === "POST") {
        await accionConversacion(conv, await leerFormulario(req));
        return redirigir(res, ruta);
      }
      return html(res, P.htmlConversacion(conv));
    }

    if (ruta === "/panel/probar") {
      if (metodo === "POST") {
        await turnoDePrueba(await leerFormulario(req));
        return redirigir(res, "/panel/probar");
      }
      let ultimo = null;
      try {
        ultimo = JSON.parse(almacen.ajuste("probar_ultimo") ?? "null");
      } catch {}
      return html(res, P.htmlProbar(conversacionDePrueba(), ultimo));
    }

    if (ruta === "/panel/conocimiento") return html(res, P.htmlConocimiento(aviso));
    if ((r = m(/^\/panel\/conocimiento\/([\w.-]+)$/))) {
      const archivo = r[1];
      if (!SECCIONES.some((s) => s.archivo === archivo)) return responder(res, 404, "No existe", "text/plain; charset=utf-8");
      if (metodo === "POST") {
        const form = await leerFormulario(req);
        if (form.get("accion") === "deshacer") restaurarAnterior(archivo);
        else guardarSeccion(archivo, form.get("texto"));
        return redirigir(res, `${ruta}?m=${form.get("accion") === "deshacer" ? "deshecho" : "guardado"}`);
      }
      return html(res, P.htmlEditarSeccion(archivo, aviso));
    }
    if (ruta === "/panel/prompt") return html(res, P.htmlPrompt(construirPrompt()));

    if (ruta === "/panel/crear") {
      let respuestas = {};
      try {
        respuestas = JSON.parse(almacen.ajuste("cuestionario") ?? "{}");
      } catch {}
      if (metodo === "POST") {
        const form = await leerFormulario(req);
        respuestas = Object.fromEntries(form.entries());
        almacen.fijarAjuste("cuestionario", JSON.stringify(respuestas));
        if (respuestas.bienvenida?.trim() && !negocio.bienvenidaManual)
          guardarNegocio(almacen, { ...negocio, bienvenidaManual: respuestas.bienvenida.trim() });
        try {
          const { coste } = await crearConocimientoConIA(respuestas);
          almacen.registrarCoste(coste);
        } catch (error) {
          console.error(`[panel] crear conocimiento: ${error.message}`);
          return html(res, paginaError("No se ha podido crear el conocimiento", error.message, "/panel/crear"), 500);
        }
        return redirigir(res, "/panel/conocimiento?m=creado");
      }
      return html(res, P.htmlCrear(respuestas));
    }

    if (ruta === "/panel/educar" && metodo === "POST") {
      const form = await leerFormulario(req);
      const conv = almacen.obtener(form.get("convId") ?? "");
      const comentario = (form.get("comentario") ?? "").trim();
      const vuelta = form.get("vuelta") || "/panel";
      if (!conv || !comentario) return redirigir(res, vuelta);
      try {
        const propuesta = await proponerCorreccion(almacen, conv, comentario);
        almacen.registrarCoste(propuesta.coste);
        return redirigir(res, `/panel/propuesta/${propuesta.id}`);
      } catch (error) {
        console.error(`[panel] educar: ${error.message}`);
        return html(res, paginaError("No se ha podido preparar la corrección", error.message, vuelta), 500);
      }
    }
    if ((r = m(/^\/panel\/propuesta\/([0-9a-f]+)$/))) {
      const propuesta = leerPropuesta(almacen, r[1]);
      if (!propuesta) return responder(res, 404, "Propuesta no encontrada", "text/plain; charset=utf-8");
      if (metodo === "POST" && !propuesta.aplicada) {
        const indices = (await leerFormulario(req)).getAll("c").map(Number);
        const resultado = aplicarPropuesta(almacen, propuesta, indices);
        return html(res, P.htmlPropuesta(leerPropuesta(almacen, r[1]), resultado));
      }
      return html(res, P.htmlPropuesta(propuesta));
    }

    if (ruta === "/panel/ajustes") {
      if (metodo === "POST") {
        guardarNegocio(almacen, await leerFormulario(req));
        return redirigir(res, "/panel/ajustes?m=ajustes");
      }
      return html(res, P.htmlAjustes(aviso));
    }
    if (ruta === "/panel/comprobar" && metodo === "POST") return html(res, P.htmlAjustes("", await comprobarClaves()));
    if (ruta === "/panel/manychat") return html(res, P.htmlManychat(almacen));

    // --- API para Claude Code (herramientas/*.js) ---
    if (ruta === "/panel/api/conocimiento") {
      if (metodo === "POST") {
        const datos = await leerJson(req).catch(() => null);
        if (!datos || typeof datos !== "object") return responder(res, 400, { error: "json" });
        const cambiados = [];
        for (const [archivo, texto] of Object.entries(datos)) {
          if (!SECCIONES.some((s) => s.archivo === archivo) || typeof texto !== "string") continue;
          if (guardarSeccion(archivo, texto)) cambiados.push(archivo);
        }
        return responder(res, 200, { ok: true, cambiados });
      }
      return responder(res, 200, todoElConocimiento());
    }
    if (ruta === "/panel/api/conversaciones")
      return responder(res, 200, conversacionesParaApi(url.searchParams.get("buscar"), Number(url.searchParams.get("limite") ?? 30)));
    if (ruta === "/panel/api/ajustes") return responder(res, 200, negocio);

    return responder(res, 404, "No existe", "text/plain; charset=utf-8");
  }

  // ---------- Rutas ----------
  async function manejar(req, res) {
    const url = new URL(req.url, "http://x");
    const ruta = url.pathname;

    if (ruta === "/salud") return responder(res, 200, { ok: true, modoPrueba: config.modoPrueba, modelo: config.modelo });
    if (ruta === "/privacidad") return html(res, paginaPrivacidad());
    if (ruta === "/eliminacion-datos") return html(res, paginaBorradoDatos());

    if (ruta === "/webhook/meta" && req.method === "GET") {
      const reto = verificarSuscripcion(url.searchParams);
      return reto ? responder(res, 200, reto, "text/plain") : responder(res, 403, "no", "text/plain");
    }
    if (ruta === "/webhook/meta" && req.method === "POST") {
      const crudo = await leerCuerpo(req);
      if (!firmaValida(crudo, req.headers["x-hub-signature-256"])) {
        console.warn("[meta] aviso rechazado: firma no válida");
        return responder(res, 403, { error: "firma" });
      }
      responder(res, 200, { ok: true }); // Meta exige respuesta rápida
      let cuerpo;
      try {
        cuerpo = JSON.parse(crudo.toString("utf8"));
      } catch {
        return;
      }
      for (const ev of extraerEventos(cuerpo)) {
        // Registro sin contenido (RGPD): solo tipo, si es eco y los últimos dígitos del ID
        console.log(`[meta] evento tipo=${ev.tipo} eco=${ev.esEco} contacto=…${ev.igsid.slice(-4)}`);
        await orq.recibirEventoMeta(ev).catch((e) => console.error(`[meta] ${e.stack ?? e.message}`));
      }
      return;
    }

    if (ruta === "/manychat/mensaje" && req.method === "POST") {
      const token = req.headers["x-token"] ?? url.searchParams.get("token");
      if (!config.tokenManychatEntrada || token !== config.tokenManychatEntrada) {
        console.warn(`[manychat] petición rechazada: token ${token ? "incorrecto" : "ausente"}`);
        return responder(res, 403, { error: "token" });
      }
      let datos = {};
      const crudo = (await leerCuerpo(req)).toString("utf8");
      try {
        datos = JSON.parse(crudo || "{}");
      } catch {
        console.warn(`[manychat] petición rechazada: JSON no válido (${crudo.length} caracteres)`);
        return responder(res, 400, { error: "json" });
      }
      if (!datos.subscriber_id) {
        console.warn("[manychat] petición rechazada: falta subscriber_id");
        return responder(res, 400, { error: "falta subscriber_id" });
      }
      if (!almacen.ajuste("manychat_recibido")) almacen.fijarAjuste("manychat_recibido", new Date().toISOString());
      responder(res, 200, { ok: true }); // ManyChat corta a los 10 s: contestamos ya y procesamos después
      orq
        .recibirMensajeManychat({
          subscriberId: datos.subscriber_id,
          texto: datos.texto,
          origen: datos.origen,
          recurso: datos.recurso,
        })
        .catch((e) => console.error(`[manychat] mensaje: ${e.message}`));
      return;
    }

    if (ruta === "/manychat/contacto" && req.method === "POST") {
      const token = req.headers["x-token"] ?? url.searchParams.get("token");
      if (!config.tokenManychatEntrada || token !== config.tokenManychatEntrada) return responder(res, 403, { error: "token" });
      let datos = {};
      try {
        datos = JSON.parse((await leerCuerpo(req)).toString("utf8") || "{}");
      } catch {
        return responder(res, 400, { error: "json" });
      }
      responder(res, 200, { ok: true }); // ManyChat corta a los 10 s: contestamos ya
      orq
        .registrarContactoManychat({
          subscriberId: datos.subscriber_id,
          origen: datos.origen,
          recurso: datos.recurso,
          ultimoTexto: datos.texto,
        })
        .catch((e) => console.error(`[manychat] contacto: ${e.message}`));
      return;
    }

    const nota = ruta.match(/^\/nota\/([^/]+)\/([0-9a-f]+)$/);
    if (nota) {
      const id = decodeURIComponent(nota[1]);
      if (!firmaCorrecta(`nota:${id}`, nota[2])) return responder(res, 403, "Enlace no válido", "text/plain; charset=utf-8");
      const conv = almacen.obtener(id);
      if (!conv) return responder(res, 404, "Conversación no encontrada", "text/plain; charset=utf-8");
      if (req.method === "POST") {
        await guardarNota(conv, await leerFormulario(req));
        return html(res, P.htmlNota(conv, true));
      }
      return html(res, P.htmlNota(conv, false));
    }

    if (ruta === "/panel" || ruta.startsWith("/panel/")) {
      if (!config.panelClave) {
        return html(
          res,
          P.pagina("Falta la contraseña", `<h1>Falta la contraseña del panel</h1><div class="tarjeta">En Railway, abre tu servicio → <b>Variables</b> y añade <span class="copiar">PANEL_CLAVE</span> con la contraseña que quieras. Tu usuario será <span class="copiar">${P.esc(config.panelUsuario)}</span>.</div>`),
          503,
        );
      }
      if (!autorizadoPanel(req)) {
        res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Panel del setter", charset="UTF-8"' });
        return res.end("Acceso restringido");
      }
      return manejarPanel(req, res, ruta, url);
    }

    if (ruta === "/") return redirigir(res, "/panel");
    return responder(res, 404, { error: "no existe" });
  }

  const servidor = http.createServer((req, res) => {
    manejar(req, res).catch((e) => {
      console.error(`[http] ${e.stack ?? e.message}`);
      if (!res.headersSent) responder(res, 500, { error: "interno" });
    });
  });

  return { servidor, orq, tareas };
}

export { AlmacenSqlite };
