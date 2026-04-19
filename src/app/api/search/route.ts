import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  const db = getDb();

  let rows;
  if (q.trim()) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT
        p.id, p.name, p.description, p.price, p.cropped_image_path,
        s.id as store_id, s.name as store_name, s.latitude, s.longitude, s.address,
        ((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) as dist_sq
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.name LIKE ? OR p.description LIKE ?
      ORDER BY dist_sq ASC
      LIMIT 50
    `).all(lat, lat, lng, lng, like, like);
  } else {
    rows = db.prepare(`
      SELECT
        p.id, p.name, p.description, p.price, p.cropped_image_path,
        s.id as store_id, s.name as store_name, s.latitude, s.longitude, s.address,
        ((s.latitude - ?) * (s.latitude - ?) + (s.longitude - ?) * (s.longitude - ?)) as dist_sq
      FROM products p
      JOIN stores s ON p.store_id = s.id
      ORDER BY dist_sq ASC
      LIMIT 50
    `).all(lat, lat, lng, lng);
  }

  const products = (rows as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    croppedImagePath: row.cropped_image_path,
    storeId: row.store_id,
    storeName: row.store_name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
  }));

  return NextResponse.json(products);
}
