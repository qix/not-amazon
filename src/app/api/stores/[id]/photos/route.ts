import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scanImageForProducts, cropProduct, type SkippedProduct } from "@/lib/productScanner";
import { getStorePhotosDir } from "@/lib/env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const db = getDb();

  const store = db.prepare("SELECT id FROM stores WHERE id = ?").get(storeId);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const photos = formData.getAll("photos") as File[];

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }

  const uploadDir = getStorePhotosDir();
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const insertPhoto = db.prepare(
    "INSERT INTO store_photos (id, store_id, file_path) VALUES (?, ?, ?)"
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (id, store_id, photo_id, name, description, price, cropped_image_path, original_image_path, bbox_x, bbox_y, bbox_w, bbox_h)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const allProducts: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    croppedImagePath: string;
  }> = [];
  const allSkipped: SkippedProduct[] = [];

  for (const photo of photos) {
    const photoId = uuidv4();
    const ext = photo.name.split(".").pop() || "jpg";
    const fileName = `${photoId}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const bytes = await photo.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const dbFilePath = `/api/images/stores/${fileName}`;
    insertPhoto.run(photoId, storeId, dbFilePath);

    const scanResult = await scanImageForProducts(filePath);
    allSkipped.push(...scanResult.skipped);

    for (const product of scanResult.products) {
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

  return NextResponse.json({
    productsDetected: allProducts.length,
    products: allProducts,
    skipped: allSkipped,
  });
}
