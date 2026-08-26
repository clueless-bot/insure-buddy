import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runFile = promisify(execFile);
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxFileSize = 10 * 1024 * 1024;

function extensionFor(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/webp") return ".webp";
  return ".png";
}

export async function POST(request: Request) {
  let workingDirectory: string | undefined;

  try {
    const data = await request.formData();
    const profile = data.get("profile");
    const phoneNumber = String(data.get("phoneNumber") || "").trim();
    const email = String(data.get("email") || "").trim();

    if (!(profile instanceof File) || profile.size === 0) {
      return Response.json({ error: "A profile image is required." }, { status: 400 });
    }
    if (!allowedTypes.has(profile.type)) {
      return Response.json({ error: "Use a PNG, JPG, or WebP profile image." }, { status: 400 });
    }
    if (profile.size > maxFileSize) {
      return Response.json({ error: "The profile image must be smaller than 10 MB." }, { status: 400 });
    }
    if (!phoneNumber || !email) {
      return Response.json({ error: "Phone number and email are required." }, { status: 400 });
    }
    if (!/^[+0-9 ()-]{7,20}$/.test(phoneNumber)) {
      return Response.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (email.length > 120) {
      return Response.json({ error: "The supplied details are too long." }, { status: 400 });
    }

    workingDirectory = await mkdtemp(path.join(os.tmpdir(), "insurebuddy-poster-"));
    const profilePath = path.join(workingDirectory, `profile${extensionFor(profile.type)}`);
    const outputPath = path.join(workingDirectory, "poster.jpg");

    await writeFile(profilePath, Buffer.from(await profile.arrayBuffer()));

    const projectDirectory = process.cwd();
    const pythonPath = process.env.POSTER_PYTHON || "python3";
    const scriptPath = path.join(projectDirectory, "template_1.py");
    const templatePath = path.join(projectDirectory, "Template.png");

    await runFile(
      pythonPath,
      [
        scriptPath,
        "--template", templatePath,
        "--profile", profilePath,
        "--phone-number", phoneNumber,
        "--email", email,
        "--output", outputPath,
      ],
      { cwd: projectDirectory, maxBuffer: 10 * 1024 * 1024 },
    );

    const poster = await readFile(outputPath);
    return new Response(new Uint8Array(poster), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="insurebuddy-poster.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Poster generation failed:", error);
    return Response.json(
      { error: "Generation failed. Check the server logs and try again." },
      { status: 500 },
    );
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
