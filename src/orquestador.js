// Orquestador: une los avisos de Meta (oído), la API de ManyChat (boca), el motor (cerebro) y los emails.
// - Agrupa los mensajes seguidos del lead y aplica el retraso "humano" antes de responder.
// - Distingue los ecos (lo que envía la cuenta): los del asistente se ignoran; los del dueño se anotan.
// - Sincroniza las etiquetas de ManyChat (IA_PAUSA, IA_ON, ALUMNO) antes de cada respuesta.
import { config } from "./config.js";
import { procesarEvento, anotarMensajeLead, aplicarEtiqueta, enListaBlanca, anotarRecursoEnviado } from "./motor.js";
import { construirEmail } from "./avisos/emails.js";
import { negocio } from "./negocio.js";

const TIPO_MOTOR = {
  texto: "texto",
  historia: "historia",
  imagen: "imagen",
};
const DESCRIPCION_ADJUNTO = {
  video: "[Ha enviado un vídeo]",
  compartido: "[Ha compartido una publicación]",
  reel: "[Ha compartido un reel]",
  mencion: "[Te ha mencionado en una historia]",
  archivo: "[Ha enviado un archivo]",
  otro: "[Ha enviado un contenido que no se puede leer]",
};

const normalizar = (t) => (t ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function crearOrquestador({ almacen, manychat, enviarEmail, log = console }) {
  const enCurso = new Set(); // conversaciones que se están procesando (evita dobles respuestas)
  const contactosSinVincular = []; // contactos de ManyChat a la espera de su evento de Meta (sin ig_id)
  const excluidosEnPrueba = new Set(); // IDs de Instagram que no están en la lista blanca (solo modo prueba)

  async function mandarEmails(emails) {
    for (const e of emails) await enviarEmail(e);
  }

  function aleatorio(min, max) {
    return min + Math.random() * (max - min);
  }

  // ---------- Vinculación ManyChat ↔ Instagram ----------

  /** Llamado por el bloque "Petición externa" de ManyChat. Vincula el contacto y guarda su origen. */
  async function registrarContactoManychat({ subscriberId, origen, recurso, ultimoTexto }) {
    const info = await manychat.infoContacto(subscriberId);
    if (config.modoPrueba && !config.listaBlanca.includes(info.igUsuario)) {
      // En pruebas no guardamos a nadie más; recordamos su ID para descartar al momento sus mensajes de Meta
      if (info.igId) excluidosEnPrueba.add(info.igId);
      if (info.igId) almacen.borrar(info.igId);
      return null;
    }
    let conv = almacen.obtenerPorManychat(info.manychatId) ?? (info.igId ? almacen.obtener(info.igId) : null);
    // Con ENTRADA=manychat no hay eventos de Meta que esperar: la conversación se crea aquí (mismo id que en recibirMensajeManychat)
    if (!conv && config.entrada === "manychat") conv = almacen.obtenerOCrear({ id: info.igId || `mc:${info.manychatId}` });
    if (!conv && ultimoTexto) {
      // Sin ig_id: buscamos la conversación de Meta reciente con ese mismo texto y sin vincular
      const t = normalizar(ultimoTexto);
      conv = almacen
        .todas()
        .find(
          (c) =>
            !c.manychatId &&
            Date.now() - Date.parse(c.actualizadaAt) < 10 * 60000 &&
            [...(c.bandeja ?? []), ...c.historial].some((m) => m.rol !== "bot" && normalizar(m.texto) === t),
        );
    }
    if (!conv && info.igId) conv = almacen.obtenerOCrear({ id: info.igId });
    if (!conv) {
      contactosSinVincular.push({ info, origen, recurso, texto: normalizar(ultimoTexto), fecha: Date.now() });
      return null;
    }
    vincular(conv, info, origen, recurso);
    if (origen === "recurso") {
      // Disparador de ManyChat por comentario: le ha llegado el MD automático → seguimientos a las 8 y 24 h si no contesta
      if (info.etiquetas?.includes("ALUMNO")) aplicarEtiqueta(conv, "ALUMNO");
      else if (info.etiquetas?.includes("IA_PAUSA")) aplicarEtiqueta(conv, "IA_PAUSA");
      anotarRecursoEnviado(conv, recurso);
      log.info?.(`[manychat] recurso enviado por disparador contacto=…${String(subscriberId).slice(-4)}`);
    }
    almacen.guardar(conv);
    return conv;
  }

  function vincular(conv, info, origen, recurso) {
    conv.manychatId = info.manychatId;
    conv.igUsuario = info.igUsuario || conv.igUsuario;
    conv.igId = info.igId || conv.igId;
    conv.nombre = info.nombre || conv.nombre;
    conv.enlaceChat = info.enlaceChat || conv.enlaceChat;
    if (origen && !conv.historial.some((m) => m.rol === "lead")) conv.origen = origen;
    if (recurso) conv.recurso = recurso;
  }

  function buscarVinculoPendiente(conv, texto) {
    const t = normalizar(texto);
    const i = contactosSinVincular.findIndex((c) => c.texto && c.texto === t && Date.now() - c.fecha < 10 * 60000);
    if (i < 0) return;
    const [c] = contactosSinVincular.splice(i, 1);
    vincular(conv, c.info, c.origen, c.recurso);
  }

  // ---------- Eventos de Meta ----------

  async function recibirEventoMeta(ev) {
    if (almacen.yaProcesado(ev.mid)) return;
    if (config.modoPrueba && excluidosEnPrueba.has(ev.igsid)) return;
    const conv = almacen.obtenerOCrear({ id: ev.igsid });
    if (!conv.manychatId) buscarVinculoPendiente(conv, ev.texto);

    // Modo prueba: si ya sabemos quién es y no está en la lista blanca, no guardamos nada
    if (config.modoPrueba && conv.igUsuario && !enListaBlanca(conv)) {
      almacen.borrar(conv.id);
      return;
    }

    if (ev.esEco) {
      if (ev.tipo === "texto" && almacen.esEcoDelAsistente(conv.id, ev.texto)) return;
      const evento =
        ev.tipo === "audio"
          ? { tipo: "dueno_audio" }
          : { tipo: "dueno_texto", texto: ev.texto || DESCRIPCION_ADJUNTO[ev.tipo] || `[${ev.tipo}]` };
      await procesarEvento(conv, evento);
      almacen.guardar(conv);
      return;
    }

    // Con ENTRADA=manychat los mensajes del lead llegan por ManyChat: de Meta solo usamos los ecos (evita duplicados)
    if (config.entrada === "manychat") {
      if (!conv.historial.length && !(conv.bandeja ?? []).length && !conv.manychatId) almacen.borrar(conv.id);
      return;
    }
    await entradaLead(conv, ev);
  }

  /** Mensaje del lead (venga de Meta o de ManyChat): audio → pausa y aviso; resto → bandeja con retraso humano. */
  async function entradaLead(conv, ev) {
    // Origen de la conversación (primer mensaje)
    if (!conv.historial.length && !(conv.bandeja ?? []).length) {
      if (ev.deAnuncio) conv.origen = "anuncio";
      else if (ev.respondeHistoria && conv.origen === "espontaneo") conv.origen = "historia";
    }

    if (ev.tipo === "audio") {
      await vaciarBandeja(conv);
      const r = await procesarEvento(conv, { tipo: "audio" });
      if (r.emails.length) almacen.registrarEvento("audio", conv.id);
      await mandarEmails(r.emails);
      conv.procesarEn = null;
      almacen.guardar(conv);
      return;
    }

    // #reset de la cuenta de pruebas: inmediato
    if (ev.tipo === "texto" && normalizar(ev.texto) === config.comandoReset) {
      conv.bandeja = [];
      conv.procesarEn = Date.now();
      conv.bandeja.push({ tipo: "texto", texto: ev.texto });
      almacen.guardar(conv);
      return;
    }

    // Texto u otros contenidos: a la bandeja, con espera para agrupar + retraso humano
    const tipo = TIPO_MOTOR[ev.tipo] ?? "texto";
    const texto = TIPO_MOTOR[ev.tipo] ? ev.texto : `${DESCRIPCION_ADJUNTO[ev.tipo] ?? ""} ${ev.texto}`.trim();
    conv.bandeja = [...(conv.bandeja ?? []), { tipo, texto, rol: "lead" }];
    const ahora = Date.now();
    if (!conv.primerPendienteAt) {
      conv.primerPendienteAt = ahora;
      // Retraso objetivo de 40-150 s, algo mayor si el mensaje es largo; descontamos ~15 s que tarda la IA
      const factor = Math.min(1, (texto?.length ?? 0) / 300);
      conv.retrasoObjetivoSeg = aleatorio(config.retrasoMinSeg, config.retrasoMinSeg + (config.retrasoMaxSeg - config.retrasoMinSeg) * (0.4 + 0.6 * factor)) - 15;
    }
    const minimo = ahora + config.esperaAgruparSeg * 1000;
    const objetivo = conv.primerPendienteAt + Math.max(0, conv.retrasoObjetivoSeg) * 1000;
    const tope = conv.primerPendienteAt + (config.retrasoMaxSeg + 60) * 1000;
    conv.procesarEn = Math.min(Math.max(minimo, objetivo), Math.max(tope, minimo));
    almacen.guardar(conv);
  }

  // ---------- Mensajes que llegan por ManyChat (respuesta por defecto → petición externa) ----------

  const recientes = new Map(); // anti-duplicados: subscriberId → { texto, fecha }

  async function recibirMensajeManychat({ subscriberId, texto, origen, recurso }) {
    const t = String(texto ?? "").trim();
    const previo = recientes.get(String(subscriberId));
    if (previo && previo.texto === t && Date.now() - previo.fecha < 5000) return null;
    recientes.set(String(subscriberId), { texto: t, fecha: Date.now() });

    const info = await manychat.infoContacto(subscriberId);
    if (config.modoPrueba && !config.listaBlanca.includes(info.igUsuario)) return null;
    const conv =
      almacen.obtenerPorManychat(info.manychatId) ??
      (info.igId ? almacen.obtener(info.igId) : null) ??
      almacen.obtenerOCrear({ id: info.igId || `mc:${info.manychatId}` });
    vincular(conv, info, origen, recurso);
    const { tipo, texto: limpio } = clasificarEntradaManychat(t);
    log.info?.(`[manychat] mensaje tipo=${tipo} contacto=…${String(subscriberId).slice(-4)}`);
    await entradaLead(conv, { tipo, texto: limpio, deAnuncio: origen === "anuncio", respondeHistoria: origen === "historia" });
    return conv;
  }

  async function vaciarBandeja(conv) {
    for (const m of conv.bandeja ?? []) anotarMensajeLead(conv, m);
    conv.bandeja = [];
    conv.primerPendienteAt = null;
  }

  // ---------- Etiquetas de ManyChat ----------

  async function sincronizarEtiquetas(conv) {
    const info = await manychat.infoContacto(conv.manychatId);
    vincular(conv, info);
    const tiene = (e) => info.etiquetas.includes(e);
    if (tiene("ALUMNO") && conv.pausa?.motivo !== "alumno") aplicarEtiqueta(conv, "ALUMNO");
    if (!tiene("ALUMNO") && conv.pausa?.motivo === "alumno") aplicarEtiqueta(conv, "ALUMNO", { quitar: true });
    if (tiene("IA_PAUSA") && !conv.pausa) aplicarEtiqueta(conv, "IA_PAUSA");
    if (!tiene("IA_PAUSA") && conv.pausa?.motivo === "etiqueta") aplicarEtiqueta(conv, "IA_PAUSA", { quitar: true });
    if (tiene("IA_ON")) {
      aplicarEtiqueta(conv, "IA_ON");
      await manychat.quitarEtiqueta(conv.manychatId, "IA_ON").catch(() => {});
      if (tiene("IA_PAUSA")) await manychat.quitarEtiqueta(conv.manychatId, "IA_PAUSA").catch(() => {});
    }
  }

  // ---------- Procesar la bandeja cuando toca ----------

  async function procesarPendiente(convId) {
    if (enCurso.has(convId)) return;
    enCurso.add(convId);
    try {
      const conv = almacen.obtener(convId);
      if (!conv || !conv.procesarEn) return;
      conv.procesarEn = null;
      const bandeja = conv.bandeja ?? [];
      if (!bandeja.length) return void almacen.guardar(conv);

      if (!conv.manychatId) {
        // No sabemos su contacto de ManyChat: no podemos responder
        const antiguedad = Date.now() - (conv.primerPendienteAt ?? Date.now());
        if (antiguedad < 5 * 60000) {
          conv.procesarEn = Date.now() + 20000; // esperamos a que llegue la petición de ManyChat
          return void almacen.guardar(conv);
        }
        if (config.modoPrueba) {
          almacen.borrar(conv.id); // modo prueba: desconocido → fuera
          return;
        }
        await vaciarBandeja(conv);
        await mandarEmails([
          construirEmail("ERROR", conv, {
            detalle: `Ha escrito alguien que no aparece en ManyChat, así que ${negocio.nombreAsistente} no puede responder. Contesta tú desde Instagram.`,
          }),
        ]);
        almacen.registrarEvento("error", conv.id);
        return void almacen.guardar(conv);
      }

      if (config.modoPrueba && !enListaBlanca(conv)) {
        almacen.borrar(conv.id);
        return;
      }

      await sincronizarEtiquetas(conv).catch((e) => log.error(`[manychat] etiquetas: ${e.message}`));

      // Todos los mensajes salvo el último se anotan; el último dispara la respuesta
      const ultimo = bandeja.at(-1);
      for (const m of bandeja.slice(0, -1)) anotarMensajeLead(conv, m);
      conv.bandeja = [];
      conv.primerPendienteAt = null;

      const yaHabiaRespondido = conv.historial.some((m) => m.rol === "bot");
      const corto = `…${String(conv.id).slice(-4)}`;
      log.info?.(`[turno] ${corto} generando respuesta (${bandeja.length} mensaje/s)`);
      const inicio = Date.now();
      const r = await procesarEvento(conv, { tipo: ultimo.tipo, texto: ultimo.texto });
      log.info?.(
        `[turno] ${corto} ${r.ignorado ? `sin respuesta: ${r.ignorado}` : `${r.respuestas.length} burbuja/s`} en ${Math.round((Date.now() - inicio) / 1000)} s` +
          (r.problemas?.length ? ` · avisos: ${r.problemas.map((p) => p.tipo).join(",")}` : ""),
      );

      if (r.respuestas.length) {
        try {
          for (const b of r.respuestas) almacen.registrarEnviado(conv.id, b);
          await manychat.enviarTextos(conv.manychatId, r.respuestas);
        } catch (error) {
          log.error(`[manychat] envío: ${error.message}`);
          r.emails.push(
            construirEmail("ERROR", conv, {
              detalle: `${negocio.nombreAsistente} preparó la respuesta pero ManyChat no la pudo enviar (${error.message.slice(0, 120)}). Contesta tú.`,
            }),
          );
        }
      }
      registrarMetricas(conv, r, yaHabiaRespondido);
      almacen.guardar(conv);
      await mandarEmails(r.emails);
    } catch (error) {
      log.error(`[orquestador] ${convId}: ${error.stack ?? error.message}`);
    } finally {
      enCurso.delete(convId);
    }
  }

  function registrarMetricas(conv, r, yaHabiaRespondido) {
    if (r.coste) almacen.registrarCoste(r.coste);
    if (r.reset) return;
    if (r.respuestas.length && !yaHabiaRespondido) almacen.registrarEvento("atendida", conv.id);
    const s = r.salida;
    if (s) {
      if (["cualificado", "propuesta_llamada"].includes(s.estado)) almacen.registrarEvento("cualificado", conv.id);
      if (s.estado === "fuera_de_foco") almacen.registrarEvento("fuera_de_foco", conv.id);
      const porAccion = {
        traspaso_agendar: "llamada_propuesta",
        enviar_link_pago: "enlace_pago",
        alerta: "alerta",
        humano: "humano",
      };
      if (porAccion[s.accion]) almacen.registrarEvento(porAccion[s.accion], conv.id);
    }
    if (r.emails.some((e) => e.etiqueta === "ERROR")) almacen.registrarEvento("error", conv.id);
  }

  /** Lanza cada conversación vencida por separado: una lenta no bloquea a las demás (enCurso evita duplicados). */
  async function procesarVencidos({ esperar = false } = {}) {
    const tareas = almacen.pendientesDeProcesar().map((conv) => procesarPendiente(conv.id));
    if (esperar) await Promise.all(tareas);
  }

  return { recibirEventoMeta, recibirMensajeManychat, registrarContactoManychat, procesarPendiente, procesarVencidos };
}

/**
 * ManyChat entrega el "último texto" del contacto. Si es un archivo (audio, foto, vídeo), llega como un enlace
 * a los servidores de Meta. Lo clasificamos para no tratar un audio como texto.
 */
export function clasificarEntradaManychat(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { tipo: "audio", texto: "" }; // sin texto = contenido no legible (lo más habitual: audio) → que lo vea el dueño
  const soloUrl = /^https?:\/\/\S+$/i.test(t);
  const deMeta = /(fbsbx\.com|fbcdn\.net|cdninstagram\.com|lookaside\.|scontent)/i.test(t);
  if (soloUrl && deMeta) {
    if (/audio|\.m4a|\.aac|\.ogg|\.mp3|audioclip/i.test(t)) return { tipo: "audio", texto: "" };
    if (/\.(jpe?g|png|webp|heic)(\?|$)|image|photo/i.test(t)) return { tipo: "imagen", texto: "" };
    if (/\.mp4|video/i.test(t)) return { tipo: "video", texto: "" };
    return { tipo: "audio", texto: "" }; // archivo desconocido: más seguro avisar al dueño
  }
  return { tipo: "texto", texto: t };
}
