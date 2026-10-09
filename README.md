# Setter IA para Instagram

Un asistente con IA que contesta los MD de tu Instagram como lo haría un buen setter: conoce a cada persona, la cualifica, propone la llamada contigo a quien encaja y te avisa por email. Tú lo configuras y lo educas desde un panel web, sin tocar código.

**Para empezar, sigue la [guía de instalación](GUIA_INSTALACION.md)** (unos 45-60 minutos la primera vez).

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/9TiBI3?referralCode=MS_vLp)

## Qué hace
- Contesta a todos los MD (vía ManyChat), con retraso humano y agrupando los mensajes seguidos.
- Sigue un método de cualificación: situación, objetivo, prioridad, implicación y quién decide el dinero.
- Propone la llamada solo a quien está cualificado y te pasa la conversación (email `[AGENDAR]`).
- Opcional: vende un producto barato enviando su enlace de pago.
- Te avisa de audios, señales de alarma, personas que piden hablar contigo y errores.
- Seguimientos automáticos a las 8 h y 24 h, y te redacta los de los días 3 y 7.
- Informe semanal de dudas de tus leads con ideas de contenido.

## Reglas de seguridad que aplica el código (aunque la IA se equivoque)
- Nunca dice precios, salvo los del producto barato que tú autorices.
- Solo envía enlaces que estén en tu conocimiento.
- No propone la llamada si falta información, ni vende si hay una señal de alarma.
- Nunca se hace pasar por ti.

## El panel
- **Inicio**: primeros pasos, métricas y conversaciones.
- **Probar**: habla con tu setter como si fueras un lead (no se envía nada a nadie).
- **Conocimiento**: lo que sabe de tu negocio (6 secciones), con un cuestionario que lo redacta con IA.
- **Enseñar**: en cualquier conversación, dile qué debería haber hecho distinto y te propone el cambio.
- **Ajustes** y **Conectar ManyChat**.

## Para usuarios de Claude Code
Lee [CLAUDE.md](CLAUDE.md). Resumen: `npm run conocimiento -- bajar`, editas `mi-conocimiento/`, `npm run conocimiento -- subir`. Pruebas: `npm test`.
