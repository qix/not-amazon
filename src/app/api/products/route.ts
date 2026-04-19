import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get("storeId");

  const db = await getDb();

  let query: string;
  let params: string[];

  if (storeId) {
    query = `
      SELECT p.id, p.name, p.description, p.price, p.cropped_image_path,
             s.name as store_name, s.id as store_id
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = ?
      ORDER BY p.created_at DESC
    `;
    params = [storeId];
  } else {
    query = `
      SELECT p.id, p.name, p.description, p.price, p.cropped_image_path,
             s.name as store_name, s.id as store_id
      FROM products p
      JOIN stores s ON p.store_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `;
    params = [];
  }

  const results = db.exec(query, params);
  if (!results.length) return NextResponse.json([]);

  const products = results[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
    id: row[0],
    name: row[1],
    description: row[2],
    price: row[3],
    croppedImagePath: row[4],
    storeName: row[5],
    storeId: row[6],
  }));

  return NextResponse.json(products);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const storeId = searchParams.get("storeId");
  const all = searchParams.get("all");

  const db = await getDb();

  if (all === "true") {
    db.run("DELETE FROM products");
    saveDb();
    return NextResponse.json({ deleted: "all" });
  }

  if (storeId) {
    db.run("DELETE FROM products WHERE store_id = ?", [storeId]);
    saveDb();
    return NextResponse.json({ deleted: "store", storeId });
  }

  if (id) {
    db.run("DELETE FROM products WHERE id = ?", [id]);
    saveDb();
    return NextResponse.json({ deleted: id });
  }

  return NextResponse.json({ error: "Provide ?id=..., ?storeId=..., or ?all=true" }, { status: 400 });
}
