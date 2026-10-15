// ManyChat mete {{last_input_text}} en el JSON sin escapar: si el mensaje del lead tiene saltos de línea,
// tabuladores o comillas, el cuerpo deja de ser JSON válido. Aquí lo leemos igualmente.

/** Escapa los caracteres de control (saltos de línea, tabuladores…) que aparecen dentro de las cadenas. */
function escaparControles(crudo) {
  return crudo.replace(/[\u0000-\u001f]/g, (c) => ({ "\n": "\\n", "\r": "\\r", "\t": "\\t" })[c] ?? "");
}

/**
 * Último recurso: saca cada campo por su nombre. El valor de un campo llega hasta la comilla que va seguida
 * de `,"otro_campo":` o del `}` final, así que tolera comillas sueltas dentro del texto.
 */
function extraerCampos(crudo) {
  const datos = {};
  const re = /"([a-z_]+)"\s*:\s*(?:"([\s\S]*?)"(?=\s*(?:,\s*"[a-z_]+"\s*:|\}\s*$))|(-?\d+))/g;
  for (const m of crudo.matchAll(re)) datos[m[1]] = m[2] !== undefined ? m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n") : m[3];
  return datos;
}

/** @returns {object|null} los datos, o null si no hay forma de leerlo */
export function parsearCuerpoManychat(crudo) {
  const texto = (crudo ?? "").trim() || "{}";
  try {
    return JSON.parse(texto);
  } catch {}
  try {
    return JSON.parse(escaparControles(texto));
  } catch {}
  const datos = extraerCampos(texto);
  return Object.keys(datos).length ? datos : null;
}
