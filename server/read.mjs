import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => existsSync(path));

const OPEN_CAP = 36;
const PAGE_CAP = 16;
const SKIP = /^(log in|sign up|follow|like|comment|share|save|posts|reels|tagged|meta|about|instagram|photo by|video by|carousel|clip)$/i;
const UI_LINE =
  /more posts from|profile picture|allow the use of cookies|optional cookies|log in to|sign up to see|see photos|from meta|may be an image|may be a photo|may be a video|view all \d+ comments|liked by|verifikacijski link|cookie/i;

function chromePath() {
  if (!CHROME) {
    throw new Error("Google Chrome nije pronađen.");
  }
  return CHROME;
}

function usableLine(line) {
  const text = line.trim();
  if (text.length < 24 || text.length > 400) return false;
  if (SKIP.test(text) || UI_LINE.test(text)) return false;
  if (/^https?:/i.test(text)) return false;
  if (/^[\d\s.,]+$/.test(text)) return false;
  return true;
}

async function dismiss(page) {
  const names = [/decline optional cookies/i, /only allow essential/i, /^close$/i, /^not now$/i];
  for (const name of names) {
    const button = page.getByRole("button", { name });
    if ((await button.count()) > 0) {
      await button.first().click({ timeout: 2500 }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }
}

function captionFrom(blob) {
  const head = blob.split(/Load more comments|No comments yet|View all \d+ comments/i)[0] ?? blob;
  const lines = head.split("\n").map((line) => line.trim()).filter(usableLine);
  return lines.sort((a, b) => b.length - a.length)[0] ?? "";
}

async function readPost(page, href) {
  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismiss(page);
  await page.waitForTimeout(1200);
  const rawAlt = (await page.locator("article img, main img").first().getAttribute("alt").catch(() => "")) ?? "";
  const alt = usableLine(rawAlt) ? rawAlt : "";
  const blob = await page.locator("main").innerText().catch(() => "");
  const likes = blob.match(/\n(\d[\d,]*)\n/)?.[1] ?? "";
  return {
    href,
    alt,
    caption: captionFrom(blob),
    likes,
    kind: href.includes("/reel/") ? "reel" : "photo",
  };
}

export async function readInstagram(profileUrl) {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismiss(page);
    await page.waitForTimeout(1500);
    let heading = (await page.getByRole("heading", { level: 2 }).first().innerText().catch(() => "")).trim();
    if (UI_LINE.test(heading) || heading.length > 80) {
      await dismiss(page);
      heading = (await page.getByRole("heading", { level: 1 }).first().innerText().catch(() => "")).trim();
    }
    if (UI_LINE.test(heading)) heading = "";
    const highlights = await page.locator('a[href*="/stories/highlights/"]').evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => (node.textContent ?? "").trim()).filter(Boolean))],
    );
    const headerText = await page.locator("header").innerText().catch(() => "");
    const bio = headerText.split("\n").map((line) => line.trim()).filter(usableLine);
    let previous = 0;
    let stable = 0;
    for (let round = 0; round < 30 && stable < 2; round += 1) {
      const count = await page.locator('a[href*="/p/"], a[href*="/reel/"]').count();
      stable = count > 0 && count === previous ? stable + 1 : 0;
      previous = count;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(700);
    }
    const grid = await page.locator('a[href*="/p/"], a[href*="/reel/"]').evaluateAll((nodes) => {
      const seen = new Set();
      const items = [];
      for (const node of nodes) {
        const href = node.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);
        const image = node.querySelector("img");
        items.push({
          href,
          alt: image?.getAttribute("alt") ?? "",
          kind: href.includes("/reel/") ? "reel" : node.textContent?.includes("Carousel") ? "carousel" : "photo",
        });
      }
      return items;
    });
    const opened = [];
    for (const item of grid.slice(0, OPEN_CAP)) {
      opened.push({ ...item, ...(await readPost(page, item.href)) });
    }
    return {
      url: profileUrl,
      heading,
      highlights,
      bio,
      grid,
      opened,
      status: opened.some((post) => post.caption || post.alt) ? "opened" : "empty",
    };
  } finally {
    await browser.close();
  }
}

function expandHex(value) {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const [red, green, blue] = hex.slice(1).split("");
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  return "";
}

function namedFont(value) {
  const family = value.split(",")[0].replace(/['"]/g, "").trim();
  if (!family) return "";
  if (/^(inherit|initial|unset|revert|var\(|ui-|system-ui|sans-serif|serif|monospace|emoji)/i.test(family)) return "";
  if (/awesome|icon|glyph|emoji|symbol/i.test(family)) return "";
  return family;
}

function collectFonts(css, families) {
  for (const match of css.matchAll(/font-family:\s*([^;}{]+)/gi)) {
    const name = namedFont(match[1]);
    if (name && !families.includes(name)) families.push(name);
  }
}

async function designFrom(html, pageUrl) {
  const families = [];
  collectFonts(html, families);
  const sheets = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)].map((match) => match[1]).slice(0, 3);
  let css = "";
  for (const href of sheets) {
    try {
      const sheet = await fetch(new URL(href, pageUrl).href, { headers: { "user-agent": "kadr/1.0" } });
      if (sheet.ok) css += await sheet.text();
    } catch {
      css += "";
    }
  }
  collectFonts(css, families);
  const ink = expandHex(css.match(/--color-primary:\s*(#[0-9a-fA-F]{3,8})/i)?.[1] ?? "");
  const accent = expandHex(css.match(/--color-secondary:\s*(#[0-9a-fA-F]{3,8})/i)?.[1] ?? "") || ink;
  const paper = expandHex(css.match(/--(?:color-background|background):\s*(#[0-9a-fA-F]{3,8})/i)?.[1] ?? "") || "#ffffff";
  const logoRaw = html.match(/"logo"\s*:\s*"(https?:[^"]+)"/i)?.[1] ?? "";
  const logoUrl = logoRaw.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  return {
    font: families[0] ?? "",
    ink,
    paper: ink || families[0] || logoUrl ? paper : "",
    accent,
    logoUrl,
    fromSite: Boolean(families[0] || ink || logoUrl),
  };
}

function contentLinks(html, pageUrl) {
  const host = new URL(pageUrl).host;
  const seen = new Set([pageUrl]);
  const links = [];
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let url;
    try {
      url = new URL(match[1], pageUrl);
    } catch {
      continue;
    }
    if (url.host !== host) continue;
    if (/\.(css|js|png|jpe?g|svg|webp|gif|woff2?|pdf|ico)(\?|$)/i.test(url.pathname)) continue;
    if (/\/(customer|checkout|cart|search|account|wishlist|api|static|media)\b/i.test(url.pathname)) continue;
    url.hash = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    links.push(url.href);
    if (links.length >= PAGE_CAP) break;
  }
  return links;
}

function sentencesFrom(html) {
  return visibleText(html)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40 && sentence.length < 280 && !UI_LINE.test(sentence))
    .filter((sentence) => !/odjaviti|newsletter|cookie|privatnost|privacy/i.test(sentence))
    .filter((sentence) => !/[{}<>]/.test(sentence) && !/"\s*:/.test(sentence));
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function readSite(website, options = {}) {
  const response = await fetch(website, {
    headers: { "user-agent": "kadr/1.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Stranica je vratila ${response.status}.`);
  }
  const html = await response.text();
  const pageUrl = response.url || website;
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? website;
  const design = options.design === false ? null : await designFrom(html, pageUrl);
  return { url: pageUrl, title, sentences: sentencesFrom(html), html, design, pagesRead: 1 };
}

export async function readBrand(website) {
  const home = await readSite(website);
  const extras = [];
  const links = contentLinks(home.html, home.url);
  for (let index = 0; index < links.length; index += 4) {
    const batch = await Promise.all(
      links.slice(index, index + 4).map((href) => readSite(href, { design: false }).catch(() => null)),
    );
    extras.push(...batch.filter(Boolean));
  }
  const sentences = [];
  const seen = new Set();
  for (const page of [home, ...extras]) {
    for (const sentence of page.sentences) {
      if (seen.has(sentence)) continue;
      seen.add(sentence);
      sentences.push(sentence);
    }
  }
  return { ...home, sentences, pagesRead: 1 + extras.length };
}
