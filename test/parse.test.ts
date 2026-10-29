import { parseStudio } from "../src/lib/helpers/parse";

const studio = {
  analysis: {
    brief: {
      brand: "GymBeam",
      website: "https://gymbeam.hr/",
      instagram: "https://www.instagram.com/gymbeamhr/",
      products: "MoiMuv Protein Milkshake",
      audience: "",
      goals: "",
      references: "",
    },
    site: { url: "https://gymbeam.hr/", title: "GymBeam", sentences: [] },
    instagram: {
      url: "https://www.instagram.com/gymbeamhr/",
      heading: "",
      highlights: [],
      grid: [],
      opened: [],
      status: "opened",
      error: "",
    },
    claims: [{ kind: "checked", text: "MoiMuv Protein Milkshake", href: "https://gymbeam.hr/" }],
    posts: [
      {
        id: 1,
        format: "Slika, 1:1",
        goal: "Spremanja",
        concept: "MoiMuv",
        why: "Proizvod je na stranici.",
        lines: ["MoiMuv Protein Milkshake"],
        caption: "MoiMuv Protein Milkshake",
      },
    ],
  },
  frames: [["data:image/png;base64,aa"]],
  prompt: "Generate all 1 images",
  imageNote: "",
};

describe("parseStudio", () => {
  test("reads a studio response", () => {
    const result = parseStudio(studio);
    expect(result.prompt).toBe("Generate all 1 images");
    expect(result.analysis.brief.brand).toBe("GymBeam");
    expect(result.analysis.posts[0]?.id).toBe(1);
    expect(result.frames).toEqual([["data:image/png;base64,aa"]]);
  });

  test("rejects a response without analysis", () => {
    expect(() => parseStudio({ frames: [], prompt: "" })).toThrow("Odgovor analize nema očekivani oblik.");
  });
});
