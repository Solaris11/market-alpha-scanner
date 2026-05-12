import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../public/marketing/qr");
const targetUrl = process.env.TRADEVETO_QR_TARGET_URL ?? "https://tradeveto.com/join";

const colors = {
  ink: "#020617",
  panel: "#ffffff",
  cyan: "#22d3ee",
  cyanDeep: "#0891b2",
  text: "#e5fbff",
  muted: "#8da2b8",
  bg: "#030712",
  bg2: "#07111f",
};

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}

async function makeQrPng(options = {}) {
  return QRCode.toBuffer(targetUrl, {
    errorCorrectionLevel: "H",
    margin: options.margin ?? 4,
    width: options.width ?? 2048,
    color: {
      dark: options.dark ?? `${colors.ink}ff`,
      light: options.light ?? `${colors.panel}ff`,
    },
  });
}

async function makeQrSvg() {
  return QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 2048,
    color: {
      dark: `${colors.ink}ff`,
      light: `${colors.panel}ff`,
    },
  });
}

function brandedSvg({ width, height, qrDataUri, qrSize, qrX, qrY, titleY, subtitleY, captionY }) {
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.bg}"/>
      <stop offset="0.62" stop-color="${colors.bg2}"/>
      <stop offset="1" stop-color="#041321"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${colors.cyanDeep}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="56" fill="none" stroke="url(#ring)" stroke-width="3"/>
  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(width * 0.044)}" font-weight="800" letter-spacing="7" fill="${colors.cyan}">TRADEVETO</text>
  <text x="${width / 2}" y="${subtitleY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(width * 0.058)}" font-weight="800" fill="${colors.text}">Scan to join</text>
  <text x="${width / 2}" y="${captionY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(width * 0.026)}" font-weight="700" letter-spacing="5" fill="${colors.muted}">INVITE-ONLY BETA</text>
  <rect x="${qrX - 34}" y="${qrY - 34}" width="${qrSize + 68}" height="${qrSize + 68}" rx="42" fill="#ffffff"/>
  <rect x="${qrX - 34}" y="${qrY - 34}" width="${qrSize + 68}" height="${qrSize + 68}" rx="42" fill="none" stroke="${colors.cyan}" stroke-opacity="0.28" stroke-width="4"/>
  <image href="${qrDataUri}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${width / 2}" y="${qrY + qrSize + 120}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(width * 0.027)}" font-weight="700" fill="${colors.text}">${escapeXml(targetUrl.replace("https://", ""))}</text>
</svg>`;
}

function storyOverlaySvg({ width, height, qrDataUri }) {
  const panelX = 72;
  const panelY = 1110;
  const panelW = width - panelX * 2;
  const panelH = 520;
  const qrSize = 330;
  const qrX = panelX + 48;
  const qrY = panelY + 96;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="20" flood-color="#000000" flood-opacity="0.42"/>
    </filter>
  </defs>
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="48" fill="#030712" fill-opacity="0.92" stroke="${colors.cyan}" stroke-opacity="0.38" stroke-width="3" filter="url(#shadow)"/>
  <rect x="${qrX - 18}" y="${qrY - 18}" width="${qrSize + 36}" height="${qrSize + 36}" rx="28" fill="#ffffff"/>
  <image href="${qrDataUri}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${qrX + qrSize + 64}" y="${panelY + 150}" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" letter-spacing="5" fill="${colors.cyan}">TRADEVETO</text>
  <text x="${qrX + qrSize + 64}" y="${panelY + 220}" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="850" fill="${colors.text}">Scan to join</text>
  <text x="${qrX + qrSize + 64}" y="${panelY + 288}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="${colors.muted}">Invite-only beta</text>
  <text x="${qrX + qrSize + 64}" y="${panelY + 350}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="650" fill="${colors.text}">${escapeXml(targetUrl.replace("https://", ""))}</text>
</svg>`;
}

async function decodeQr(buffer, label, options = {}) {
  let image = sharp(buffer, { failOn: "none" });
  if (options.flatten) {
    image = image.flatten({ background: options.flatten });
  }
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luminances = new Uint8ClampedArray(info.width * info.height);
  for (let sourceIndex = 0, pixelIndex = 0; sourceIndex < data.length; sourceIndex += info.channels, pixelIndex += 1) {
    const r = data[sourceIndex] ?? 255;
    const g = data[sourceIndex + 1] ?? r;
    const b = data[sourceIndex + 2] ?? r;
    luminances[pixelIndex] = Math.round((r + g * 2 + b) / 4);
  }
  const source = new RGBLuminanceSource(luminances, info.width, info.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const result = new QRCodeReader().decode(bitmap).getText();
  if (result !== targetUrl) {
    throw new Error(`${label} decoded to ${result}, expected ${targetUrl}`);
  }
  return { label, decoded: result, width: info.width, height: info.height };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const standardPng = await makeQrPng();
  const transparentDarkPng = await makeQrPng({ dark: `${colors.ink}ff`, light: "#00000000" });
  const svg = await makeQrSvg();
  const darkQrDataUri = `data:image/png;base64,${(await makeQrPng({ width: 1520 })).toString("base64")}`;
  const socialQrDataUri = `data:image/png;base64,${(await makeQrPng({ width: 580 })).toString("base64")}`;
  const storyQrDataUri = `data:image/png;base64,${(await makeQrPng({ width: 330 })).toString("base64")}`;

  const darkSvg = brandedSvg({
    width: 2600,
    height: 2600,
    qrDataUri: darkQrDataUri,
    qrSize: 1520,
    qrX: 540,
    qrY: 620,
    titleY: 238,
    subtitleY: 345,
    captionY: 430,
  });
  const socialSvg = brandedSvg({
    width: 1080,
    height: 1080,
    qrDataUri: socialQrDataUri,
    qrSize: 580,
    qrX: 250,
    qrY: 300,
    titleY: 105,
    subtitleY: 165,
    captionY: 218,
  });
  const storySvg = storyOverlaySvg({ width: 1080, height: 1920, qrDataUri: storyQrDataUri });

  const darkPng = await sharp(Buffer.from(darkSvg)).png({ compressionLevel: 9 }).toBuffer();
  const socialPng = await sharp(Buffer.from(socialSvg)).png({ compressionLevel: 9 }).toBuffer();
  const storyPng = await sharp(Buffer.from(storySvg)).png({ compressionLevel: 9 }).toBuffer();
  const svgPng = await sharp(Buffer.from(svg)).png().toBuffer();
  const lowBrightnessPng = await sharp(standardPng).modulate({ brightness: 0.62 }).png().toBuffer();
  const compressedPng = await sharp(standardPng).resize(360, 360, { kernel: "nearest" }).jpeg({ quality: 62 }).toBuffer();
  const socialCompressedPng = await sharp(socialPng).resize(540, 540).jpeg({ quality: 72 }).toBuffer();

  const files = [
    ["tradeveto-register-qr.png", standardPng],
    ["tradeveto-register-qr.svg", svg],
    ["tradeveto-register-qr-transparent.png", transparentDarkPng],
    ["tradeveto-register-qr-dark.png", darkPng],
    ["tradeveto-register-qr-social-square.png", socialPng],
    ["tradeveto-register-qr-story-overlay.png", storyPng],
  ];
  await Promise.all(files.map(([name, content]) => writeFile(path.join(outputDir, name), content)));

  const validations = [
    await decodeQr(standardPng, "standard PNG"),
    await decodeQr(svgPng, "SVG raster decode"),
    await decodeQr(transparentDarkPng, "transparent dark modules on light background", { flatten: "#ffffff" }),
    await decodeQr(darkPng, "dark branded PNG"),
    await decodeQr(socialPng, "social square PNG"),
    await decodeQr(storyPng, "story overlay PNG", { flatten: colors.bg }),
    await decodeQr(lowBrightnessPng, "low brightness simulation"),
    await decodeQr(compressedPng, "small compressed QR simulation"),
    await decodeQr(socialCompressedPng, "compressed social simulation"),
  ];

  const manifest = {
    target_url: targetUrl,
    redirect_routes: ["/join", "/beta", "/invite"],
    production_asset_base_path: "/marketing/qr/",
    files: files.map(([name]) => name),
    validation: validations.map(({ label, width, height }) => ({ label, width, height, decoded_url: targetUrl })),
    usage_notes: [
      "Use tradeveto-register-qr.png or tradeveto-register-qr-dark.png for highest scan reliability.",
      "Use tradeveto-register-qr-transparent.png only on light backgrounds.",
      "Use tradeveto-register-qr-dark.png on dark posters instead of inverted transparent QR art.",
      "Keep a clear quiet zone around the QR code when placing it into posters.",
    ],
  };
  await writeFile(path.join(outputDir, "qr-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const validation of validations) {
    console.log(`[qr] OK ${validation.label}: ${validation.width}x${validation.height} -> ${validation.decoded}`);
  }
  console.log(`[qr] Generated ${files.length} QR assets in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
