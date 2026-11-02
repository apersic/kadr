import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function jpegSize(bytes) {
  let index = 2;
  while (index < bytes.length - 8) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = bytes[index + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return [bytes.readUInt16BE(index + 7), bytes.readUInt16BE(index + 5)];
    }
    index += 2 + bytes.readUInt16BE(index + 2);
  }
  return [0, 0];
}

export function fitStoryFrame(dataUrl) {
  const match = String(dataUrl).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return dataUrl;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return dataUrl;
  const [width, height] = jpegSize(bytes);
  const targetWidth = Math.round((height * 9) / 16);
  if (!width || !height || height <= width || Math.abs(width - targetWidth) < 8) return dataUrl;
  const x = Math.max(0, Math.floor((width - targetWidth) / 2));
  const dir = mkdtempSync(join(tmpdir(), "kadr-"));
  const input = join(dir, "in.jpg");
  const output = join(dir, "out.jpg");
  writeFileSync(input, bytes);
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", input, "-vf", `crop=${targetWidth}:${height}:${x}:0`, "-q:v", "2", output],
    { stdio: "ignore" },
  );
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return dataUrl;
  }
  const cropped = readFileSync(output);
  rmSync(dir, { recursive: true, force: true });
  return `data:image/jpeg;base64,${cropped.toString("base64")}`;
}

function provider() {
  return (process.env.IMAGE_PROVIDER || "pollinations").toLowerCase();
}

function modelName() {
  return process.env.IMAGE_MODEL || (provider() === "openai" ? "gpt-image-1" : "flux");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollinations(prompt, width, height) {
  const key = process.env.IMAGE_API_KEY?.trim();
  const headers = { "user-agent": "kadr/1.0", "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const endpoint = key
    ? "https://gen.pollinations.ai/v1/images/generations"
    : "https://image.pollinations.ai/prompt/";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const gpt = /gpt/i.test(modelName());
    const response = key
      ? await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelName(),
            prompt,
            size: `${width}x${height}`,
            response_format: "b64_json",
            nologo: true,
            enhance: false,
            ...(gpt ? { quality: "high" } : {}),
          }),
          signal: AbortSignal.timeout(180000),
        })
      : await fetch(
          `${endpoint}${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${encodeURIComponent(modelName())}&nologo=true&enhance=false`,
          { headers, signal: AbortSignal.timeout(180000) },
        );
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.startsWith("image/")) {
      const bytes = Buffer.from(await response.arrayBuffer());
      const mime = type.split(";")[0] || "image/jpeg";
      return `data:${mime};base64,${bytes.toString("base64")}`;
    }
    if (response.ok && type.includes("json")) {
      const payload = await response.json();
      const first = payload && Array.isArray(payload.data) ? payload.data[0] : null;
      if (first && typeof first.b64_json === "string") return `data:image/png;base64,${first.b64_json}`;
      if (first && typeof first.url === "string") {
        const image = await fetch(first.url, { signal: AbortSignal.timeout(30000) });
        const bytes = Buffer.from(await image.arrayBuffer());
        return `data:image/png;base64,${bytes.toString("base64")}`;
      }
    }
    const body = await response.text();
    if (response.status === 429 || /retry after/i.test(body)) {
      const wait = Number(body.match(/Retry after (\d+)s/i)?.[1] ?? 20) + 1;
      await sleep(wait * 1000);
      continue;
    }
    const detail = body.replace(/\s+/g, " ").trim().slice(0, 220);
    throw new Error(detail || `Model slika je vratio ${response.status}.`);
  }
  throw new Error("Model slika je zauzet.");
}

async function openAi(prompt, width, height) {
  const key = process.env.IMAGE_API_KEY?.trim();
  if (!key) {
    throw new Error("U .env nedostaje IMAGE_API_KEY.");
  }
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelName(),
      prompt,
      size: height > width ? "1024x1536" : "1024x1024",
      quality: "medium",
    }),
    signal: AbortSignal.timeout(90000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : `OpenAI je vratio ${response.status}.`;
    throw new Error(message);
  }
  const first = payload && Array.isArray(payload.data) ? payload.data[0] : null;
  if (first && typeof first.b64_json === "string") {
    return `data:image/png;base64,${first.b64_json}`;
  }
  if (first && typeof first.url === "string") {
    const image = await fetch(first.url, { signal: AbortSignal.timeout(30000) });
    const bytes = Buffer.from(await image.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  }
  throw new Error("OpenAI nije vratio sliku.");
}

async function generateImage(prompt, width, height) {
  const name = provider();
  if (name === "openai") return openAi(prompt, width, height);
  if (name === "pollinations") return pollinations(prompt, width, height);
  throw new Error(`Nepoznat IMAGE_PROVIDER: ${name}`);
}

export async function generateAll(jobs) {
  const frames = jobs.map((job) => job.slides.map(() => ""));
  const failures = [];
  let cursor = 0;
  const flat = jobs.flatMap((job, postIndex) =>
    job.slides.map((slide, slideIndex) => ({ postIndex, slideIndex, slide })),
  );

  async function worker() {
    while (cursor < flat.length) {
      const index = cursor;
      cursor += 1;
      const item = flat[index];
      if (!item) continue;
      try {
        const tall = item.slide.tall;
        const gpt = /gpt/i.test(modelName());
        let image = await generateImage(
          item.slide.prompt,
          tall && !gpt ? 720 : 1024,
          tall ? (gpt ? 1536 : 1280) : 1024,
        );
        frames[item.postIndex][item.slideIndex] = tall ? fitStoryFrame(image) : image;
      } catch (error) {
        frames[item.postIndex][item.slideIndex] = "";
        const message = error instanceof Error ? error.message : "Model nije vratio sliku.";
        if (!failures.includes(message)) failures.push(message);
      }
    }
  }

  const workers = process.env.IMAGE_API_KEY?.trim() ? Math.min(3, flat.length) : 1;
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { frames, failures };
}
