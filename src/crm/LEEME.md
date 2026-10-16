# CRM del panel

Módulo independiente: KPIs de conversaciones, entrevistas y ventas dentro del panel (`/panel/crm`, con la contraseña del panel). Empieza vacío.

## Archivos
- `opciones.js` — columnas, desplegables por defecto y cómo rellena el asistente una entrevista. Las listas de los desplegables las edita cada usuario en **Ajustes → CRM** (se guardan en la base de datos, clave `crm_listas`).
- `almacen.js` — tablas `crm_kpi`, `crm_notas`, `crm_filas` en la misma base SQLite.
- `index.js` — `crearCrm({ db, zonaHoraria, conversaciones, nombreAsistente })` → `{ registrar, manejar, datos }`. `zonaHoraria` y `nombreAsistente` pueden ser funciones (cambian en Ajustes).
- `pagina.js` — la página (HTML + JS sin librerías). Pestañas visibles: Conversaciones, Entrevistas y Ventas. Lead magnets está oculta (el código se conserva).

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
