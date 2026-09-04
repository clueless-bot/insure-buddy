"use client";

import { TEMPLATE_1_URLS } from "@/template_1_urls";

const DPI = 96;
const CM_PER_INCH = 2.54;
const POINTS_PER_INCH = 72;
const FONT_FAMILY = "Template 1 DM Sans";

function cmToPx(value: number) {
  return Math.round((value * DPI) / CM_PER_INCH);
}

function pointsToPx(value: number) {
  return Math.round((value * DPI) / POINTS_PER_INCH);
}

async function fetchBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Poster asset could not be loaded: ${url}`);
  }
  return response.blob();
}

async function loadTemplateFont() {
  if (document.fonts.check(`16px "${FONT_FAMILY}"`)) return;

  const font = new FontFace(FONT_FAMILY, `url(${TEMPLATE_1_URLS.font})`, {
    style: "normal",
    weight: "400",
  });
  await font.load();
  document.fonts.add(font);
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
}

function drawTextBox(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = "#ffffff";
  context.font = `${pointsToPx(34.1)}px "${FONT_FAMILY}"`;
  context.textBaseline = "top";
  context.fillText(text, x, y);
  context.restore();
}

export type GenerateTemplate1ClientOptions = {
  profileImage: File;
  phoneNumber: string;
  email: string;
  onModelProgress?: (percent: number) => void;
};

/** Render Template 1 entirely in the browser without uploading user data. */
export async function generateTemplate1ImageClient({
  profileImage,
  phoneNumber,
  email,
  onModelProgress,
}: GenerateTemplate1ClientOptions) {
  const [{ removeBackground }, templateBlob] = await Promise.all([
    import("@imgly/background-removal"),
    fetchBlob(TEMPLATE_1_URLS.template),
    loadTemplateFont(),
  ]);

  const foregroundBlob = await removeBackground(profileImage, {
    model: "isnet_fp16",
    output: {
      format: "image/png",
      quality: 1,
    },
    progress: (_key, current, total) => {
      if (total > 0) {
        onModelProgress?.(Math.min(100, Math.round((current / total) * 100)));
      }
    },
  });

  const [template, foreground] = await Promise.all([
    createImageBitmap(templateBlob),
    createImageBitmap(foregroundBlob),
  ]);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = template.width;
    canvas.height = template.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

    context.drawImage(template, 0, 0);

    const photoX = cmToPx(23.43);
    const photoY = cmToPx(9.1);
    const photoWidth = cmToPx(20.41);
    const photoHeight = cmToPx(28.06);

    context.save();
    context.beginPath();
    context.ellipse(
      photoX + photoWidth / 2,
      photoY + photoHeight / 2,
      photoWidth / 2,
      photoHeight / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.clip();
    drawCover(context, foreground, photoX, photoY, photoWidth, photoHeight);
    context.restore();

    drawTextBox(
      context,
      email,
      cmToPx(22.3),
      cmToPx(38.28),
      cmToPx(19.25),
      cmToPx(1.43),
    );
    drawTextBox(
      context,
      phoneNumber,
      cmToPx(22.25),
      cmToPx(40.39),
      cmToPx(18.23),
      cmToPx(1.43),
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("JPEG generation failed.")),
        "image/jpeg",
        0.95,
      );
    });
  } finally {
    template.close();
    foreground.close();
  }
}
