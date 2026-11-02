import { analyze } from "./analyze.mjs";
import { generateAll } from "./images.mjs";
import { graphicPrompt, headlineFrom, separatePrompts, slideCaption } from "./prompt.mjs";

function units(post) {
  if (post.id === 2 && post.slides && post.slides.length > 0) {
    return post.slides.map((slide) => ({
      title: slide.title,
      detail: slide.detail,
      tall: false,
    }));
  }
  if (post.id === 3) {
    return [{ title: post.lines[0] ?? "", detail: post.lines[1] ?? "", tall: true }];
  }
  return [{ title: post.lines[0] ?? "", detail: post.lines[1] ?? "", tall: false }];
}

function lookFrom(design) {
  if (!design?.fromSite) {
    return "Frame: the website did not publish a typeface, a color, or a logo. Do not invent a frame. Return only the photograph of the subject, with no poster, no bar, no caption, and no default palette.";
  }
  const lines = ["Frame, taken from the brand website. Use these values and no others:"];
  if (design.font) lines.push(`- Typeface: ${design.font}`);
  if (design.ink) lines.push(`- Text color: ${design.ink}`);
  if (design.paper) lines.push(`- Background: ${design.paper}`);
  if (design.accent && design.accent !== design.ink) lines.push(`- Accent: ${design.accent}`);
  if (design.logoUrl) lines.push(`- Logo address: ${design.logoUrl}`);
  return lines.join("\n");
}

export async function studio(brief) {
  const analysis = await analyze(brief);
  const look = lookFrom(analysis.site.design);
  const outputs = [];
  const jobs = analysis.posts.map((post) => {
    const pieces = units(post);
    const slides = pieces.map((unit) => {
      const source = [unit.detail, unit.title, brief.brand].find(
        (line) => line && !/instagram\.com|https?:\/\//i.test(line),
      ) || brief.brand;
      outputs.push({
        format: post.format,
        goal: post.goal,
        caption: slideCaption(post.format, post.caption, source),
        why: post.why,
        source,
      });
      const headline = headlineFrom(source, brief.products, brief.brand);
      return {
        ...unit,
        headline,
        prompt: graphicPrompt({
          brand: brief.brand,
          audience: brief.audience,
          goal: post.goal,
          format: post.format,
          source,
          facts: [source],
          look,
        }),
      };
    });
    if (post.id === 2 && post.slides) {
      post.slides = post.slides.map((slide, index) => ({
        ...slide,
        title: slides[index]?.headline ?? slide.title,
      }));
    } else {
      post.lines = [slides[0]?.headline ?? brief.brand, post.lines[1] ?? ""];
    }
    return { slides };
  });

  const generated = await generateAll(jobs);
  const frames = generated.frames;
  const missing = frames.flat().filter((frame) => frame === "").length;
  const reason = generated.failures[0] ? ` ${generated.failures[0]}` : "";
  return {
    analysis,
    frames,
    prompts: separatePrompts({
      brand: brief.brand,
      audience: brief.audience,
      look,
      outputs,
    }).map((text, index) => ({
      label: `${index + 1}. ${outputs[index]?.format ?? ""}. ${outputs[index]?.source ?? ""}`,
      text,
    })),
    imageNote: missing > 0 ? `Model nije vratio ${missing} fotografija.${reason}` : "",
  };
}
