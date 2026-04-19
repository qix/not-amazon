import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");
  const radius = parseFloat(searchParams.get("radius") || "50"); // km

  const db = await getDb();

  let query: string;
  let params: (string | number)[];

  if (q.trim()) {
    // Search by name with location sorting
    query = `
      SELECT
        p.id, p.name, p.description, p.price, p.cropped_image_path,
        s.id as store_id, s.name as store_name, s.latitude, s.longitude, s.address,
        ((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) as dist_sq
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.name LIKE ? OR p.description LIKE ?
      ORDER BY dist_sq ASC
      LIMIT 50
    `;
    const like = `%${q}%`;
    params = [lat, lat, lng, lng, like, like];
  } else {
    // Return all products sorted by distance
    query = `
      SELECT
        p.id, p.name, p.description, p.price, p.cropped_image_path,
        s.id as store_id, s.name as store_name, s.latitude, s.longitude, s.address,
        ((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) as dist_sq
      FROM products p
      JOIN stores s ON p.store_id = s.id
      ORDER BY dist_sq ASC
      LIMIT 50
    `;
    params = [lat, lat, lng, lng];
  }

  const results = db.exec(query, params);
  if (!results.length) return NextResponse.json([]);

  const products = results[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
    id: row[0],
    name: row[1],
    description: row[2],
    price: row[3],
    croppedImagePath: row[4],
    storeId: row[5],
    storeName: row[6],
    latitude: row[7],
    longitude: row[8],
    address: row[9],
  }));

  return NextResponse.json(products);
}
