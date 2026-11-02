import { graphicPrompt, headlineFrom, separatePrompts, slideCaption } from "../server/prompt.mjs";

const outputs = [
  {
    format: "Slika, 1:1",
    goal: "Spremanja",
    caption: "MoiMuv Protein Milkshake\n\nIzvor, ne nova tvrdnja.",
    why: "Prva slika je proizvod iz brifa.",
    source: "MoiMuv Protein Milkshake",
  },
  {
    format: "Karusel",
    goal: "Komentari",
    caption: "Proteinski chips",
    why: "Karusel slaže potvrđene proizvode.",
    source: "Proteinski chips",
  },
  {
    format: "Story, 9:16",
    goal: "Spremanja",
    caption: "Vitamin C 1000 mg",
    why: "Story prikazuje zadnji proizvod.",
    source: "Vitamin C 1000 mg",
  },
];

describe("separatePrompts", () => {
  const prompts = separatePrompts({
    brand: "Northwind",
    audience: "Weekend hikers",
    look: "Frame, taken from the brand website.\n- Typeface: Inter\n- Logo file: https://cdn.example/logo.svg",
      outputs: [
      { format: "Slika, 1:1", goal: "Saves", caption: "Save the oat bar.", why: "The page confirmed the oat bar.", source: "Oat Bar" },
      { format: "Karusel", goal: "Comments", caption: "Comment on the berry soda.", why: "The page confirmed the soda.", source: "Berry Soda" },
      { format: "Story, 9:16", goal: "Reach", caption: "The trail mix story.", why: "The story uses the last product.", source: "Trail Mix" },
    ],
  });

  test("returns one prompt per image and names only that image's subject", () => {
    expect(prompts).toHaveLength(3);
    const picture = prompts[0].split("Natpis:")[0];
    expect(prompts[0].startsWith("Generate one image.")).toBe(true);
    expect(picture).toContain("Square, 1:1.");
    expect(picture).toContain('The only words on the package are "Oat Bar".');
    expect(picture).not.toMatch(/reference photo/i);
    expect(picture).not.toMatch(/closed retail pack/i);
    expect(picture).not.toMatch(/https?:\/\//);
    expect(picture).not.toMatch(/logo/i);
    expect(prompts[0]).toContain("Format: Slika, 1:1");
    expect(prompts[0]).not.toContain("Berry Soda");
    expect(prompts[0]).not.toContain("Trail Mix");
    expect(prompts[1].split("Natpis:")[0]).toContain('The only words on the package are "Berry Soda".');
    expect(prompts[1]).toContain("Format: Karusel, 1:1");
    expect(prompts[1]).not.toContain("Oat Bar");
    expect(prompts[1]).not.toContain("Trail Mix");
    expect(prompts[2].split("Natpis:")[0]).toContain('The only words on the package are "Trail Mix".');
    expect(prompts[2]).toContain("Format: Story, 9:16");
    expect(prompts[2]).toContain("Portrait, 9:16.");
    expect(prompts[2]).not.toContain("Oat Bar");
    expect(prompts[2]).not.toContain("Berry Soda");
    expect(prompts[0].indexOf("Generate one image.")).toBeLessThan(prompts[0].indexOf("Natpis:"));
    expect(prompts[0]).toContain("Natpis:\nSave the oat bar.");
    expect(prompts[0]).toContain("Cilj: Saves");
    expect(prompts[0]).toContain("Obrazloženje: The page confirmed the oat bar.");
    expect(prompts[0].split("Natpis:\nSave the oat bar.").length - 1).toBe(1);
    expect(prompts[1]).toContain("Natpis:\nComment on the berry soda.");
    expect(prompts[1]).toContain("Cilj: Comments");
    expect(prompts[2]).toContain("Natpis:\nThe trail mix story.");
    expect(prompts[2]).toContain("Cilj: Reach");
    expect(prompts[2]).toContain("Obrazloženje: The story uses the last product.");
    expect(prompts[2].split("Natpis:")[0]).not.toContain("https://cdn.example/logo.svg");
    expect(prompts[2]).toContain("- Typeface: Inter");
    expect(prompts.join("\n")).not.toContain("{{source}}");
  });
});

describe("separatePrompts gymbeam sample", () => {
  const prompts = separatePrompts({
    brand: "GymBeam",
    audience: "Sportaši i ljudi koji kupuju dodatke prehrani.",
    look: "Frame, taken from the brand website.\n- Logo file: https://gymbeam.hr/static/version170123/frontend/GymBeam/default/hr_HR/images/logo.svg",
    outputs,
  });

  test("keeps the chips prompt free of the milkshake and the vitamin", () => {
    const picture = prompts[1].split("Natpis:")[0];
    expect(picture.startsWith("Generate one image.")).toBe(true);
    expect(picture).toContain('The only words on the package are "Proteinski chips".');
    expect(picture).not.toMatch(/reference photo/i);
    expect(picture).not.toMatch(/closed retail pack/i);
    expect(picture).not.toContain("https://gymbeam.hr/");
    expect(prompts[1]).not.toContain("MoiMuv Protein Milkshake");
    expect(prompts[1]).not.toContain("Vitamin C 1000 mg");
    expect(prompts[2]).toContain("Portrait, 9:16.");
    expect(prompts[2]).not.toContain("MoiMuv Protein Milkshake");
  });

  test("splits the five-image run so later prompts do not repeat the first product", () => {
    const five = separatePrompts({
      brand: "GymBeam",
      audience: "Sportaši",
      look: "Frame, taken from the brand website.",
      outputs: [
        { format: "Slika, 1:1", goal: "Spremanja", caption: "MoiMuv Protein Milkshake", why: "Prva slika.", source: "MoiMuv Protein Milkshake" },
        { format: "Karusel", goal: "Komentari", caption: "MoiMuv Protein Milkshake", why: "Prvi kadar.", source: "MoiMuv Protein Milkshake" },
        { format: "Karusel", goal: "Komentari", caption: "Proteinski chips", why: "Drugi kadar.", source: "Proteinski chips" },
        { format: "Karusel", goal: "Komentari", caption: "Vitamin C 1000 mg", why: "Treći kadar.", source: "Vitamin C 1000 mg" },
        { format: "Story, 9:16", goal: "Spremanja", caption: "Vitamin C 1000 mg", why: "Story.", source: "Vitamin C 1000 mg" },
      ],
    });
    expect(five).toHaveLength(5);
    expect(five[2]).toContain("Proteinski chips");
    expect(five[2]).not.toContain("MoiMuv");
    expect(five[2]).not.toContain("Vitamin C");
    expect(five[2]).toContain("Natpis:\nProteinski chips");
    expect(five[2]).toContain("Format: Karusel");
    expect(five[2]).toContain("Cilj: Komentari");
    expect(five[2]).toContain("Obrazloženje: Drugi kadar.");
    expect(five[4]).toContain("Natpis:\nVitamin C 1000 mg");
    expect(five[4]).toContain("Format: Story, 9:16");
    expect(five[4]).toContain("Cilj: Spremanja");
    expect(five[4]).toContain("Obrazloženje: Story.");
    expect(five[4]).not.toContain("MoiMuv");
    expect(five[4]).not.toContain("Proteinski chips");
  });
});

describe("slideCaption", () => {
  test("keeps a carousel image prompt on one product", () => {
    const caption = slideCaption(
      "Karusel",
      "1. MoiMuv Protein Milkshake\n\n2. Proteinski chips\n\n3. Vitamin C 1000 mg",
      "Proteinski chips",
    );
    expect(caption).toBe("Proteinski chips\n\nIzvor, ne nova tvrdnja.");
    expect(caption).not.toContain("MoiMuv");
    expect(slideCaption("Slika, 1:1", "Save the oat bar.", "Oat Bar")).toBe("Save the oat bar.");
  });
});

describe("graphicPrompt", () => {
  test("fills the single-image placeholders", () => {
    const prompt = graphicPrompt({
      brand: "GymBeam",
      audience: "",
      goal: "Spremanja",
      format: "Slika, 1:1",
      source: "MoiMuv Protein Milkshake",
      facts: ["MoiMuv Protein Milkshake"],
      look: "Frame, taken from the brand website.",
    });

    expect(prompt).toContain("Brand: GymBeam");
    expect(prompt).toContain("Audience: Not specified");
    expect(prompt).toContain("Goal of this post: Spremanja");
    expect(prompt).toContain("Format: Slika, 1:1");
    expect(prompt).toContain("Subject, the closed retail pack only: MoiMuv Protein Milkshake");
    expect(prompt).toContain("Do not ask for a reference photo");
    expect(prompt).not.toContain("{{source}}");
  });
});

describe("headlineFrom", () => {
  test("keeps a product name that appears in the source", () => {
    expect(headlineFrom("MoiMuv Protein Milkshake je na stranici.", "MoiMuv Protein Milkshake, Proteinski chips", "GymBeam")).toBe(
      "MoiMuv Protein Milkshake",
    );
  });
});
