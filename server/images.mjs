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
        frames[item.postIndex][item.slideIndex] = await generateImage(
          item.slide.prompt,
          1024,
          tall ? (gpt ? 1536 : 1280) : 1024,
        );
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
