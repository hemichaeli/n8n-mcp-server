import crypto from "node:crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";

const AUTH_SECRET = process.env.AUTH_SECRET || "";
export const authEnabled = AUTH_SECRET.length > 0;

const derive = (suffix: string) =>
  crypto.createHash("sha256").update(`${AUTH_SECRET}|${suffix}`).digest("hex");

const ACCESS_TOKEN = authEnabled ? derive("mcp-access") : "";
const REFRESH_TOKEN = authEnabled ? derive("mcp-refresh") : "";

// one-time authorization codes: code -> expiry epoch ms
const codes = new Map<string, number>();
const CODE_TTL_MS = 10 * 60 * 1000;

function issueCode(): string {
  const code = crypto.randomBytes(32).toString("hex");
  codes.set(code, Date.now() + CODE_TTL_MS);
  return code;
}

function consumeCode(code: string): boolean {
  const exp = codes.get(code);
  if (exp === undefined) return false;
  codes.delete(code);
  return exp > Date.now();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function form(redirectUri: string, state: string, error?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Connect</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e8eaed;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}form{background:#151922;
padding:32px;border-radius:12px;width:320px}h1{font-size:16px;margin:0 0 4px}
p{font-size:13px;color:#9aa4b2;margin:0 0 20px}input{width:100%;box-sizing:border-box;
padding:10px;border-radius:8px;border:1px solid #2a3140;background:#0b0d12;color:#e8eaed;
font-size:14px}button{width:100%;margin-top:12px;padding:10px;border:0;border-radius:8px;
background:#4c8bf5;color:#fff;font-size:14px;cursor:pointer}
.e{color:#ff6b6b;font-size:13px;margin-top:12px}</style></head><body>
<form method="POST" action="/authorize">
<h1>MCP server access</h1><p>Enter the shared passphrase to connect.</p>
<input type="password" name="passphrase" autofocus required placeholder="Passphrase">
<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
<input type="hidden" name="state" value="${escapeHtml(state)}">
<button type="submit">Connect</button>
${error ? `<div class="e">${escapeHtml(error)}</div>` : ""}
</form></body></html>`;
}

function redirectBack(res: Response, redirectUri: string, state: string): void {
  const loc = new URL(redirectUri);
  loc.searchParams.set("code", issueCode());
  if (state) loc.searchParams.set("state", state);
  res.redirect(302, loc.toString());
}

/** Gate for the MCP transport endpoints. No-op when AUTH_SECRET is unset. */
export function requireBearer(baseUrl: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authEnabled) { next(); return; }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const expected = ACCESS_TOKEN;
    const ok =
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok) {
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
      );
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    next();
  };
}

/** OAuth 2.1 discovery + DCR + authorize/token. Register right after /health. */
export function registerOAuth(app: Express, opts: { baseUrl: string; clientPrefix: string }): void {
  const { baseUrl, clientPrefix } = opts;

  app.get(
    ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/sse",
     "/.well-known/oauth-protected-resource/mcp"],
    (_req, res) => {
      res.json({
        resource: baseUrl,
        authorization_servers: [baseUrl],
        bearer_methods_supported: ["header"],
        scopes_supported: ["mcp"],
      });
    }
  );

  app.get(
    ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"],
    (_req, res) => {
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256", "plain"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["mcp"],
      });
    }
  );

  app.post("/register", express.json(), (req, res) => {
    const meta = (req.body ?? {}) as Record<string, unknown>;
    res.status(201).json({
      client_id: `${clientPrefix}-client`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      redirect_uris: Array.isArray(meta.redirect_uris) ? meta.redirect_uris : [],
    });
  });

  app.get("/authorize", (req, res) => {
    const redirectUri = req.query.redirect_uri as string | undefined;
    const state = (req.query.state as string | undefined) || "";
    if (!redirectUri) {
      res.status(400).json({ error: "invalid_request", error_description: "redirect_uri required" });
      return;
    }
    if (!authEnabled) { redirectBack(res, redirectUri, state); return; }
    res.status(200).type("html").send(form(redirectUri, state));
  });

  app.post("/authorize", express.urlencoded({ extended: false }), (req, res) => {
    const body = (req.body ?? {}) as Record<string, string>;
    const redirectUri = body.redirect_uri || "";
    const state = body.state || "";
    if (!redirectUri) {
      res.status(400).json({ error: "invalid_request", error_description: "redirect_uri required" });
      return;
    }
    if (!authEnabled) { redirectBack(res, redirectUri, state); return; }
    const supplied = Buffer.from(body.passphrase || "");
    const expected = Buffer.from(AUTH_SECRET);
    const ok =
      supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    if (!ok) {
      res.status(401).type("html").send(form(redirectUri, state, "Incorrect passphrase."));
      return;
    }
    redirectBack(res, redirectUri, state);
  });

  app.post("/token", express.urlencoded({ extended: false }), (req, res) => {
    const body = (req.body ?? {}) as Record<string, string>;
    if (authEnabled) {
      const grant = body.grant_type || "authorization_code";
      const valid =
        grant === "refresh_token"
          ? body.refresh_token === REFRESH_TOKEN
          : consumeCode(body.code || "");
      if (!valid) {
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
    }
    res.json({
      access_token: authEnabled ? ACCESS_TOKEN : `${clientPrefix}-token`,
      token_type: "Bearer",
      expires_in: 315360000,
      refresh_token: authEnabled ? REFRESH_TOKEN : `${clientPrefix}-refresh`,
      scope: "mcp",
    });
  });
}
