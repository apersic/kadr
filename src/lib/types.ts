export type Claim = {
  kind: "checked" | "inference" | "missing";
  text: string;
  href: string;
};

export type Slide = {
  title: string;
  detail: string;
};

export type PlannedPost = {
  id: 1 | 2 | 3;
  format: string;
  goal: string;
  concept: string;
  why: string;
  lines: string[];
  caption: string;
  slides?: Slide[];
};

export type InstagramPost = {
  href: string;
  alt: string;
  caption: string;
  likes: string;
  kind: string;
};

export type Analysis = {
  brief: BriefFields;
  site: { url: string; title: string; sentences: string[] };
  instagram: {
    url: string;
    heading: string;
    highlights: string[];
    grid: { href: string; alt: string; kind: string }[];
    opened: InstagramPost[];
    status: string;
    error: string;
  };
  claims: Claim[];
  posts: PlannedPost[];
};

export type BriefFields = {
  brand: string;
  website: string;
  instagram: string;
  products: string;
  audience: string;
  goals: string;
  references: string;
};

export const emptyBrief: BriefFields = {
  brand: "",
  website: "",
  instagram: "",
  products: "",
  audience: "",
  goals: "",
  references: "",
};

export const gymbeamBrief: BriefFields = {
  brand: "GymBeam",
  website: "https://gymbeam.hr/",
  instagram: "https://www.instagram.com/gymbeamhr/",
  products: "MoiMuv Protein Milkshake, Proteinski chips, Vitamin C 1000 mg",
  audience: "Sportaši i ljudi koji kupuju dodatke prehrani.",
  goals: "Spremanja na proizvodima sa stranice.",
  references: "",
};

export type Ask = "brand" | "website" | "instagram" | "products" | "audience" | "goals" | "references" | "photos";
export type Phase = Ask | "done";

export type Bubble = {
  id: number;
  role: "agent" | "user";
  text: string;
  posts?: { id: number; format: string; goal: string; caption: string; why: string; images: string[] }[];
  notes?: string[];
  prompts?: { label: string; text: string }[];
};
