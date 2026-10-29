import { readBrand, readInstagram, readSite } from "./read.mjs";

function claim(kind, text, href) {
  return { kind, text, href };
}

function pieces(value) {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function isUrl(value) {
  return /^https?:\/\//i.test(value.trim());
}

function productEntries(products, references) {
  const chunks = `${products}\n${references ?? ""}`.split(/[\n;]+/);
  const found = [];
  for (const chunk of chunks) {
    const urls = chunk.match(/https?:\/\/[^\s,]+/g) ?? [];
    for (const url of urls) found.push(url.replace(/[),.]+$/, ""));
    if (urls.length > 0) continue;
    for (const name of chunk.split(",")) {
      const trimmed = name.trim();
      if (trimmed.length > 1) found.push(trimmed);
    }
  }
  return [...new Set(found)].slice(0, 4);
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function htmlMentions(html, name) {
  const haystack = html.toLowerCase();
  const needle = name.toLowerCase().trim();
  if (needle.length > 1 && haystack.includes(needle)) return true;
  const token = slug(name);
  return token.length > 4 && haystack.includes(token);
}

function cleanTitle(title) {
  const head = title.split("|")[0].trim();
  const parts = head.split(/\s+-\s+/);
  if (parts.length > 1 && parts[parts.length - 1].length < 32) {
    return parts.slice(0, -1).join(" - ").trim();
  }
  return head || title;
}

function linkFor(html, base, name) {
  const token = slug(name);
  if (token.length < 5) return "";
  const re = /href=["']([^"']+)["']/gi;
  let match = re.exec(html);
  while (match) {
    if (match[1].toLowerCase().includes(token)) {
      try {
        return new URL(match[1], base).href;
      } catch {
        match = re.exec(html);
        continue;
      }
    }
    match = re.exec(html);
  }
  return "";
}

async function resolveProducts(brief, site) {
  const entries = productEntries(brief.products, "");
  const resolved = await Promise.all(
    entries.map(async (entry) => {
      if (isUrl(entry)) {
        try {
          const page = await readSite(entry, { design: false });
          return { entry, label: cleanTitle(page.title), href: page.url, found: true, sentences: page.sentences };
        } catch (error) {
          return {
            entry,
            label: entry,
            href: entry,
            found: false,
            error: error instanceof Error ? error.message : "Stranica se nije otvorila.",
          };
        }
      }
      if (htmlMentions(site.html, entry)) {
        return { entry, label: entry, href: site.url, found: true };
      }
      const href = linkFor(site.html, site.url, entry);
      if (!href) return { entry, label: entry, href: site.url, found: false };
      try {
        const page = await readSite(href, { design: false });
        return { entry, label: cleanTitle(page.title) || entry, href: page.url, found: true, sentences: page.sentences };
      } catch (error) {
        return {
          entry,
          label: entry,
          href,
          found: false,
          error: error instanceof Error ? error.message : "Stranica se nije otvorila.",
        };
      }
    }),
  );
  const seen = new Set();
  return resolved.filter((item) => {
    const key = slug(item.found ? item.label : item.entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleFrom(text, products, brand) {
  const lower = text.toLowerCase();
  const named = pieces(products).find((part) => lower.includes(part.toLowerCase()));
  return named || brand;
}

function sourceLine(item) {
  return item.caption || item.alt || item.detail || "";
}

function plan(brief, site, instagram, products = []) {
  const opened = instagram.opened.filter((post) => post.caption || post.alt);
  const productList = pieces(brief.products);
  const siteLines = site.sentences.map((sentence) => ({
    caption: sentence,
    alt: "",
    href: site.url,
    kind: "site",
  }));
  const productSources = products
    .filter((item) => item.found)
    .slice(0, 3)
    .map((item) => ({
      caption: item.label,
      alt: "",
      href: item.href,
      kind: "product",
      product: item.label,
    }));
  const pool = productSources.length > 0 ? productSources : opened.length > 0 ? opened : siteLines;
  const first = pool[0];
  const carouselSources = productSources.length > 0
    ? productSources
    : (opened.length > 0 ? opened : productList.map((product) => ({
      caption: site.sentences.find((sentence) => sentence.toLowerCase().includes(product.toLowerCase())) ?? "",
      alt: "",
      href: site.url,
      kind: "brief",
      product,
    }))).slice(0, 3);

  if (productSources.length === 0) {
    while (carouselSources.length < 3 && siteLines[carouselSources.length]) {
      carouselSources.push(siteLines[carouselSources.length]);
    }
  }
  if (carouselSources.length === 0) {
    carouselSources.push({ caption: brief.products, alt: "", href: site.url, kind: "brief" });
  }

  const highlight = instagram.highlights[0] ?? "";
  const storySource = productSources.length > 1 ? productSources[productSources.length - 1] : productSources[0];
  const posts = [
    {
      id: 1,
      format: "Slika, 1:1",
      goal: "Spremanja",
      concept: first ? titleFrom(sourceLine(first), brief.products, brief.brand) : brief.brand,
      why: productSources[0]
        ? "Prva slika je proizvod iz brifa koji je otvorena stranica potvrdila. Ne dodaje drugi proizvod."
        : opened[0]
          ? "Prva slika uzima natpis koji je pročitan na profilu i ne dodaje svojstvo koje tamo ne piše."
          : "Profil nije dao natpis, pa slika koristi rečenicu sa stranice koju je korisnik naveo.",
      lines: [
        titleFrom(sourceLine(first ?? { caption: brief.brand }), brief.products, brief.brand),
        sourceLine(first ?? { caption: brief.products }).slice(0, 110),
      ],
      caption: first
        ? `${sourceLine(first)}\n\nIzvor, ne nova tvrdnja.\n${first.href}`
        : `${brief.products}\n\n${site.url}`,
    },
    {
      id: 2,
      format: "Karusel",
      goal: "Komentari",
      concept: "Do tri izvora, redom",
      why: productSources.length > 0
        ? "Karusel slaže proizvode iz brifa koje je stranica potvrdila, bez tuđih natpisa."
        : opened.length > 1
          ? `Profil pokazuje ${opened.length} otvorena primjera. Karusel ih slaže bez novih cijena i izjava.`
          : "Nedostaju natpisi objava, pa slajdovi stoje na proizvodima iz brifa i rečenicama sa stranice.",
      lines: carouselSources.map((item) => titleFrom(item.product || sourceLine(item), brief.products, brief.brand)),
      caption: carouselSources
        .map((item, index) => {
          const body = item.product && !item.caption
            ? `${item.product} je u brifu. Stranica i objave to ime nisu potvrdile.`
            : sourceLine(item);
          return `${index + 1}. ${body}\n${item.href || site.url}`;
        })
        .join("\n\n"),
      slides: carouselSources.map((item) => ({
        title: titleFrom(item.product || sourceLine(item), brief.products, brief.brand),
        detail: (item.product && !item.caption
          ? `${item.product} je upisano u brif.`
          : sourceLine(item)
        ).slice(0, 120),
      })),
    },
    {
      id: 3,
      format: "Story, 9:16",
      goal: brief.goals.split(/[,.\n]/)[0]?.trim() || "Doseg",
      concept: highlight ? highlight : brief.brand,
      why: storySource
        ? "Story prikazuje zadnji proizvod iz brifa, u uspravnom formatu. Istaknute priče, ako postoje, nisu otvorene."
        : highlight
          ? `Priča nosi ime istaknute grupe ${highlight}. Sadržaj te grupe nije otvoren, pa story ne opisuje što je unutra.`
          : "Nema otvorene istaknute priče, pa story vodi na profil koji je korisnik upisao.",
      lines: storySource
        ? [storySource.product, ""]
        : [highlight || brief.brand, brief.instagram.replace(/^https?:\/\//, "")],
      caption: storySource
        ? `${storySource.product}\n\nPredmet storyja je proizvod iz brifa.\n${storySource.href}`
        : highlight
        ? `Na profilu je istaknuto: ${instagram.highlights.join(", ")}.\nSadržaj tih priča nije otvoren.\n${instagram.url}`
        : `${brief.brand}\n${brief.instagram}`,
    },
  ];

  return { posts };
}

export async function analyze(brief) {
  const website = normalizeWeb(brief.website);
  const instagramUrl = normalizeInstagram(brief.instagram);
  const site = await readBrand(website);
  const products = await resolveProducts(brief, site);
  const seenSentences = new Set(site.sentences);
  for (const product of products) {
    for (const sentence of product.sentences ?? []) {
      if (seenSentences.has(sentence)) continue;
      seenSentences.add(sentence);
      site.sentences.push(sentence);
    }
  }
  delete site.html;
  let instagram = {
    url: instagramUrl,
    heading: "",
    highlights: [],
    grid: [],
    opened: [],
    status: "failed",
    error: "",
  };
  try {
    instagram = { ...(await readInstagram(instagramUrl)), error: "" };
  } catch (error) {
    instagram.error = error instanceof Error ? error.message : "Instagram se nije otvorio.";
  }

  const openedHrefs = new Set(instagram.opened.map((post) => post.href));
  const claims = [
    claim(
      "checked",
      `Pročitano je ${site.sentences.length} rečenica s ${site.pagesRead ?? 1} stranica.`,
      site.url,
    ),
    claim(
      "checked",
      `Profil: ${instagram.grid.length} objava u mreži, otvoreno ${instagram.opened.length}.`,
      instagram.url,
    ),
    ...(instagram.bio ?? []).map((line) => claim("checked", line, instagram.url)),
    ...site.sentences.map((sentence) => claim("checked", sentence, site.url)),
    ...instagram.opened.filter((post) => post.caption).map((post) => claim("checked", post.caption, post.href)),
    ...instagram.opened.filter((post) => post.alt).map((post) => claim("checked", post.alt, post.href)),
    ...instagram.grid
      .filter((item) => item.alt.length > 40 && !openedHrefs.has(item.href))
      .map((item) => claim("checked", item.alt, item.href)),
  ];
  if (instagram.highlights.length > 0) {
    claims.push(claim("checked", `Istaknute priče: ${instagram.highlights.join(", ")}.`, instagram.url));
  }
  if (instagram.status !== "opened") {
    claims.push(claim("missing", instagram.error || "Profil se otvorio, ali natpisi objava nisu pročitani.", instagramUrl));
  }
  for (const product of products) {
    if (product.found) {
      claims.push(claim("checked", product.label, product.href));
    } else if (isUrl(product.entry)) {
      claims.push(claim("missing", product.error || `${product.entry} se nije otvorio.`, product.entry));
    } else {
      claims.push(
        claim(
          "missing",
          `${product.entry} nije pronađen na otvorenoj stranici ni na poveznici s tim imenom.`,
          website,
        ),
      );
    }
  }
  if (brief.audience.trim()) {
    claims.push(claim("inference", `Publika iz brifa: ${brief.audience.trim()}`, instagramUrl));
  }
  if (brief.references?.trim()) {
    claims.push(
      claim(
        "inference",
        `Referenca iz brifa nije otvarana kao izvor: ${brief.references.trim()}`,
        website,
      ),
    );
  }
  if (site.design?.fromSite) {
    claims.push(
      claim(
        "checked",
        `Okvir u predlošku: font ${site.design.font || "nije naveden"}, tekst ${site.design.ink || "nije naveden"}, pozadina ${site.design.paper || "nije navedena"}, akcent ${site.design.accent || "nije naveden"}.`,
        site.url,
      ),
    );
  } else {
    claims.push(claim("inference", "Stranica nije objavila font ni boju, pa model nema paletu sa stranice.", site.url));
  }

  const planned = plan({ ...brief, website, instagram: instagramUrl }, site, instagram, products);
  return { brief: { ...brief, website, instagram: instagramUrl }, site, instagram, claims, posts: planned.posts };
}

function normalizeWeb(value) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function normalizeInstagram(value) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "").replace(/\/$/, "");
  return `https://www.instagram.com/${handle}/`;
}
