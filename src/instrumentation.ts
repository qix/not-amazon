export function register() {
  // Only validate in Node.js runtime, not Edge
  if (typeof process === "undefined" || !process.env) return;

  const missing: string[] = [];

  if (!process.env.DATA_DIR) missing.push("DATA_DIR");
  if (!process.env.ANTHROPIC_KEY) missing.push("ANTHROPIC_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
      `Set them in .env.local or your environment before starting the server.`
    );
  }

  console.log(`  DATA_DIR: ${process.env.DATA_DIR}`);
}
