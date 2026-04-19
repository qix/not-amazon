import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_KEY environment variable is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

interface ParsedItem {
  name: string;
  quantity: number;
  category: string;
}

export async function POST(req: NextRequest) {
  const { text, lat, lng } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing shopping list text" }, { status: 400 });
  }

  // Step 1: Use Claude to parse the shopping list into individual products
  const response = await getClient().messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse this Amazon shopping list (or cart/order) into individual product items. Extract the essential product name (simplified, generic — e.g. "wireless mouse" not "Logitech M720 Triathlon Multi-Device Wireless Mouse"), quantity, and general category.

Respond with ONLY a JSON array. Example:
[{"name":"wireless mouse","quantity":1,"category":"electronics"},{"name":"USB-C cable","quantity":2,"category":"electronics"}]

If you cannot parse any items, return an empty array: []

Shopping list:
${text}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ items: [], results: {} });
  }

  let items: ParsedItem[];
  try {
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    items = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: "Failed to parse shopping list", raw: textBlock.text }, { status: 500 });
  }

  // Step 2: For each parsed item, search local products
  const db = await getDb();
  const userLat = parseFloat(lat) || 0;
  const userLng = parseFloat(lng) || 0;

  const results: Record<string, {
    item: ParsedItem;
    alternatives: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      croppedImagePath: string;
      storeId: string;
      storeName: string;
      latitude: number;
      longitude: number;
      address: string;
    }>;
  }> = {};

  for (const item of items) {
    // Search with the full name first, then individual significant words
    const searchTerms = buildSearchTerms(item.name);
    let alternatives: typeof results[string]["alternatives"] = [];

    for (const term of searchTerms) {
      const like = `%${term}%`;
      const rows = db.exec(
        `SELECT
          p.id, p.name, p.description, p.price, p.cropped_image_path,
          s.id as store_id, s.name as store_name, s.latitude, s.longitude, s.address,
          ((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) as dist_sq
        FROM products p
        JOIN stores s ON p.store_id = s.id
        WHERE p.name LIKE ? OR p.description LIKE ?
        ORDER BY dist_sq ASC
        LIMIT 10`,
        [userLat, userLat, userLng, userLng, like, like]
      );

      if (rows.length && rows[0].values.length) {
        alternatives = rows[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
          id: row[0] as string,
          name: row[1] as string,
          description: row[2] as string,
          price: row[3] as number,
          croppedImagePath: row[4] as string,
          storeId: row[5] as string,
          storeName: row[6] as string,
          latitude: row[7] as number,
          longitude: row[8] as number,
          address: (row[9] as string) || "",
        }));
        break; // found results, stop trying broader terms
      }
    }

    results[item.name] = { item, alternatives };
  }

  return NextResponse.json({ items, results });
}

function buildSearchTerms(name: string): string[] {
  const terms = [name];
  const words = name
    .replace(/[,()[\]"'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !["the", "and", "for", "with", "pack", "set", "pair"].includes(w.toLowerCase()));

  // Try individual significant words
  for (const word of words) {
    if (word.length >= 4) {
      terms.push(word);
    }
  }

  return terms;
}
