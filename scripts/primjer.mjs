import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { studio } from "../server/studio.mjs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].trim();
}

const brief = {
  brand: "GymBeam",
  website: "https://gymbeam.hr/",
  instagram: "https://www.instagram.com/gymbeamhr/",
  products: "MoiMuv Protein Milkshake, Proteinski chips, Vitamin C 1000 mg",
  audience: "Sportaši i ljudi koji kupuju dodatke prehrani.",
  goals: "Spremanja na proizvodima sa stranice.",
  references: "",
};

const result = await studio(brief);
const dir = new URL("../docs/primjer/", import.meta.url);
mkdirSync(dir, { recursive: true });

const lines = [
  `Profil: ${brief.instagram}`,
  `Stranica: ${brief.website}`,
  `Proizvodi: ${brief.products}`,
  `Publika: ${brief.audience}`,
  `Cilj brifa: ${brief.goals}`,
  `Model: ${process.env.IMAGE_PROVIDER || "pollinations"} / ${process.env.IMAGE_MODEL || "flux"}`,
  result.imageNote,
  "",
];

result.analysis.posts.forEach((post, postIndex) => {
  lines.push(`Objava ${post.id}`);
  lines.push(`Format: ${post.format}`);
  lines.push(`Cilj: ${post.goal}`);
  lines.push(`Obrazloženje: ${post.why}`);
  lines.push("Natpis:");
  lines.push(post.caption);
  const frames = result.frames[postIndex] ?? [];
  frames.forEach((src, frameIndex) => {
    const match = src.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      lines.push(`Slika ${frameIndex + 1}: nije vraćena`);
      return;
    }
    const bytes = Buffer.from(match[2], "base64");
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const name = `objava-${post.id}-${frameIndex + 1}.${jpeg ? "jpg" : "png"}`;
    writeFileSync(new URL(name, dir), bytes);
    lines.push(`Slika ${frameIndex + 1}: ${name}`);
  });
  lines.push("");
});

lines.push("Predlošci");
result.prompts.forEach((item, index) => {
  const name = `prompt-${index + 1}.txt`;
  writeFileSync(new URL(name, dir), item.text);
  lines.push(`${index + 1}. ${name}. ${item.label}`);
});

writeFileSync(new URL("objave.txt", dir), lines.filter((line) => line !== undefined).join("\n"));
console.log(`posts ${result.analysis.posts.length} images ${result.frames.flat().filter(Boolean).length} note ${result.imageNote || "none"}`);
