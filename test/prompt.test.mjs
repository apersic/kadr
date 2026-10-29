import { graphicPrompt, headlineFrom, oneShotPrompt } from "../server/prompt.mjs";

const outputs = [
  { format: "Slika, 1:1", goal: "Spremanja", source: "MoiMuv Protein Milkshake" },
  { format: "Carousel slide 1 of 3, square 1:1", goal: "Komentari", source: "MoiMuv Protein Milkshake" },
  { format: "Carousel slide 2 of 3, square 1:1", goal: "Komentari", source: "Proteinski chips" },
  { format: "Carousel slide 3 of 3, square 1:1", goal: "Komentari", source: "Vitamin C 1000 mg" },
  { format: "Story, 9:16", goal: "Spremanja", source: "Vitamin C 1000 mg" },
];

describe("oneShotPrompt", () => {
  const prompt = oneShotPrompt({
    brand: "GymBeam",
    audience: "Sportaši",
    look: "Frame, taken from the brand website.\n- Typeface: Inter",
    outputs,
  });

  test("states the shared direction once and asks for every image", () => {
    expect(prompt.split("Photoreal editorial").length - 1).toBe(1);
    expect(prompt).toContain("Generate all 5 images");
    expect(prompt).toContain("Do not stop after the first image.");
    expect(prompt).not.toContain("{{brand}}");
    expect(prompt).not.toContain("{{count}}");
  });

  test("lists each output subject", () => {
    expect(prompt).toContain("1. Format: Slika, 1:1. Goal: Spremanja. Subject, taken only from this line: MoiMuv Protein Milkshake.");
    expect(prompt).toContain("3. Format: Carousel slide 2 of 3, square 1:1. Goal: Komentari. Subject, taken only from this line: Proteinski chips.");
    expect(prompt).toContain("5. Format: Story, 9:16. Goal: Spremanja. Subject, taken only from this line: Vitamin C 1000 mg.");
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
    expect(prompt).toContain("Subject, taken only from this source line, nothing else: MoiMuv Protein Milkshake");
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
