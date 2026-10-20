/** Nonce follows the installed Next 16 Proxy convention. No remote scripts/assets. */
export function contentSecurityPolicy(nonce: string, supabaseUrl: string, development: boolean) {
  const origin = new URL(supabaseUrl).origin;
  return ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ""}`,
    // PDF.js canvas/layout and React style attributes require inline styles, never inline script.
    "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "font-src 'self'", "worker-src 'self' blob:", "frame-src 'self' blob:",
    `connect-src 'self' ${origin}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
}
