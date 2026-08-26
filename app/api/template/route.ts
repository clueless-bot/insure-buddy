import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const template = await readFile(path.join(process.cwd(), "Template.png"));
    return new Response(new Uint8Array(template), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "Template image was not found." }, { status: 404 });
  }
}
