import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate it looks like an Amazon URL
  if (!isAmazonUrl(url)) {
    return NextResponse.json({ error: "Not a valid Amazon URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch Amazon page" }, { status: 502 });
    }

    const html = await res.text();
    const productName = extractProductName(html);

    if (!productName) {
      return NextResponse.json({ error: "Could not extract product name" }, { status: 404 });
    }

    return NextResponse.json({
      productName,
      searchTerms: buildSearchTerms(productName),
    });
  } catch (err) {
    console.error("Amazon fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch Amazon page" }, { status: 502 });
  }
}

function isAmazonUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^(www\.)?amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|com\.mx|sg|ae|sa|eg|com\.tr)$/.test(
      parsed.hostname
    );
  } catch {
    return false;
  }
}

function extractProductName(html: string): string | null {
  // Try <title> tag first — Amazon titles are like "Product Name : Amazon.com : Category"
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    // Clean up common Amazon title suffixes
    title = title
      .replace(/\s*[-:|]\s*Amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in).*$/i, "")
      .replace(/\s*:\s*(?:Electronics|Clothing|Home|Kitchen|Books|Toys|Sports|Beauty|Health|Grocery|Automotive|Tools|Garden|Pet Supplies|Baby|Industrial|Office).*$/i, "")
      .trim();
    if (title && title.length > 2 && !title.toLowerCase().includes("amazon")) {
      return title;
    }
  }

  // Try og:title meta tag
  const ogMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)
    || html.match(/<meta\s+content="([^"]+)"\s+(?:property|name)="og:title"/i);
  if (ogMatch) {
    const ogTitle = ogMatch[1].trim();
    if (ogTitle && ogTitle.length > 2) return ogTitle;
  }

  // Try the productTitle span (Amazon's actual product title element)
  const spanMatch = html.match(/id="productTitle"[^>]*>([^<]+)</i);
  if (spanMatch) {
    const name = spanMatch[1].trim();
    if (name) return name;
  }

  return null;
}

function buildSearchTerms(productName: string): string[] {
  // Return the full name plus progressively shorter keyword combinations
  // so the search can match on partial terms
  const terms = [productName];

  // Split into words and create shorter versions
  const words = productName
    .replace(/[,()[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !["with", "for", "and", "the", "pack", "count", "size"].includes(w.toLowerCase()));

  // Add first 3-4 significant words as a shorter search
  if (words.length > 3) {
    terms.push(words.slice(0, 4).join(" "));
    terms.push(words.slice(0, 3).join(" "));
  }

  return terms;
}
