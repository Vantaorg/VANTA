import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandingDir = path.join(frontendRoot, "public", "branding");
const archivePath = path.join(brandingDir, "vanta-original-logo-assets.zip");

function extractEntries(zipBuffer) {
  let eocd = -1;
  const min = Math.max(0, zipBuffer.length - 22 - 0xffff);
  for (let i = zipBuffer.length - 22; i >= min; i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Branding ZIP has no end-of-central-directory record.");

  const count = zipBuffer.readUInt16LE(eocd + 10);
  let cursor = zipBuffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Branding ZIP central directory is malformed.");
    }
    const method = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(cursor + 24);
    const nameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localOffset = zipBuffer.readUInt32LE(cursor + 42);
    const name = zipBuffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Branding ZIP local header is missing for ${name}.`);
    }
    const localNameLength = zipBuffer.readUInt16LE(localOffset + 26);
    const localExtraLength = zipBuffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
    let data;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
    if (data.length !== uncompressedSize) {
      throw new Error(`Unexpected extracted size for ${name}.`);
    }
    entries.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

if (!fs.existsSync(archivePath)) {
  throw new Error(`Original VANTA branding archive not found: ${archivePath}`);
}

const entries = extractEntries(fs.readFileSync(archivePath));
const required = [
  "apple-touch-icon-180.png",
  "favicon-32.png",
  "favicon-64.png",
  "play-store-512.png",
  "pwa-192.png",
  "pwa-512.png",
  "pwa-maskable-512.png",
  "vanta-logo-original-1536.png",
];

for (const name of required) {
  const data = entries.get(name);
  if (!data) throw new Error(`Required VANTA branding asset is missing: ${name}`);
  const outputName =
    name === "vanta-logo-original-1536.png" ? "vanta-logo-original-1536.jpg" : name;
  fs.writeFileSync(path.join(brandingDir, outputName), data);
}

console.log(`Installed ${required.length} original VANTA web branding assets.`);
