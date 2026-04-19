import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { scanImageForProducts, cropProduct } from "@/lib/productScanner";
import { getStorePhotosDir } from "@/lib/env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, name, description, latitude, longitude, address, created_at FROM stores ORDER BY created_at DESC"
  ).all() as Record<string, unknown>[];

  const stores = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    createdAt: row.created_at,
  }));
  return NextResponse.json(stores);
}

async function processPhotosForStore(
  db: Database.Database,
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

  const insertPhoto = db.prepare(
    "INSERT INTO store_photos (id, store_id, file_path) VALUES (?, ?, ?)"
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (id, store_id, photo_id, name, description, price, cropped_image_path, original_image_path, bbox_x, bbox_y, bbox_w, bbox_h)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const photo of photos) {
    const photoId = uuidv4();
    const ext = photo.name.split(".").pop() || "jpg";
    const fileName = `${photoId}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const bytes = await photo.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const dbFilePath = `/api/images/stores/${fileName}`;
    insertPhoto.run(photoId, storeId, dbFilePath);

    const detected = await scanImageForProducts(filePath);

    for (const product of detected) {
      const productId = uuidv4();
      const croppedPath = await cropProduct(
        filePath, product.bboxX, product.bboxY, product.bboxW, product.bboxH, productId
      );

      insertProduct.run(
        productId, storeId, photoId, product.name, product.description,
        product.price, croppedPath, dbFilePath, product.bboxX, product.bboxY,
        product.bboxW, product.bboxH,
      );

      allProducts.push({
        id: productId,
        name: product.name,
        description: product.description,
        price: product.price,
        croppedImagePath: croppedPath,
      });
    }
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

  const db = getDb();
  const storeId = uuidv4();

  db.prepare(
    "INSERT INTO stores (id, name, description, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(storeId, name, description || "", latitude, longitude, address || "");

  const allProducts = await processPhotosForStore(db, storeId, photos);

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

  const db = getDb();

  const existing = db.prepare("SELECT id FROM stores WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  db.prepare(
    "UPDATE stores SET address = ?, latitude = ?, longitude = ? WHERE id = ?"
  ).run(address || "", latitude, longitude, id);

  return NextResponse.json({ id, address, latitude, longitude });
}
