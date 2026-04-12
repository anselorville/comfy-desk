import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const OUTPUT_DIR =
  process.env.OUTPUT_DIR ??
  path.join(process.cwd(), "..", "volumes", "output", "comfydesk");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function GET() {
  try {
    const files = await readdir(OUTPUT_DIR, { withFileTypes: true });
    const images = files
      .filter(
        (f) => f.isFile() && IMAGE_EXTS.has(path.extname(f.name).toLowerCase())
      )
      .map((f) => ({
        name: f.name,
        src: `/images/${f.name}`,
      }))
      .reverse(); // newest first
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
