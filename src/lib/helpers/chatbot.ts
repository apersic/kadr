import { Ask, BriefFields, Claim } from "../types";

export function question(ask: Ask): string {
    switch (ask) {
        case "brand":
            return "Koji brend radimo? Ako želiš probu na stvarnom profilu, napiši GymBeam.";
        case "website":
            return "Gdje je stranica ili trgovina? Odavde čitam što se smije tvrditi.";
        case "instagram":
            return "Koji je Instagram? Poveznica ili @profil.";
        case "products":
            return "Koje proizvode smijem spomenuti? Odvoji ih zarezom.";
        case "audience":
            return "Kome je objava namijenjena? Ako ne znaš, napiši preskoči.";
        case "goals":
            return "Što objava treba napraviti? Spremanja, komentari, doseg, ili nešto svoje.";
        case "references":
            return "Imaš li poveznicu ili bilješku što mora ostati točno? Inače preskoči.";
        case "photos":
            return "Ako imaš fotografiju proizvoda ili ambalaže, priloži je. Inače napiši preskoči.";
        default: {
            const exhaustive: never = ask;
            return exhaustive;
        }
    }
}

export function isOptional(ask: Ask): boolean {
    switch (ask) {
        case "audience":
        case "goals":
        case "references":
        case "photos":
            return true;
        case "brand":
        case "website":
        case "instagram":
        case "products":
            return false;
        default: {
            const exhaustive: never = ask;
            return exhaustive;
        }
    }
}

export function nextAsk(ask: Ask): Ask | "run" {
    switch (ask) {
        case "brand":
            return "website";
        case "website":
            return "instagram";
        case "instagram":
            return "products";
        case "products":
            return "audience";
        case "audience":
            return "goals";
        case "goals":
            return "references";
        case "references":
            return "photos";
        case "photos":
            return "run";
        default: {
            const exhaustive: never = ask;
            return exhaustive;
        }
    }
}

export function fieldKey(ask: Ask): keyof BriefFields | null {
    switch (ask) {
        case "photos":
            return null;
        case "brand":
            return "brand";
        case "website":
            return "website";
        case "instagram":
            return "instagram";
        case "products":
            return "products";
        case "audience":
            return "audience";
        case "goals":
            return "goals";
        case "references":
            return "references";
        default: {
            const exhaustive: never = ask;
            return exhaustive;
        }
    }
}

export function claimLabel(kind: Claim["kind"]): string {
    switch (kind) {
        case "checked":
            return "Provjereno";
        case "inference":
            return "Zaključak";
        case "missing":
            return "Nije dostupno";
        default: {
            const exhaustive: never = kind;
            return exhaustive;
        }
    }
}