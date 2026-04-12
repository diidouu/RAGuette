import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { mkdir, writeFile } from "fs/promises";

// --- 5 verified working URLs (as of 2026-04-12) ---
const urls = [
  "https://entreprendre.service-public.gouv.fr/vosdroits/F23267",  // Régime fiscal micro-entreprise
  "https://entreprendre.service-public.gouv.fr/vosdroits/F36232",  // Cotisations sociales micro-entrepreneur
  "https://entreprendre.service-public.gouv.fr/vosdroits/F21746",  // Franchise en base de TVA
  "https://entreprendre.service-public.gouv.fr/vosdroits/F32353",  // Dépassement seuils CA
  "https://entreprendre.service-public.gouv.fr/vosdroits/F31228",  // Mentions obligatoires site internet
];

const OUTPUT_DIR = "data/sources";

// Turn a title like "Régime fiscal de la micro-entreprise" into "regime-fiscal-de-la-micro-entreprise"
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")                   // "é" becomes "e" + a combining accent mark
    .replace(/[\u0300-\u036f]/g, "")    // strip the combining accent marks
    .replace(/[^a-z0-9]+/g, "-")        // anything that's not a letter or number → dash
    .replace(/^-+|-+$/g, "");           // trim leading/trailing dashes
}

// Fetch one URL, extract the main article content
async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: {
      // Honest bot identifier — not hiding what we are
      "User-Agent": "RAGuette-bot/0.1 (student project, github.com/diidouu/RAGuette)",
    },
  });

  // If the server returns an error (404, 500, etc.), skip this URL
  if (!res.ok) {
    console.error(`SKIP ${url} — HTTP ${res.status}`);
    return null;
  }

  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  if (!article) {
    console.error(`SKIP ${url} — Readability could not extract article`);
    return null;
  }

  return {
    title: article.title,
    content: article.textContent,   // plain text, no HTML tags
    url,
  };
}

// Simple sleep helper for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const results = [];

    for (const url of urls) {
    console.log(`Fetching: ${url}`);
    const result = await fetchPage(url);

    if (result) {
      results.push(result);
    }

    // Wait 1 second between requests — be polite to the server
    await sleep(1000);
  }

  // Write each result as a Markdown file with YAML frontmatter.
  for (const result of results) {
    const slug = slugify(result.title);
    const filename = `${OUTPUT_DIR}/${slug}.md`;

    const fileContent = `---
title: "${result.title}"
source_url: "${result.url}"
fetched_at: "${new Date().toISOString()}"
---

# ${result.title}

${result.content}
`;

    // writeFile(WHERE, WHAT, ENCODING)
    //   WHERE:    file path as a string
    //   WHAT:     content to write as a string
    //   ENCODING: "utf-8" (how characters are encoded — handles é, ç, etc.)
    await writeFile(filename, fileContent, "utf-8");
    console.log(`Saved: ${filename}`);
  }

  console.log(`\nDone. ${results.length}/${urls.length} pages saved.`);
}

// Call the function. Without this line, nothing happens —
// you defined the function but never told Node to execute it.
run();
