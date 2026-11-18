// Respaldo automático de Arranque.
// Cada celular tiene un código secreto de 12 letras. La app guarda aquí sus datos
// (racha, días, peso) después de cada entreno, y en un celular nuevo los recupera con el código.
// No hay nombres ni correos: solo el código y los datos de ejercicio.

const ORIGENES = ["https://caov3d.github.io", "http://localhost:8765"];
const CODIGO = /^[A-HJ-NP-Z2-9]{12}$/;
const MAX = 64 * 1024;

function cors(req) {
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const json = (req, obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const m = new URL(req.url).pathname.match(/^\/v1\/([^/]+)$/);
    if (!m) return json(req, { ok: true, app: "arranque-respaldo" });
    const codigo = m[1].toUpperCase();
    if (!CODIGO.test(codigo)) return json(req, { error: "codigo" }, 400);

    if (req.method === "GET") {
      const r = await env.DB.prepare("SELECT data, ts FROM datos WHERE codigo = ?").bind(codigo).first();
      if (!r) return json(req, { error: "no-existe" }, 404);
      return json(req, { data: JSON.parse(r.data), ts: r.ts });
    }

    if (req.method === "PUT") {
      const txt = await req.text();
      if (txt.length > MAX) return json(req, { error: "grande" }, 413);
      let body;
      try { body = JSON.parse(txt); } catch { return json(req, { error: "json" }, 400); }
      const ts = Number(body.ts) || Date.now();
      // Solo se guarda si es más nuevo que lo que ya hay (por si dos celulares escriben a la vez).
      await env.DB.prepare(
        `INSERT INTO datos (codigo, data, ts, actualizado) VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(codigo) DO UPDATE SET data = excluded.data, ts = excluded.ts, actualizado = excluded.actualizado
         WHERE excluded.ts >= datos.ts`
      ).bind(codigo, JSON.stringify(body.data ?? {}), ts).run();
      return json(req, { ok: true, ts });
    }
    return json(req, { error: "metodo" }, 405);
  },
};
