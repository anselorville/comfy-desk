import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  // Clean up any repeated 'images' segment in the path array
  const cleanParts = path.filter((p) => p !== "images" && p.trim().length > 0);
  const filename = cleanParts.join("/");
  const targetUrl = `http://127.0.0.1:8001/images/${filename}`;

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new NextResponse(`Image not found on backend (${res.status})`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err.message}`, { status: 502 });
  }
}
