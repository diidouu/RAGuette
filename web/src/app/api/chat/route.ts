import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

// =============================================================================
// CONNECTION
// =============================================================================
// postgres() creates a connection pool. In dev, Next.js hot-reloads this file
// on every change, so we store the pool on `globalThis` to avoid leaking
// connections. In production this isn't an issue (one cold start per instance).

const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> };

const sql =
  globalForDb.sql ??
  postgres({
    host: "db.rwhcwuzvuvjwipbdgivu.supabase.co",
    port: 5432,
    database: "postgres",
    username: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD!,
    ssl: "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

// =============================================================================
// STEP 1: EMBED THE USER'S QUESTION
// =============================================================================
// We send the user's question to Gemini's embedding model. This returns a
// 3072-dimensional vector — the same dimensionality we used during ingestion.
// That vector represents the "meaning" of the question in a way that can be
// compared to our stored chunk vectors.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(`${EMBED_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding failed: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

// =============================================================================
// STEP 2: RETRIEVE RELEVANT CHUNKS
// =============================================================================
// We use pgvector's <=> operator (cosine distance) to find the 5 chunks whose
// embeddings are closest to our question embedding. Lower distance = more
// semantically similar.
//
// The query returns the chunk text + its source metadata so we can build
// citations later.

interface Chunk {
  content: string;
  source_url: string;
  source_title: string;
  fetched_at: Date;
  distance: number;
}

async function retrieveChunks(embedding: number[]): Promise<Chunk[]> {
  // pgvector expects the vector as a string like '[0.1, 0.2, ...]'
  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await sql<Chunk[]>`
    SELECT
      content,
      source_url,
      source_title,
      fetched_at,
      embedding <=> ${vectorStr}::vector AS distance
    FROM chunks
    ORDER BY distance ASC
    LIMIT 5
  `;

  return rows;
}

// =============================================================================
// STEP 3: BUILD THE PROMPT
// =============================================================================
// We construct two messages for Gemini:
// - A system instruction that defines the assistant's behavior
// - A user message that contains the retrieved context + the actual question
//
// The chunks are numbered [1], [2], etc. so the LLM can reference them in its
// answer. We also tell it to respond in the same language as the question.

interface PromptMessages {
  systemInstruction: string;
  userMessage: string;
}

function buildPrompt(question: string, chunks: Chunk[]): PromptMessages {
  // Format each chunk with its number and source
  const context = chunks
    .map((chunk, i) => {
      return `[${i + 1}] (source: ${chunk.source_title})\n${chunk.content}`;
    })
    .join("\n\n");

  const systemInstruction = `Tu es un assistant spécialisé dans les questions administratives et fiscales des freelances et micro-entrepreneurs en France.

Règles :
- Réponds dans la langue de la question (français si question en français, anglais si question en anglais).
- Base tes réponses UNIQUEMENT sur le contexte fourni ci-dessous. Ne réponds jamais à partir de tes connaissances générales.
- Cite tes sources en utilisant les numéros entre crochets [1], [2], etc.
- Si le contexte ne contient pas assez d'information pour répondre, dis-le clairement.
- Termine par un rappel : "Cette information est donnée à titre indicatif. Consultez un expert-comptable pour un conseil personnalisé."`;

  const userMessage = `Contexte :
${context}

---

Question : ${question}`;

  return { systemInstruction, userMessage };
}

// =============================================================================
// STEP 4: CALL GEMINI TO GENERATE THE ANSWER
// =============================================================================
// We use the Gemini REST API directly (no SDK). The model receives our system
// instruction + user message and returns a text response.
//
// We use gemini-2.0-flash because it's fast, free-tier eligible, and good
// enough for v0.1. We can swap to a better model later.

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
];

async function generateAnswer(prompt: PromptMessages): Promise<string> {
  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: prompt.systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt.userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (response.status === 503 || response.status === 429) {
      console.warn(`${model} unavailable (${response.status}), trying next model...`);
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini generation failed: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error("All Gemini models are currently unavailable. Please try again later.");
}

// =============================================================================
// STEP 5: THE ROUTE HANDLER
// =============================================================================
// This is the actual Next.js API route. It orchestrates all the steps above:
// 1. Parse the request body
// 2. Embed the question
// 3. Retrieve relevant chunks
// 4. Build the prompt
// 5. Generate the answer
// 6. Return the answer + source metadata

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing 'message' field in request body" },
        { status: 400 }
      );
    }

    // 1. Embed the question
    const embedding = await embedQuery(message);

    // 2. Find the most relevant chunks
    const chunks = await retrieveChunks(embedding);

    // 3. Build the prompt with context
    const prompt = buildPrompt(message, chunks);

    // 4. Generate the answer
    const answer = await generateAnswer(prompt);

    // 5. Return answer + sources for the frontend to render citations
    const sources = chunks.map((chunk, i) => ({
      number: i + 1,
      title: chunk.source_title,
      url: chunk.source_url,
      fetched_at: chunk.fetched_at,
    }));

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
