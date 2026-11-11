# CRM del panel

Módulo independiente: KPIs de conversaciones, entrevistas y ventas dentro del panel (`/panel/crm`, con la contraseña del panel). Empieza vacío.

## Archivos
- `opciones.js` — columnas, desplegables por defecto y cómo rellena el asistente una entrevista. Las listas de los desplegables las edita cada usuario en **Ajustes → CRM** (se guardan en la base de datos, clave `crm_listas`).
- `almacen.js` — tablas `crm_kpi`, `crm_notas`, `crm_filas` en la misma base SQLite.
- `index.js` — `crearCrm({ db, zonaHoraria, conversaciones, nombreAsistente })` → `{ registrar, manejar, datos }`. `zonaHoraria` y `nombreAsistente` pueden ser funciones (cambian en Ajustes).
- `metricas.js` — cálculo del Resumen y el Embudo (semáforos frente a `METAS`, embudo de outbound, evolución de 12 semanas). Se calcula al momento con las conversaciones, `crm_kpi`, las filas de Entrevistas y la tabla `costes`.
- `pendientes.js` — «Te toca a ti»: conversaciones pausadas para el dueño (agendar, humano, alerta, audio, error) con el último mensaje del lead sin contestar, entrevistas sin fecha ni decisión, entrevistas pasadas sin «Presentado» (o `no_presentado`) y presentadas sin «Entra» (o `no_entra`). `GET /panel/crm/api/pendientes`.
- `leads.js` — tablero de leads: etapa más avanzada de cada conversación (con su fila de Entrevistas si la tiene). `GET /panel/crm/api/leads?desde&hasta`. El Embudo enlaza a cada etapa («quién se paró aquí»).
- `pagina.js` — la página (HTML + JS sin librerías). Pestañas visibles: Registro, Resumen y embudo (tarjetas por fase con «Ver quién →», que lista los leads detrás según `QUIEN_METRICA` y `/panel/crm/api/leads`; si hay más respuestas que bienvenidas, `faltanBienvenidas` en las tarjetas de outbound), Te toca a ti, Leads (tarjetas compactas, 8 por columna) y Datos (Conversaciones, Entrevistas y Ventas). Los nombres antiguos (`#embudo`, `#entrevistas`…) llevan a la pestaña nueva. Lead magnets está oculta (el código se conserva).

## Cómo se engancha (3 puntos)
1. `servidor.js`: `const crm = crearCrm({ db: almacen.db, … })` y, dentro de la zona protegida del panel (después de la licencia), `if (await crm.manejar(req, res, ruta, { leerCuerpo, responder, url })) return;`. También `/panel/ajustes/crm` guarda los desplegables.
2. `orquestador.js`: `crm.registrar("lead_magnet", conv)` cuando llega un disparador con recurso, y `crm.registrar("agendada", conv)` cuando la acción es `traspaso_agendar` (nunca para las cuentas de prueba).
3. `tareas.js`: `kpiInbound()` llama a `crm.registrar("inbound", conv, { dia })` cuando cuenta a alguien como INBOUND.

## Qué es automático
- **Inbound**: +1 en el día del primer mensaje si la persona abre ella la conversación, una vez por persona y después de que el asistente le conteste. No cuentan: respuestas a la bienvenida manual (si el alta en ManyChat, `subscribed`, es más de 5 min anterior al primer mensaje del lead, ver `altaPrevia`), disparadores de comentarios, cuentas de prueba ni conversaciones anteriores a la creación del CRM (`crm_desde`).
- **Lead magnet**: +1 cuando llega un disparador de ManyChat con recurso.
- **Agendadas**: con `traspaso_agendar`, +1 en Outbound (si la conversación la empezó la cuenta con su bienvenida) o Inbound, y la fila en Entrevistas (🤖) con lo que dice la ficha. Una vez por persona.
- **Cerradas**: +1 al marcar «Entra» en una entrevista (−1 al desmarcarla), en el día de la entrevista.
- **Outbound** y todo lo demás se rellena a mano; cada casilla se guarda al cambiarla.

## Registro, Resumen y Embudo
- `GET /panel/crm/api/registro?mes=AAAA-MM` → días con datos por vía (general, bienvenida, lead_magnet, inbound: conversaciones, respuesta, contactos, propuestas, agendadas), total del mes y panel lateral mensual/trimestral/anual.
- Vía de una conversación por su `origen` (bienvenida, recurso → lead_magnet, resto → inbound); de una entrevista por su procedencia (Outbound, Lead magnet, resto → inbound).
- Propuesta = fila de Entrevistas, por el día en que se creó (`creada`). Agendada = fila con fecha de entrevista, por `_agendadaEn` (día en que se puso la fecha; si no lo tiene, la propia fecha). Realizadas/no presentadas = entrevistas con fecha hasta hoy.
- `GET /panel/crm/api/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` → tarjetas, embudo, outbound/inbound, gasto y 12 semanas.
- `POST /panel/crm/api/bienvenidas` `{ cantidad, fecha? }` → suma bienvenidas a la columna Outbound del día (hoy si no hay fecha). Lo usa el botón «+ Sumar» y sirve para que una herramienta externa apunte las bienvenidas que envía (con el usuario y la contraseña del panel).
- «Respondieron» = conversaciones con origen `bienvenida` en las que el lead escribió, por el día de su primer mensaje. «En conversación» = 3 mensajes o más del lead (`MENSAJES_CONVERSACION`). «Cualificados» = estado cualificado, propuesta_llamada o cierre. No cuentan las cuentas de prueba ni el simulador del panel.
- Las conversaciones inactivas se borran a los `DIAS_CONSERVACION` días: los periodos más antiguos pueden mostrar menos respuestas.
- El panel lateral del Registro trae `anterior` en cada periodo; si el periodo está en curso, el anterior se corta al mismo número de días.
- El email de los lunes (`tareas.js` → `construirEmailResumenSemanal`) añade las tarjetas de los últimos 7 días frente a los 7 anteriores y el total de «Te toca a ti».
- Métricas del tutor (Resumen y email): `citasInbound` (agendadas / entradas de inbound + lead magnet, meta 30-50 %), `asistencia` (presentados / marcados como «Presentado» o «No se presentó», rojo por debajo del 80 %), `activas` (`conversacionesActivas` en `leads.js`: el lead escribió en los últimos `DIAS_ACTIVA` días y su etapa es anterior a «Cita agendada») y `objetivo` (nota `objetivo_agendas_semana`, agendadas de lunes a hoy con `agendadasEntre`). La meta de agendas outbound es 1-3 %.
- `calcularMetricas` devuelve también `puntoDebil` (primer paso en rojo, o en amarillo, del camino) y `embudos` por vía (`bienvenida`, `lead_magnet`, `inbound`, `todas`); la pestaña Embudo tiene un selector de vía.
