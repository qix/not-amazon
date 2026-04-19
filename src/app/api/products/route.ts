import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  const db = getDb();

  let rows;
  if (storeId) {
    rows = db.prepare(`
      SELECT p.id, p.name, p.description, p.price, p.cropped_image_path,
             s.name as store_name, s.id as store_id
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = ?
      ORDER BY p.created_at DESC
    `).all(storeId);
  } else {
    rows = db.prepare(`
      SELECT p.id, p.name, p.description, p.price, p.cropped_image_path,
             s.name as store_name, s.id as store_id
      FROM products p
      JOIN stores s ON p.store_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all();
  }

  const products = (rows as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    croppedImagePath: row.cropped_image_path,
    storeName: row.store_name,
    storeId: row.store_id,
  }));

  return NextResponse.json(products);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const storeId = searchParams.get("storeId");
  const all = searchParams.get("all");

  const db = getDb();

  if (all === "true") {
    db.prepare("DELETE FROM products").run();
    return NextResponse.json({ deleted: "all" });
  }

  if (storeId) {
    db.prepare("DELETE FROM products WHERE store_id = ?").run(storeId);
    return NextResponse.json({ deleted: "store", storeId });
  }

  if (id) {
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    return NextResponse.json({ deleted: id });
  }

  return NextResponse.json({ error: "Provide ?id=..., ?storeId=..., or ?all=true" }, { status: 400 });
}
