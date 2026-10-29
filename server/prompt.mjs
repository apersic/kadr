const TEMPLATE = `Photoreal editorial still life for an Instagram graphic. Shot on a 50mm lens, soft natural daylight from one side, shallow depth of field with gentle bokeh. All tones, surfaces, and mood should be derived entirely from the brand, audience, and subject data provided below. Do not default to warm or neutral unless the data supports it.

The finished image is the whole graphic, including its frame. Build that frame only from the Frame block below. Do not add text, letters, numbers, a logo, a watermark, a brand mark, a readable label, a price tag, or packaging copy unless that block or the subject line allows it.

Photograph only the item named in the source line below, styled as a still life. Do not photograph paper, documents, screens, menus, or writing of any kind. Do not show a recognizable person. Hands are permitted if they add to the composition. When the Frame block lists a logo file, that logo may appear. Do not invent a different mark, a price, or packaging copy that is not in the subject line.

Brand: {{brand}}
Audience: {{audience}}
Goal of this post: {{goal}}
Format: {{format}}
{{look}}
Subject, taken only from this source line, nothing else: {{source}}
Photograph that subject and nothing else. Do not add a different product, ingredient, or drink.

Checked facts. Do not contradict these, and do not add prices, taste claims, health claims, or quotes:
{{facts}}

Style direction: Derive the palette, materials, props, lighting, and frame from the brand, audience, subject, and Frame block above. Do not impose a look that those lines do not support.

Props, if any, should be minimal and secondary, chosen to complement the subject and reinforce the brand world, not to decorate for decoration's sake. Lighting should feel honest and ambient, not studio-lit or artificial. The subject should be the clear hero of the frame. Color grade should reflect the brand's visual identity, accurate, intentional, and never oversaturated.

The final image should feel like it belongs natively inside the brand's existing content world, not like a generic stock photo dropped into it.`;

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

const ONE_SHOT = `Photoreal editorial still life for an Instagram graphic. Shot on a 50mm lens, soft natural daylight from one side, shallow depth of field with gentle bokeh. All tones, surfaces, and mood should be derived entirely from the brand, audience, and subject data provided below. Do not default to warm or neutral unless the data supports it.

This is one request for every image in the Outputs list. Generate each output as its own image, in order, in this same response. Do not stop after the first image. Do not describe a later output instead of generating it. Each subject below is specified. Generate it even when no reference photo is attached.

The finished image is the whole graphic, including its frame. Build that frame only from the Frame block below. Do not add text, letters, numbers, a logo, a watermark, a brand mark, a readable label, a price tag, or packaging copy unless that block or that output's subject line allows it.

Photograph only the item named in that output's subject line, styled as a still life. Do not photograph paper, documents, screens, menus, or writing of any kind. Do not show a recognizable person. Hands are permitted if they add to the composition. When the Frame block lists a logo file, that logo may appear. Do not invent a different mark, a price, or packaging copy that is not in the subject line. Do not add a different product, ingredient, or drink.

Brand: {{brand}}
Audience: {{audience}}
{{look}}

Outputs. Generate all {{count}} images:
{{outputs}}

Checked facts. Do not contradict these, and do not add prices, taste claims, health claims, or quotes:
{{facts}}

Style direction: Derive the palette, materials, props, lighting, and frame from the brand, audience, subject, and Frame block above. Do not impose a look that those lines do not support.

Props, if any, should be minimal and secondary, chosen to complement the subject and reinforce the brand world, not to decorate for decoration's sake. Lighting should feel honest and ambient, not studio-lit or artificial. The subject should be the clear hero of the frame. Color grade should reflect the brand's visual identity, accurate, intentional, and never oversaturated.

The final image should feel like it belongs natively inside the brand's existing content world, not like a generic stock photo dropped into it.`;

export function oneShotPrompt(input) {
  const outputs = input.outputs.map((item, index) => {
    const subject = plain(item.source).slice(0, 220) || input.brand;
    return `${index + 1}. Format: ${item.format}. Goal: ${item.goal}. Subject, taken only from this line: ${subject}.`;
  });
  const facts = input.outputs
    .map((item) => plain(item.source))
    .filter((fact, index, all) => fact.length > 0 && fact.length < 180 && all.indexOf(fact) === index);
  const factBlock = facts.length > 0 ? facts.map((fact) => `- ${fact}`).join("\n") : "- None. Show only the named subject, and take the frame from the Frame block.";
  return ONE_SHOT.replace("{{brand}}", input.brand)
    .replace("{{audience}}", input.audience || "Not specified")
    .replace("{{look}}", input.look)
    .replace("{{count}}", String(outputs.length))
    .replace("{{outputs}}", outputs.join("\n"))
    .replace("{{facts}}", factBlock);
}

export function graphicPrompt(input) {
  const facts = input.facts.filter((fact) => fact.length > 0 && fact.length < 180).slice(0, 4);
  const factBlock = facts.length > 0 ? facts.map((fact) => `- ${fact}`).join("\n") : "- None. Show only the named subject, and take the frame from the Frame block.";
  return TEMPLATE.replace("{{brand}}", input.brand)
    .replace("{{audience}}", input.audience || "Not specified")
    .replace("{{goal}}", input.goal || "A finished post")
    .replace("{{format}}", input.format)
    .replace("{{source}}", plain(input.source).slice(0, 220) || input.brand)
    .replace("{{facts}}", factBlock)
    .replace("{{look}}", input.look);
}
