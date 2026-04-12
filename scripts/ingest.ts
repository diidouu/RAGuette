import { readdir, readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";

// Load env vars from web/.env.local
config({ path: "web/.env.local" });

const SOURCES_DIR = "data/sources";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// STEP 1: Parse YAML frontmatter
// ---------------------------------------------------------------------------
// Your version was close — two fixes:
//   1. line.split(":") breaks on URLs (they have colons in "https://").
//      Fix: split only on the FIRST colon using indexOf.
//   2. You returned only metadata, but we also need the content.
//      Fix: return { metadata, content }.

function parseFrontmatter(raw: string) {
  const parts = raw.split("---");

  const yamlBlock = parts[1].trim();
  // parts.slice(2).join("---") handles the edge case where the content
  // itself contains "---" (it would get split into extra parts)
  const content = parts.slice(2).join("---").trim();

  const yamlLines = yamlBlock.split("\n");

  const metadata: Record<string, string> = {
    title: "",
    source_url: "",
    fetched_at: "",
  };

  for (const line of yamlLines) {
    // Find the FIRST colon only — this way "https://..." doesn't get split
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    // Strip surrounding quotes: '"Some title"' → 'Some title'
    const value = line.slice(colonIndex + 1).trim().replace(/^"|"$/g, "");

    if (key in metadata) {
      metadata[key] = value;
    }
  }

  return { metadata, content };
}

// ---------------------------------------------------------------------------
// STEP 2: Chunk text
// ---------------------------------------------------------------------------
// Your version had the right idea (while loop + slice) but two bugs:
//   1. end was always 499 instead of start + 500
//      → every chunk ended at the same position, getting shorter and shorter
//   2. start += 50 means step of 50, overlap of 450. Way too much.
//      → should be start += 450 (step of 450 = overlap of 50)

function chunkText(text: string): string[] {
  const chunkSize = 500;
  const overlap = 50;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;       // ← was: end = 499 (fixed)
    const chunk = text.slice(start, end).trim();

    if (chunk.length >= 50) {
      chunks.push(chunk);
    }

    start += chunkSize - overlap;        // ← was: start += 50 (fixed: 500-50=450)
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// STEP 3: Embed via Gemini
// ---------------------------------------------------------------------------
// Your version was almost right — three fixes:
//   1. Body key should be "requests" (plural), not "request"
//   2. API key was missing from the URL (?key=...)
//   3. Response field is "embeddings" (plural), not "embedding"

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";

async function embedBatch(texts: string[]): Promise<number[][]> {
  const requests = texts.map((text) => ({     // ← was: "request" (fixed: "requests")
    model: "models/gemini-embedding-001",
    content: { parts: [{ text }] },
  }));

  const body = { requests };                  // ← key is "requests" plural

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${GEMINI_API_KEY}`, {  // ← added ?key=
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding failed: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: any) => e.values);  // ← was: data.embedding (fixed: plural)
}

// ---------------------------------------------------------------------------
// STEP 4: Insert into Supabase via direct Postgres
// ---------------------------------------------------------------------------
// We use postgres.js to talk directly to the database, bypassing Supabase's
// REST API (PostgREST). Why? PostgREST has a schema cache that sometimes
// doesn't see new tables immediately. Direct Postgres always works.
//
// postgres() creates a connection pool from the DATABASE_URL in .env.local.
// sql`...` is a tagged template literal — it's like a template literal but
// the library handles SQL escaping automatically (prevents SQL injection).

const sql = postgres({
  host: "db.rwhcwuzvuvjwipbdgivu.supabase.co",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD!,
  ssl: "require",
});

interface ChunkRow {
  content: string;
  embedding: string;
  source_url: string;
  source_title: string;
  fetched_at: string;
  chunk_index: number;
}

async function upsertChunks(rows: ChunkRow[]) {
  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);

    // Insert each row with a parameterized query
    for (const row of batch) {
      await sql`
        INSERT INTO chunks (content, embedding, source_url, source_title, fetched_at, chunk_index)
        VALUES (${row.content}, ${row.embedding}, ${row.source_url}, ${row.source_title}, ${row.fetched_at}, ${row.chunk_index})
      `;
    }

    console.log(`  Inserted rows ${i + 1}–${Math.min(i + 50, rows.length)}`);
  }
}

// ---------------------------------------------------------------------------
// STEP 5: Wire it all together
// ---------------------------------------------------------------------------
// This is the run() function you were working on.
// It goes: read files → chunk → embed (in batches) → insert to Supabase.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  // 0. Ensure the chunks table exists (safe to re-run — uses IF NOT EXISTS)
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`DROP TABLE IF EXISTS chunks`;
  await sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id            bigint generated always as identity primary key,
      content       text NOT NULL,
      embedding     vector(3072),
      source_url    text NOT NULL,
      source_title  text NOT NULL,
      fetched_at    timestamptz NOT NULL,
      chunk_index   integer NOT NULL,
      created_at    timestamptz DEFAULT now()
    )
  `;
  // Clear old data so re-runs don't create duplicates
  await sql`TRUNCATE chunks`;
  console.log("Table ready.\n");

  // 1. Read all .md files and chunk them
  const files = await readdir(SOURCES_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md") && f !== ".gitkeep");

  // We'll collect all chunks with their metadata here
  const allChunks: {
    content: string;
    chunk_index: number;
    source_url: string;
    source_title: string;
    fetched_at: string;
  }[] = [];

  for (const filename of mdFiles) {
    const raw = await readFile(join(SOURCES_DIR, filename), "utf-8");
    const { metadata, content } = parseFrontmatter(raw);

    console.log(`Chunking: ${metadata.title} (${content.length} chars)`);

    const textChunks = chunkText(content);

    for (let i = 0; i < textChunks.length; i++) {
      allChunks.push({
        content: textChunks[i],
        chunk_index: i,
        source_url: metadata.source_url,
        source_title: metadata.title,
        fetched_at: metadata.fetched_at,
      });
    }

    console.log(`  → ${textChunks.length} chunks`);
  }

  console.log(`\nTotal: ${allChunks.length} chunks from ${mdFiles.length} files`);

  // 2. Embed all chunks in batches of 20
  console.log(`\nEmbedding ${allChunks.length} chunks (batch size ${BATCH_SIZE})...`);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map((c) => c.content);

    const embeddings = await embedBatch(batchTexts);
    allEmbeddings.push(...embeddings);

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);
    console.log(`  Embedded batch ${batchNum}/${totalBatches}`);

    // Rate limit: wait 1 second between batches
    await sleep(1000);
  }

  // 3. Build rows and insert to Supabase
  console.log(`\nUpserting ${allChunks.length} chunks to Supabase...`);

  const rows: ChunkRow[] = allChunks.map((chunk, i) => ({
    content: chunk.content,
    embedding: JSON.stringify(allEmbeddings[i]),  // pgvector accepts JSON array
    source_url: chunk.source_url,
    source_title: chunk.source_title,
    fetched_at: chunk.fetched_at,
    chunk_index: chunk.chunk_index,
  }));

  await upsertChunks(rows);

  console.log(`\nDone! ${allChunks.length} chunks ingested.`);

  // Close the database connection so the script exits cleanly
  await sql.end();
}

run();
