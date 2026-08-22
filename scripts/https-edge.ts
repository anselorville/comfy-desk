/**
 * ComfyDesk HTTPS edge — single LAN entry (https://<LAN-IP>:8443).
 * Routes: /api/* /images/* /studio/* → gateway :8001; everything else → Next :3000.
 * Run: bun scripts/https-edge.ts
 */
const CERT = await Bun.file("gateway/certs/cert.pem").text();
const KEY = await Bun.file("gateway/certs/key.pem").text();

const GATEWAY = "http://127.0.0.1:8001";
const FRONTEND = "http://127.0.0.1:3000";

const TO_GATEWAY = /^\/(api|images|upload|studio)\//;

async function proxy(target: string, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const upstream = await fetch(target + url.pathname + url.search, {
    method: req.method,
    headers: req.headers,
    body,
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

Bun.serve({
  port: 8443,
  tls: { cert: CERT, key: KEY },
  async fetch(req) {
    const path = new URL(req.url).pathname;
    try {
      return await proxy(TO_GATEWAY.test(path) ? GATEWAY : FRONTEND, req);
    } catch (err) {
      console.error("edge error", path, err);
      return new Response("bad gateway", { status: 502 });
    }
  },
});

console.log("HTTPS edge on :8443 → gateway/:8001 + frontend/:3000");
