# Guía de instalación de tu Setter IA

Tiempo: 45-60 minutos la primera vez. No hace falta saber programar.

## Lo que necesitas (y lo que cuesta, aproximado)
| Servicio | Para qué | Coste aproximado |
|---|---|---|
| **Instagram profesional** conectado a una página de Facebook | Tu cuenta | Gratis |
| **ManyChat Pro** | Recibe y envía los MD de Instagram | Desde ~15 $/mes |
| **Anthropic (Claude)** | La inteligencia artificial | Pago por uso: ~0,03 $ por respuesta. Con 200-300 leads al mes, unos 20-40 $/mes |
| **Railway** (plan Hobby) | El servidor donde vive tu setter | 5 $/mes |
| **Resend** | Los emails de aviso | Gratis |

Una **segunda cuenta de Instagram** tuya (personal o de pruebas) para probarlo antes de lanzarlo.

Tu **clave de licencia** personal (empieza por `SETTER-`): te la da Ángel López. Es solo para ti y solo funciona en un setter. No la compartas: el uso de este software está limitado a quien Ángel autoriza (ver el archivo LICENSE).

> ⚠️ Tus claves (API keys) son como contraseñas: no las pegues en chats ni las compartas. Solo van en Railway.

---

## Paso 1 · Anthropic (la IA)
1. Entra en **console.anthropic.com** y crea tu cuenta.
2. **Billing** → añade un método de pago y carga saldo (por ejemplo 20 $). Recomendado: activa la recarga automática y pon un límite mensual.
3. **API Keys** → **Create Key** → ponle de nombre "setter" → copia la clave (empieza por `sk-ant-`). Guárdala un momento en una nota: solo se ve una vez.

## Paso 2 · ManyChat
1. Entra en **manychat.com**, crea tu cuenta y conecta tu **Instagram** (te pedirá conectarlo con Facebook).
2. Contrata el plan **Pro** (lo necesitas para la API y las peticiones externas).
3. **Settings → API** → **Generate your API Key** → copia la clave.

## Paso 3 · Resend (emails de aviso)
1. Entra en **resend.com** y crea tu cuenta **con el email donde quieres recibir los avisos** (importante: sin dominio propio, Resend solo puede enviarte emails a ese mismo email).
2. **API Keys** → **Create API Key** → copia la clave (empieza por `re_`).

## Paso 4 · Crear tu setter en Railway
1. Pulsa el botón **Deploy on Railway** que te han pasado (o el del README).
2. Crea tu cuenta en Railway (puedes entrar con GitHub o Google) y contrata el plan **Hobby** (5 $/mes).
3. Te pedirá estas variables. Pega cada una:
   - `LICENCIA` → tu clave de licencia (la que te ha dado Ángel)
   - `ANTHROPIC_API_KEY` → la clave del paso 1
   - `MANYCHAT_API_KEY` → la del paso 2
   - `RESEND_API_KEY` → la del paso 3
   - `PANEL_CLAVE` → inventa una contraseña para tu panel (apúntala)
4. Pulsa **Deploy** y espera 2-3 minutos.
5. Abre tu servicio → **Settings → Networking**: ahí está tu dirección (algo como `https://setter-production-xxxx.up.railway.app`). Si no hay ninguna, pulsa **Generate Domain**.
6. Abre esa dirección y añade `/panel` al final. Usuario: **admin** · Contraseña: la de `PANEL_CLAVE`.
7. **Para que se actualice solo** (recomendado, 1 minuto): en Railway abre tu proyecto → **Settings → Tokens** → crea un token (nombre `actualizaciones`, entorno `production`) y cópialo. Después, en tu servicio → **Variables** → **New Variable**: `TOKEN_RAILWAY` = ese token. Así, cuando Ángel publique mejoras, tu setter las instala solo de madrugada (o al momento con el botón **Actualizar ahora** de Ajustes).

## Paso 5 · Configurarlo desde el panel
El panel te enseña una lista de **Primeros pasos**. En orden:
1. **Ajustes**: el nombre de tu asistente, tu nombre, tu negocio, tu cuenta de Instagram, tu email (el de Resend) y tu cuenta de pruebas. Si tienes un producto barato para vender por MD, actívalo y pon su precio y enlace de pago. Pulsa **Guardar** y luego **Comprobar que las claves funcionan** (te llegará un email de prueba).
2. **Conocimiento → Rellenarlo con IA**: contesta el cuestionario (cuanto más detalle, mejor; lo que más ayuda son tus conversaciones reales). En 1-2 minutos tendrás las 6 secciones redactadas.
3. Repasa cada sección y completa los huecos **[RELLENAR]** que queden.
4. **Probar**: habla con tu setter como si fueras distintos tipos de lead (el que encaja, el que pregunta el precio de primeras, el que no encaja, el que duda…). Cuando haga algo que no te guste, usa **Enseñar a…** debajo del chat: explícale qué debería haber hecho y aplica el cambio que te propone.

## Paso 6 · Conectar ManyChat
En el panel → **Conectar ManyChat** tienes todo para copiar y pegar:
1. ManyChat → **Automatización → Básico → Respuesta predeterminada** (Instagram) → actívala y edita el flujo.
   - ⚠️ Pulsa el disparador «El usuario envía un mensaje directo» y marca **every time** (cada vez). Si se queda en «once per 24 hours», solo pasa el primer mensaje del día y no llegan los audios.
   - Borra el bloque de mensaje que trae y pon una **Acción → Solicitud externa**: POST, la URL, la cabecera `X-Token` y el cuerpo que te indica el panel (los campos con «{+} Añadir un campo»: *Id de contacto* y *Última entrada de texto*). La vista previa dirá «JSON no válido»: es normal.
   - ⚠️ **«Última entrada de texto» va sin comillas alrededor**, y tienes que hacer clic encima de su etiqueta azul y marcar **«Codificar a JSON»**. Si no, los mensajes con varias líneas o con comillas no llegan a tu setter.
   - **Guardar** y **Publicar En Vivo**.
2. Crea las etiquetas **IA_PAUSA**, **IA_ON** y **ALUMNO**. Si ya usas otras etiquetas para lo mismo (por ejemplo `PAUSAR_BOT` o `CLIENTES`), no hace falta crearlas: pon tus nombres en **Ajustes → Etiquetas de ManyChat** o pídeselo al **Asistente** del panel.
3. Desde tu cuenta de pruebas, escribe un MD a tu Instagram. Tu setter contestará en 1-2 minutos. Escribe `#reset` para empezar de cero.

## Paso 7 · Lanzarlo
Cuando estés contento con las pruebas: panel → **Inicio** → **Activar para todos**. Puedes volver al modo prueba cuando quieras.

---

## El día a día
- **Emails que recibirás**: `[AGENDAR]` (te toca cerrar día y hora de la llamada), `[AUDIO]` (escúchalo, contesta tú y apunta en una línea qué dijo con el enlace del email), `[ALERTA]`, `[HUMANO]`, `[PAGO]`, `[ERROR]`, y cada mañana `[SEGUIMIENTOS]` con mensajes ya redactados para que los envíes tú.
- **Quedarte tú una conversación**: etiqueta **IA_PAUSA** en ManyChat (o el botón Pausar del panel). Para devolvérsela: **IA_ON**.
- **Clientes actuales**: etiqueta **ALUMNO** y el setter nunca les contesta (ni les hace seguimientos).
- **Otras personas a las que no debe contestar** (clientes antiguos, amigos, colaboradores…): en **Ajustes → "Etiquetas de ManyChat a las que NO contesta"** añade las tuyas separadas por comas (por ejemplo `ALUMNO, CLIENTES, AMIGOS`) y pónselas a esos contactos en ManyChat. Puedes elegir si quieres un email cuando te escriban.
- **Si escribes tú en un chat** desde la app de Instagram, el setter lo tiene en cuenta y sigue después sin contradecirte.
- **Educarlo**: revisa conversaciones en el panel y usa **Enseñar a…** cuando algo no te guste. Es la forma más rápida de que mejore.
- **Asistente** (pestaña del panel): pídele cambios hablando ("añade mi programa nuevo", "cambia el precio del producto barato a 67") o súbele PDF y textos de tu negocio. Te propone los cambios y tú pulsas **Aplicar**. Si tienes un Word o una presentación, guárdalos antes como PDF. Cuesta unos 0,10 $ por mensaje.
- **Gasto**: lo ves en el panel (Inicio → Gasto IA) y en console.anthropic.com. Cada vez que cambias el conocimiento, la primera respuesta cuesta algo más (~0,20 $) porque la IA vuelve a leerlo todo.

## CRM
En el panel, **📊 Abrir el CRM** (o la pestaña **CRM**). Empieza vacío y cada casilla se guarda sola al cambiarla.
- **Conversaciones**: una fila por día con Outbound, Inbound, Lead magnet, Agendadas Outbound, Agendadas Inbound y Cerradas. Abajo, el TOTAL del mes, tu objetivo de outbound (GOAL) y los resúmenes del trimestre y del año.
- **Entrevistas**: una fila por persona que va a llamada, agrupadas por mes, con resumen y observaciones del mes.
- **Ventas**: un bloque por mes.

Lo que rellena tu asistente solo:
- **Inbound**: +1 cuando alguien te escribe sin que le hayas escrito antes (no cuentan las respuestas a tu bienvenida manual, ni los comentarios de ManyChat, ni tu cuenta de pruebas).
- **Lead magnet**: +1 cuando un disparador de comentarios de ManyChat envía un recurso.
- **Agendadas**: cuando propone la llamada y te pasa la conversación, suma una agendada y añade a la persona en **Entrevistas** (🤖) con lo que sabe de ella.
- **Cerradas**: se suma sola al marcar **«Entra»** en una entrevista.
- El **Outbound** lo pones tú. Cualquier número se puede corregir a mano.

Las opciones de los desplegables de Entrevistas (Procedencia, Servicio, Qué le ocurre…) se cambian en **Ajustes → CRM: opciones de los desplegables**, una por línea. «Qué le ocurre» empieza vacía: pon los problemas típicos de tus clientes.

## Actualizaciones
Cuando Ángel publica una mejora, **te llega un email** con lo que trae y cómo instalarla (puedes desactivarlo en Ajustes → Avisos). La lista completa está en [NOVEDADES.md](NOVEDADES.md). En **Ajustes → Actualizaciones** ves si tienes la última versión y qué trae la nueva. Con `TOKEN_RAILWAY` puesto y la casilla de actualización automática marcada, las versiones nuevas se instalan solas entre las 3:00 y las 5:00. Tu conocimiento, tus ajustes y tus conversaciones no se tocan.

## Problemas frecuentes
- **No contesta a mensajes largos, con varias líneas o con comillas**: en la Solicitud externa de ManyChat, quita las comillas de alrededor de «Última entrada de texto» y marca «Codificar a JSON» al hacer clic en ella.
- **Solo contesta al primer mensaje / no llegan los audios**: en la Respuesta predeterminada de ManyChat falta marcar **every time**.
- **No contesta**: ¿estás en modo prueba y escribes desde una cuenta que no está en "Cuentas de prueba"? ¿Está publicada la respuesta predeterminada de ManyChat? Mira el paso "Conectar ManyChat" del panel.
- **Contesté desde la bandeja de ManyChat y ya no responde**: ManyChat pausa las automatizaciones en ese chat; pulsa «Reanudar».
- **No me llegan los emails**: el email de Ajustes tiene que ser el mismo con el que creaste Resend. Mira también en spam.
- **"Falta la contraseña del panel"**: añade la variable `PANEL_CLAVE` en Railway → tu servicio → Variables.
- **"Tu setter está bloqueado"**: revisa la variable `LICENCIA` en Railway. Si dice que la clave ya se usa en otro setter (por ejemplo, porque lo has reinstalado), pide a Ángel que la libere.
