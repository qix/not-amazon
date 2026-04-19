import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { scanImageForProducts, cropProduct } from "@/lib/productScanner";
import { getStorePhotosDir } from "@/lib/env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const db = await getDb();

  // Verify store exists
  const store = db.exec("SELECT id FROM stores WHERE id = ?", [storeId]);
  if (!store.length || !store[0].values.length) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const photos = formData.getAll("photos") as File[];

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }

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

  return NextResponse.json({
    productsDetected: allProducts.length,
    products: allProducts,
  });
}
