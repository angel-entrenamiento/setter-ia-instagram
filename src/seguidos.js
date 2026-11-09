// Personas a las que el dueño sigue en Instagram: el asistente no les contesta ni les hace seguimientos.
// La lista se carga desde el panel (/panel/seguidos) con el archivo que da Instagram en
// "Descargar tu información → Seguidores y seguidos" (following.json) o pegando usuarios.
// Si no hay lista o no se sabe el usuario de la persona, el asistente contesta como siempre.

const CLAVE = "seguidos";
const caches = new WeakMap(); // una lista por base de datos

const normalizar = (u) => String(u ?? "").trim().replace(/^@/, "").toLowerCase();
const esUsuario = (u) => /^[a-z0-9._]{1,30}$/.test(u);

/**
 * Saca los usuarios de lo que haya subido el dueño:
 * - el JSON de Instagram (en cualquiera de sus formatos: "value", "title" o el enlace instagram.com/usuario), o
 * - una lista de usuarios separados por comas, espacios o líneas.
 */
export function extraerUsuarios(texto) {
  const usuarios = new Set();
  const t = String(texto ?? "").trim();
  let json = null;
  try {
    json = JSON.parse(t);
  } catch {}
  if (json) {
    (function recorrer(x) {
      if (Array.isArray(x)) return x.forEach(recorrer);
      if (!x || typeof x !== "object") return;
      for (const campo of ["value", "title", "username"]) if (typeof x[campo] === "string") usuarios.add(normalizar(x[campo]));
      if (typeof x.href === "string") {
        const m = x.href.match(/instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)/);
        if (m) usuarios.add(normalizar(m[1]));
      }
      Object.values(x).forEach(recorrer);
    })(json);
  } else {
    for (const u of t.split(/[\s,;]+/)) usuarios.add(normalizar(u));
  }
  return [...usuarios].filter(esUsuario).sort();
}

export function guardarSeguidos(almacen, usuarios) {
  almacen.fijarAjuste(CLAVE, JSON.stringify(usuarios));
  almacen.fijarAjuste(`${CLAVE}_fecha`, new Date().toISOString());
  caches.set(almacen, new Set(usuarios));
}

export function listaSeguidos(almacen) {
  if (!caches.has(almacen)) {
    let lista = [];
    try {
      lista = JSON.parse(almacen.ajuste(CLAVE) ?? "[]");
    } catch {}
    caches.set(almacen, new Set(lista));
  }
  return caches.get(almacen);
}

export const fechaSeguidos = (almacen) => almacen.ajuste(`${CLAVE}_fecha`);

/** ¿El dueño sigue a este usuario? Sin lista o sin usuario → false (el asistente contesta). */
export function loSigue(almacen, igUsuario) {
  const u = normalizar(igUsuario);
  return Boolean(u) && listaSeguidos(almacen).has(u);
}
