export function hostingConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  if (!production)
    return {
      production,
      origins: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
      ],
    };
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required for hosting.");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  if (
    !env.DEMO_ADMIN_PASSWORD ||
    env.DEMO_ADMIN_PASSWORD.length < 12 ||
    Buffer.byteLength(env.DEMO_ADMIN_PASSWORD) > 72
  )
    throw new Error(
      "DEMO_ADMIN_PASSWORD must contain at least 12 characters and at most 72 bytes.",
    );
  const origins = [env.APP_ORIGIN, env.RENDER_EXTERNAL_URL]
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value);
      if (url.protocol !== "https:")
        throw new Error("Hosted origins must use HTTPS.");
      return url.origin;
    });
  if (!origins.length)
    throw new Error("APP_ORIGIN or RENDER_EXTERNAL_URL is required.");
  return { production, origins, dbName: "careflow_live_demo" };
}
