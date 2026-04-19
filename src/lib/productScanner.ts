import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import path from "path";
import fs from "fs";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

interface DetectedProduct {
  name: string;
  description: string;
  price: number;
  bboxX: number; // fraction 0-1
  bboxY: number;
  bboxW: number;
  bboxH: number;
}

interface IdentifiedProduct {
  name: string;
  description: string;
  price: number;
}

function getMediaType(imagePath: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ext = path.extname(imagePath).toLowerCase();
  const map: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return map[ext] || "image/jpeg";
}

function parseJson<T>(text: string): T {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(s);
}

const GRID_COLS = 8;
const GRID_ROWS = 8;

/**
 * Draw a labeled grid overlay on the image so Claude can reference
 * visible row/column labels when locating products.
 * Returns base64 PNG of the annotated image.
 */
async function createGridOverlay(imagePath: string): Promise<{ base64: string; width: number; height: number }> {
  const meta = await sharp(imagePath).metadata();
  const width = meta.width || 800;
  const height = meta.height || 600;

  const cellW = width / GRID_COLS;
  const cellH = height / GRID_ROWS;
  const fontSize = Math.max(12, Math.min(24, Math.round(cellW / 4)));
  const strokeWidth = Math.max(1, Math.round(width / 800));

  // Build SVG overlay with grid lines and labels
  const lines: string[] = [];

  // Vertical lines
  for (let c = 0; c <= GRID_COLS; c++) {
    const x = Math.round(c * cellW);
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,255,0,0.6)" stroke-width="${strokeWidth}"/>`);
  }

  // Horizontal lines
  for (let r = 0; r <= GRID_ROWS; r++) {
    const y = Math.round(r * cellH);
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,0,0.6)" stroke-width="${strokeWidth}"/>`);
  }

  // Cell labels (e.g. A1, B2, ...)
  const colLabels = "ABCDEFGH";
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const label = `${colLabels[c]}${r + 1}`;
      const x = Math.round(c * cellW + cellW / 2);
      const y = Math.round(r * cellH + cellH / 2);
      // Background rect for readability
      lines.push(`<rect x="${x - fontSize}" y="${y - fontSize * 0.7}" width="${fontSize * 2}" height="${fontSize * 1.2}" rx="2" fill="rgba(0,0,0,0.5)"/>`);
      lines.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="yellow">${label}</text>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join("")}</svg>`;

  const overlaid = await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { base64: overlaid.toString("base64"), width, height };
}

export async function scanImageForProducts(imagePath: string): Promise<DetectedProduct[]> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString("base64");
  const mediaType = getMediaType(imagePath);
  const client = getClient();

  // ── Pass 1: Identify products (no coordinates) ──
  const identifyResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          {
            type: "text",
            text: `You are a product detection system for a store inventory scanner. Look at this photo taken inside a store and list every distinct product (item for sale) that you can see.

For each product provide:
- name: A short product name (e.g. "Organic Whole Milk", "Sourdough Bread")
- description: A brief description including brand if visible, size, variety
- price: Your best estimate of a reasonable retail price in USD

Respond with ONLY a JSON array, no other text. Example:
[{"name":"Organic Milk","description":"Horizon organic whole milk, 1 gallon","price":5.99}]

If no products are visible, return: []`,
          },
        ],
      },
    ],
  });

  const identifyText = identifyResponse.content.find((b) => b.type === "text");
  if (!identifyText || identifyText.type !== "text") return [];

  let products: IdentifiedProduct[];
  try {
    products = parseJson<IdentifiedProduct[]>(identifyText.text);
    if (!Array.isArray(products) || products.length === 0) return [];
  } catch (err) {
    console.error("Pass 1 parse error:", err, identifyText.text);
    return [];
  }

  // ── Pass 2: Locate each product using a grid overlay ──
  const { base64: gridBase64, width: imgW, height: imgH } = await createGridOverlay(imagePath);

  const productList = products
    .map((p, i) => `${i + 1}. "${p.name}"`)
    .join("\n");

  const locateResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: gridBase64 },
          },
          {
            type: "text",
            text: `This image has a grid overlay with columns A-H and rows 1-8. Each cell is labeled (e.g. A1, B3, F7).

I need you to locate these products in the image. For each product, tell me the top-left cell and bottom-right cell of a tight bounding box around that product.

Products to locate:
${productList}

Respond with ONLY a JSON array where each entry has:
- index: the product number (1-based)
- topLeft: the grid cell at the top-left corner (e.g. "B2")
- bottomRight: the grid cell at the bottom-right corner (e.g. "D4")

Example: [{"index":1,"topLeft":"A1","bottomRight":"C3"},{"index":2,"topLeft":"E2","bottomRight":"G4"}]

Be precise — the bounding box should tightly contain just that product, not the whole shelf.`,
          },
        ],
      },
    ],
  });

  const locateText = locateResponse.content.find((b) => b.type === "text");
  if (!locateText || locateText.type !== "text") {
    // Fall back: return products with no bounding boxes (centered crop)
    return products.map((p) => ({
      ...p, bboxX: 0.1, bboxY: 0.1, bboxW: 0.8, bboxH: 0.8,
    }));
  }

  let locations: Array<{ index: number; topLeft: string; bottomRight: string }>;
  try {
    locations = parseJson(locateText.text);
  } catch (err) {
    console.error("Pass 2 parse error:", err, locateText.text);
    return products.map((p) => ({
      ...p, bboxX: 0.1, bboxY: 0.1, bboxW: 0.8, bboxH: 0.8,
    }));
  }

  // Convert grid cell references to fractional bounding boxes
  const colLabels = "ABCDEFGH";
  function cellToFraction(cell: string): { col: number; row: number } | null {
    const match = cell.match(/^([A-H])(\d)$/i);
    if (!match) return null;
    const col = colLabels.indexOf(match[1].toUpperCase());
    const row = parseInt(match[2], 10) - 1;
    if (col < 0 || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }

  const detected: DetectedProduct[] = [];

  for (const loc of locations) {
    const product = products[loc.index - 1];
    if (!product) continue;

    const tl = cellToFraction(loc.topLeft);
    const br = cellToFraction(loc.bottomRight);
    if (!tl || !br) {
      // Bad cell reference — use centered fallback for this product
      detected.push({ ...product, bboxX: 0.1, bboxY: 0.1, bboxW: 0.8, bboxH: 0.8 });
      continue;
    }

    // Convert grid cells to fractions
    // topLeft cell means the left/top edge of that cell
    // bottomRight cell means the right/bottom edge of that cell
    const bboxX = tl.col / GRID_COLS;
    const bboxY = tl.row / GRID_ROWS;
    const bboxW = (br.col + 1) / GRID_COLS - bboxX;
    const bboxH = (br.row + 1) / GRID_ROWS - bboxY;

    detected.push({
      name: product.name,
      description: product.description || "",
      price: typeof product.price === "number" ? product.price : 0,
      bboxX: Math.max(0, Math.min(1, bboxX)),
      bboxY: Math.max(0, Math.min(1, bboxY)),
      bboxW: Math.max(0.01, Math.min(1 - bboxX, bboxW)),
      bboxH: Math.max(0.01, Math.min(1 - bboxY, bboxH)),
    });
  }

  // Add any products that weren't located (no matching index in locations)
  const locatedIndices = new Set(locations.map((l) => l.index));
  for (let i = 0; i < products.length; i++) {
    if (!locatedIndices.has(i + 1)) {
      detected.push({
        ...products[i],
        bboxX: 0.1,
        bboxY: 0.1,
        bboxW: 0.8,
        bboxH: 0.8,
      });
    }
  }

  return detected;
}

export async function cropProduct(
  imagePath: string,
  bboxX: number,
  bboxY: number,
  bboxW: number,
  bboxH: number,
  productId: string
): Promise<string> {
  const metadata = await sharp(imagePath).metadata();
  const imgW = metadata.width || 800;
  const imgH = metadata.height || 600;

  const left = Math.round(bboxX * imgW);
  const top = Math.round(bboxY * imgH);
  const width = Math.min(Math.round(bboxW * imgW), imgW - left);
  const height = Math.min(Math.round(bboxH * imgH), imgH - top);

  const outputDir = path.join(process.cwd(), "public", "uploads", "products");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${productId}.jpg`);

  await sharp(imagePath)
    .extract({ left, top, width: Math.max(width, 1), height: Math.max(height, 1) })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return `/uploads/products/${productId}.jpg`;
}
