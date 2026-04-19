import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { scanImageForProducts, cropProduct } from "@/lib/productScanner";
import { getStorePhotosDir } from "@/lib/env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function GET() {
  const db = await getDb();
  const stores = db.exec(
    "SELECT id, name, description, latitude, longitude, address, created_at FROM stores ORDER BY created_at DESC"
  );
  if (!stores.length) return NextResponse.json([]);

  const rows = stores[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
    id: row[0],
    name: row[1],
    description: row[2],
    latitude: row[3],
    longitude: row[4],
    address: row[5],
    createdAt: row[6],
  }));
  return NextResponse.json(rows);
}

type DbLike = { run: (sql: string, params?: (string | number | null | Uint8Array)[]) => void; exec: (sql: string, params?: (string | number | null | Uint8Array)[]) => { columns: string[]; values: (string | number | null | Uint8Array)[][] }[] };

async function processPhotosForStore(
  db: DbLike,
  storeId: string,
  photos: File[]
) {
  const uploadDir = getStorePhotosDir();
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const allProducts: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    croppedImagePath: string;
  }> = [];

  for (const photo of photos) {
    const photoId = uuidv4();
    const ext = photo.name.split(".").pop() || "jpg";
    const fileName = `${photoId}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const bytes = await photo.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const dbFilePath = `/api/images/stores/${fileName}`;
    db.run("INSERT INTO store_photos (id, store_id, file_path) VALUES (?, ?, ?)", [
      photoId,
      storeId,
      dbFilePath,
    ]);

    const detected = await scanImageForProducts(filePath);

    for (const product of detected) {
      const productId = uuidv4();
      const croppedPath = await cropProduct(
        filePath,
        product.bboxX,
        product.bboxY,
        product.bboxW,
        product.bboxH,
        productId
      );

      db.run(
        `INSERT INTO products (id, store_id, photo_id, name, description, price, cropped_image_path, original_image_path, bbox_x, bbox_y, bbox_w, bbox_h)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId, storeId, photoId, product.name, product.description,
          product.price, croppedPath, dbFilePath, product.bboxX, product.bboxY,
          product.bboxW, product.bboxH,
        ]
      );

      allProducts.push({
        id: productId,
        name: product.name,
        description: product.description,
        price: product.price,
        croppedImagePath: croppedPath,
      });
    }

    saveDb(); // persist after each photo's products
  }

  return allProducts;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const latitude = parseFloat(formData.get("latitude") as string);
  const longitude = parseFloat(formData.get("longitude") as string);
  const address = formData.get("address") as string;
  const photos = formData.getAll("photos") as File[];

  if (!name || isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = await getDb();
  const storeId = uuidv4();

  db.run(
    "INSERT INTO stores (id, name, description, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?)",
    [storeId, name, description || "", latitude, longitude, address || ""]
  );
  saveDb(); // persist the store before the slow photo scan

  const allProducts = await processPhotosForStore(db, storeId, photos);

  if (allProducts.length > 0) saveDb();

  return NextResponse.json({
    store: { id: storeId, name, description, latitude, longitude, address },
    productsDetected: allProducts.length,
    products: allProducts,
  });
}

export async function PATCH(req: NextRequest) {
  const { id, address, latitude, longitude } = await req.json();

  if (!id || isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = await getDb();

  const existing = db.exec("SELECT id FROM stores WHERE id = ?", [id]);
  if (!existing.length || !existing[0].values.length) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  db.run(
    "UPDATE stores SET address = ?, latitude = ?, longitude = ? WHERE id = ?",
    [address || "", latitude, longitude, id]
  );
  saveDb();

  return NextResponse.json({ id, address, latitude, longitude });
}
