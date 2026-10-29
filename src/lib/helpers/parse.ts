import type { Analysis, BriefFields, Claim, InstagramPost, PlannedPost, Slide } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function readStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function isClaimKind(value: unknown): value is Claim["kind"] {
    return value === "checked" || value === "inference" || value === "missing";
}

function isPostId(value: unknown): value is PlannedPost["id"] {
    return value === 1 || value === 2 || value === 3;
}

function readBrief(value: unknown): BriefFields {
    if (!isRecord(value)) {
        throw new Error("Odgovor nema brief.");
    }
    return {
        brand: readString(value.brand),
        website: readString(value.website),
        instagram: readString(value.instagram),
        products: readString(value.products),
        audience: readString(value.audience),
        goals: readString(value.goals),
        references: readString(value.references),
    };
}

function readClaim(value: unknown): Claim {
    if (!isRecord(value) || !isClaimKind(value.kind) || typeof value.text !== "string") {
        throw new Error("Odgovor ima nečitljivu tvrdnju.");
    }
    return { kind: value.kind, text: value.text, href: readString(value.href) };
}

function readSlide(value: unknown): Slide {
    if (!isRecord(value)) {
        throw new Error("Slajd nije čitljiv.");
    }
    return { title: readString(value.title), detail: readString(value.detail) };
}

function readPost(value: unknown): PlannedPost {
    if (!isRecord(value) || !isPostId(value.id)) {
        throw new Error("Objava u planu nije čitljiva.");
    }
    const slides = Array.isArray(value.slides) ? value.slides.map(readSlide) : undefined;
    return {
        id: value.id,
        format: readString(value.format),
        goal: readString(value.goal),
        concept: readString(value.concept),
        why: readString(value.why),
        lines: readStrings(value.lines),
        caption: readString(value.caption),
        slides,
    };
}

function readOpened(value: unknown): InstagramPost {
    if (!isRecord(value)) {
        throw new Error("Otvorena objava nije čitljiva.");
    }
    return {
        href: readString(value.href),
        alt: readString(value.alt),
        caption: readString(value.caption),
        likes: readString(value.likes),
        kind: readString(value.kind),
    };
}

export type StudioResult = {
    analysis: Analysis;
    frames: string[][];
    prompt: string;
    imageNote: string;
};

function readFrameRows(value: unknown): string[][] {
    if (!Array.isArray(value)) return [];
    return value.map((row) => (Array.isArray(row) ? row.filter((item): item is string => typeof item === "string") : []));
}

export function parseStudio(value: unknown): StudioResult {
    if (!isRecord(value)) {
        throw new Error("Odgovor nema slike.");
    }
    return {
        analysis: parseAnalysis(value.analysis),
        frames: readFrameRows(value.frames),
        prompt: readString(value.prompt),
        imageNote: readString(value.imageNote),
    };
}

function parseAnalysis(value: unknown): Analysis {
    if (!isRecord(value) || !isRecord(value.site) || !isRecord(value.instagram)) {
        throw new Error("Odgovor analize nema očekivani oblik.");
    }
    if (!Array.isArray(value.claims) || !Array.isArray(value.posts)) {
        throw new Error("Odgovor analize nema tvrdnje i plan.");
    }
    const grid = Array.isArray(value.instagram.grid) ? value.instagram.grid : [];
    return {
        brief: readBrief(value.brief),
        site: {
            url: readString(value.site.url),
            title: readString(value.site.title),
            sentences: readStrings(value.site.sentences),
        },
        instagram: {
            url: readString(value.instagram.url),
            heading: readString(value.instagram.heading),
            highlights: readStrings(value.instagram.highlights),
            grid: grid.map((item) => {
                if (!isRecord(item)) return { href: "", alt: "", kind: "" };
                return { href: readString(item.href), alt: readString(item.alt), kind: readString(item.kind) };
            }),
            opened: Array.isArray(value.instagram.opened) ? value.instagram.opened.map(readOpened) : [],
            status: readString(value.instagram.status),
            error: readString(value.instagram.error),
        },
        claims: value.claims.map(readClaim),
        posts: value.posts.map(readPost),
    };
}
