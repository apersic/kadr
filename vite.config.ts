import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv } from "vite";

type BriefBody = {
  brand?: string;
  website?: string;
  instagram?: string;
  products?: string;
  audience?: string;
  goals?: string;
  references?: string;
};

function readJson(req: IncomingMessage, res: ServerResponse, onBody: (value: unknown) => Promise<void>) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("POST only");
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    void (async () => {
      try {
        await onBody(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch (error) {
        if (res.writableEnded) return;
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Zahtjev nije uspio." }));
      }
    })();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function asBrief(value: unknown): BriefBody {
  return {
    brand: readField(value, "brand"),
    website: readField(value, "website"),
    instagram: readField(value, "instagram"),
    products: readField(value, "products"),
    audience: readField(value, "audience"),
    goals: readField(value, "goals"),
    references: readField(value, "references"),
  };
}

function requireBrief(brief: BriefBody, res: ServerResponse): brief is Required<Pick<BriefBody, "brand" | "website" | "instagram" | "products">> & BriefBody {
  if (!brief.brand || !brief.website || !brief.instagram || !brief.products) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Brend, stranica, Instagram i proizvodi su obavezni." }));
    return false;
  }
  return true;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "kadr-analyze",
      configureServer(server) {
        const env = loadEnv(server.config.mode, server.config.root, "");
        if (env.IMAGE_PROVIDER) process.env.IMAGE_PROVIDER = env.IMAGE_PROVIDER;
        if (env.IMAGE_MODEL) process.env.IMAGE_MODEL = env.IMAGE_MODEL;
        if (env.IMAGE_API_KEY) process.env.IMAGE_API_KEY = env.IMAGE_API_KEY;

        server.middlewares.use("/api/studio", (req, res) => {
          readJson(req, res, async (value) => {
            const brief = asBrief(value);
            if (!requireBrief(brief, res)) return;
            const { studio } = await import("./server/studio.mjs");
            const result = await studio({
              brand: brief.brand,
              website: brief.website,
              instagram: brief.instagram,
              products: brief.products,
              audience: brief.audience ?? "",
              goals: brief.goals ?? "",
              references: brief.references ?? "",
            });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result));
          });
        });
      },
    },
  ],
  server: { port: 5174, strictPort: true },
});
