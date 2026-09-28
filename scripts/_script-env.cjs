// Preload for the verify-* scripts: load .env.local and stand in for
// next/headers, which the VM Supabase client reads for RLS cookies. The views
// these scripts read are anon-readable, so an empty cookie jar is enough.
const { readFileSync } = require("fs");
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const Module = require("module");
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "next/headers") {
    return { cookies: () => ({ getAll: () => [], setAll: () => {} }) };
  }
  return realLoad.call(this, request, ...rest);
};
