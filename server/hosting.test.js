import test from "node:test";
import assert from "node:assert/strict";
import { hostingConfig } from "./hosting.js";
test("local setup needs no cloud secrets", () => {
  assert.equal(hostingConfig({}).production, false);
});
test("hosting requires secrets and an HTTPS origin and isolates the database", () => {
  const env = {
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://localhost/old_database",
    JWT_SECRET: "x".repeat(48),
    DEMO_ADMIN_PASSWORD: "y".repeat(24),
    RENDER_EXTERNAL_URL: "https://demo.onrender.com",
  };
  assert.equal(hostingConfig(env).dbName, "careflow_live_demo");
  assert.deepEqual(hostingConfig(env).origins, ["https://demo.onrender.com"]);
  for (const key of [
    "MONGODB_URI",
    "JWT_SECRET",
    "DEMO_ADMIN_PASSWORD",
    "RENDER_EXTERNAL_URL",
  ])
    assert.throws(() => hostingConfig({ ...env, [key]: "" }));
  assert.throws(() =>
    hostingConfig({ ...env, RENDER_EXTERNAL_URL: "http://demo.example.com" }),
  );
});
