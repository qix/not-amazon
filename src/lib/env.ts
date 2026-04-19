import path from "path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  ERROR: Required environment variable ${name} is not set.\n`);
    process.exit(1);
  }
  return value;
}

let _validated = false;
let _dataDir = "";
let _anthropicKey = "";

function validate() {
  if (_validated) return;
  _dataDir = requireEnv("DATA_DIR");
  _anthropicKey = requireEnv("ANTHROPIC_KEY");
  _validated = true;
}

export function getDataDir(): string {
  validate();
  return _dataDir;
}

export function getAnthropicKey(): string {
  validate();
  return _anthropicKey;
}

export function getDbPath(): string {
  return path.join(getDataDir(), "not-amazon.db");
}

export function getStorePhotosDir(): string {
  return path.join(getDataDir(), "uploads", "stores");
}

export function getProductPhotosDir(): string {
  return path.join(getDataDir(), "uploads", "products");
}
