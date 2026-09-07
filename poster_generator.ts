"use client";

import { POSTER_ASSET_URLS } from "@/poster_assets";

const FONT_FAMILY = "Poster Studio DM Sans";
const DEFAULT_FONT_SIZE = 28;
const MIN_FONT_SIZE = 14;

export const POSTER_COORDINATES = Object.freeze({
  email: { x: 332.5, y: 796.7, width: 639.5, height: 35.2 },
  phone: { x: 337, y: 841.9, width: 281.6, height: 35.2 },
  image: { x: 671.3, y: 198.1, width: 340.5, height: 423.1 },
});

export type Contact = {
  email: string;
  phoneNumber: string;
};

export type GeneratedPoster = Contact & {
  blob: Blob;
  filename: string;
  templateName: string;
  width: number;
  height: number;
};

export type GenerationProgress =
  | { phase: "model"; percent: number }
  | { phase: "rendering"; current: number; total: number };

let fontPromise: Promise<FontFace> | undefined;
const foregroundCache = new WeakMap<File, Promise<Blob>>();

function loadPosterFont() {
  if (!fontPromise) {
    const font = new FontFace(FONT_FAMILY, `url(${POSTER_ASSET_URLS.font})`, {
      style: "normal",
      weight: "400",
    });
    fontPromise = font.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      return loadedFont;
    });
  }
  return fontPromise;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseContactsCsv(csv: string): Contact[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("The CSV must contain a header and at least one contact row.");
  }

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = headers.findIndex((header) =>
    ["email", "emailaddress", "mail", "mailid"].includes(header),
  );
  const phoneIndex = headers.findIndex((header) =>
    ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber"].includes(header),
  );

  if (emailIndex < 0 || phoneIndex < 0) {
    throw new Error("CSV headers must include email and phone (or phone number/mobile). ");
  }

  const contacts = rows.slice(1).map((values, rowIndex) => ({
    email: (values[emailIndex] || "").trim(),
    phoneNumber: (values[phoneIndex] || "").trim(),
    rowNumber: rowIndex + 2,
  }));
  const incomplete = contacts.find((contact) => !contact.email || !contact.phoneNumber);
  if (incomplete) {
    throw new Error(`CSV row ${incomplete.rowNumber} is missing an email or phone number.`);
  }

  return contacts.map(({ email, phoneNumber }) => ({ email, phoneNumber }));
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  context.save();
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.clip();

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );

  context.restore();
}

function drawTextBox(
  context: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; width: number; height: number },
) {
  let fontSize = DEFAULT_FONT_SIZE;
  context.font = `${fontSize}px "${FONT_FAMILY}"`;
  while (fontSize > MIN_FONT_SIZE && context.measureText(text).width > box.width) {
    fontSize -= 1;
    context.font = `${fontSize}px "${FONT_FAMILY}"`;
  }

  context.save();
  context.beginPath();
  context.rect(box.x, box.y, box.width, box.height);
  context.clip();
  context.fillStyle = "#ffffff";
  context.font = `${fontSize}px "${FONT_FAMILY}"`;
  context.textBaseline = "middle";
  context.fillText(text, box.x, box.y + box.height / 2, box.width);
  context.restore();
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("JPEG generation failed.")),
      "image/jpeg",
      0.95,
    );
  });
}

function safeName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "poster";
}

async function removeProfileBackground(
  profileImage: File,
  onProgress?: (progress: GenerationProgress) => void,
) {
  const cached = foregroundCache.get(profileImage);
  if (cached) return cached;

  const promise = import("@imgly/background-removal").then(({ removeBackground }) =>
    removeBackground(profileImage, {
      model: "isnet_fp16",
      output: { format: "image/png", quality: 1 },
      progress: (_key, current, total) => {
        if (total > 0) {
          onProgress?.({
            phase: "model",
            percent: Math.min(100, Math.round((current / total) * 100)),
          });
        }
      },
    }),
  );
  foregroundCache.set(profileImage, promise);

  try {
    return await promise;
  } catch (error) {
    foregroundCache.delete(profileImage);
    throw error;
  }
}

export async function generatePosters({
  templates,
  profileImage,
  contacts,
  onProgress,
}: {
  templates: File[];
  profileImage: File;
  contacts: Contact[];
  onProgress?: (progress: GenerationProgress) => void;
}) {
  if (!templates.length) throw new Error("Upload at least one poster template.");
  if (!contacts.length) throw new Error("Add at least one contact.");

  const [foregroundBlob] = await Promise.all([
    removeProfileBackground(profileImage, onProgress),
    loadPosterFont(),
  ]);
  const foreground = await createImageBitmap(foregroundBlob);
  const results: GeneratedPoster[] = [];
  const total = templates.length * contacts.length;

  try {
    for (const templateFile of templates) {
      const template = await createImageBitmap(templateFile);
      try {
        for (const contact of contacts) {
          const canvas = document.createElement("canvas");
          canvas.width = template.width;
          canvas.height = template.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

          context.drawImage(template, 0, 0);
          const image = POSTER_COORDINATES.image;
          drawCover(context, foreground, image.x, image.y, image.width, image.height);
          drawTextBox(context, contact.email, POSTER_COORDINATES.email);
          drawTextBox(context, contact.phoneNumber, POSTER_COORDINATES.phone);

          const blob = await canvasToJpeg(canvas);
          const sequence = results.length + 1;
          const phoneValue = contact.phoneNumber.replace(/[^\d+]/g, "").replace(/^\+/, "");
          const filenameBase = `${safeName(templateFile.name)}-${safeName(contact.phoneNumber || `contact-${sequence}`)}-${safeName(contact.email)}`;
          results.push({
            ...contact,
            blob,
            filename: `${filenameBase}.jpg`,
            templateName: templateFile.name,
            width: template.width,
            height: template.height,
          });
          onProgress?.({ phase: "rendering", current: sequence, total });
        }
      } finally {
        template.close();
      }
    }
  } finally {
    foreground.close();
  }

  return results;
}
