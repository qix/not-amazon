import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 3) {
    return NextResponse.json([]);
  }

  try {
    const params = new URLSearchParams({
      q: q.trim(),
      format: "json",
      addressdetails: "1",
      limit: "5",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "NotAmazon/1.0 (local-product-finder)",
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
    }

    const data = await res.json();

    const results = data.map(
      (item: {
        lat: string;
        lon: string;
        display_name: string;
        type: string;
      }) => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name,
        type: item.type,
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("Geocode error:", err);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}
