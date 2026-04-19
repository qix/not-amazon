export function register() {
  const missing: string[] = [];

  if (!process.env.DATA_DIR) missing.push("DATA_DIR");
  if (!process.env.ANTHROPIC_KEY) missing.push("ANTHROPIC_KEY");

  if (missing.length > 0) {
    console.error(
      `\n  ERROR: Missing required environment variable(s): ${missing.join(", ")}\n` +
      `  Set them in .env.local or your environment before starting the server.\n`
    );
    process.exit(1);
  }

  console.log(`  DATA_DIR: ${process.env.DATA_DIR}`);
}
