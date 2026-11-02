const TEMPLATE = `Photoreal editorial still life for an Instagram graphic. Shot on a 50mm lens, soft natural daylight from one side, shallow depth of field with gentle bokeh. All tones, surfaces, and mood should be derived entirely from the brand, audience, and subject data provided below. Do not default to warm or neutral unless the data supports it.

The finished image is the whole graphic, including its frame. Build that frame only from the Frame block below. Do not add a price, a health claim, or a second logo. The pack may show its own product name.

The subject is the closed retail pack of the named product, the thing a shopper would pick up. Do not show the food loose, in a bowl, on a plate, or as a pile of ingredients. Do not show a different product. Do not show a recognizable person. Hands are permitted only if they hold the pack. Do not ask for a reference photo, a logo upload, or any other file. This text is the whole request. A logo address in the Frame block is not a picture to attach.

Brand: {{brand}}
Audience: {{audience}}
Goal of this post: {{goal}}
Format: {{format}}
{{look}}
Subject, the closed retail pack only: {{source}}
Show that pack and nothing else. Do not add a different product, ingredient, or drink. Do not replace the pack with a serving of the food.

Checked facts. Do not contradict these, and do not add prices, taste claims, health claims, or quotes:
{{facts}}

Same brief, same kind of picture. The hero stays the closed pack named above. Do not restage the product as a snack scene.`;

function pieces(value) {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function clip(value, max) {
  const clean = value.replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^(.{8,48}?[.!?])/);
  if (sentence) return sentence[1].trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 12 ? cut.slice(0, space) : cut).trim();
}

function plain(value) {
  return value
    .replace(/#\S+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function headlineFrom(text, products, brand) {
  const source = plain(text);
  const lower = source.toLowerCase();
  const named = pieces(products).find((part) => lower.includes(part.toLowerCase()));
  if (named) return named;
  const parts = source
    .split(/\s[-–—|]\s|:\s/)
    .map((part) => part.trim())
    .filter((part) => part.length > 6 && !/instagram\.com|https?:\/\//i.test(part));
  const pointed = parts.at(-1) ?? source;
  return clip(pointed, 42) || brand;
}

function promptFormat(format) {
  const value = String(format ?? "").trim();
  if (/9\s*:\s*16|story|priča|prica/i.test(value)) {
    return /9\s*:\s*16/.test(value) ? value : `${value}, 9:16`;
  }
  if (/16\s*:\s*9|4\s*:\s*5|1\s*:\s*1/.test(value)) return value;
  return value ? `${value}, 1:1` : "1:1";
}

export function graphicPrompt(input) {
  const facts = input.facts.filter((fact) => fact.length > 0 && fact.length < 180).slice(0, 4);
  const factBlock = facts.length > 0 ? facts.map((fact) => `- ${fact}`).join("\n") : "- None. Show only the named pack, and take the frame from the Frame block.";
  const format = promptFormat(input.format);
  const body = TEMPLATE.replace("{{brand}}", input.brand)
    .replace("{{audience}}", input.audience || "Not specified")
    .replace("{{goal}}", input.goal || "A finished post")
    .replace("{{format}}", format)
    .replace("{{source}}", plain(input.source).slice(0, 220) || input.brand)
    .replace("{{facts}}", factBlock)
    .replace("{{look}}", input.look);
  if (/9\s*:\s*16/.test(format)) {
    return `${body}\n\nCanvas: portrait 9:16. The height is sixteen units and the width is nine. Do not return a square.`;
  }
  return body;
}

export function slideCaption(format, caption, source) {
  if (String(format ?? "").startsWith("Karusel")) {
    const subject = String(source ?? "").trim();
    return subject ? `${subject}\n\nIzvor, ne nova tvrdnja.` : String(caption ?? "");
  }
  return String(caption ?? "");
}

function replyText(item) {
  const caption = String(item.caption ?? "").trim() || "None";
  const format = String(item.format ?? "").trim() || "None";
  const goal = String(item.goal ?? "").trim() || "None";
  const why = String(item.why ?? "").trim() || "None";
  return `Natpis:\n${caption}\n\nFormat: ${format}\nCilj: ${goal}\nObrazloženje: ${why}`;
}

const CHAT = `Generate one image. {{canvas}}

One package, centered, on a plain background. Soft daylight from one side. The only words on the package are "{{source}}". No people, no price, no health claim, no second product, no bowl, no spilled food.

Brand: {{brand}}
Audience: {{audience}}
Goal of this post: {{goal}}
Format: {{format}}
{{look}}

After the image, copy this text exactly. Do not draw it into the image.

{{reply}}`;

function chatLook(look) {
  return String(look ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !/https?:\/\//i.test(line) && !/\blogo\b/i.test(line))
    .join("\n");
}

function chatCanvas(format) {
  if (/9\s*:\s*16/.test(format)) {
    return "Portrait, 9:16. The height is sixteen units and the width is nine.";
  }
  return "Square, 1:1.";
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

export function separatePrompts(input) {
  return input.outputs.map((item) => {
    const format = promptFormat(item.format);
    const source = plain(String(item.source ?? "")).slice(0, 220) || input.brand;
    return fill(CHAT, {
      canvas: chatCanvas(format),
      source,
      brand: input.brand,
      audience: input.audience || "Not specified",
      goal: item.goal || "A finished post",
      format,
      look: chatLook(input.look),
      reply: replyText(item),
    });
  });
}
