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
    host: process.env.NODE_ENV === "production"
      ? "aws-0-eu-west-1.pooler.supabase.com"
      : "db.rwhcwuzvuvjwipbdgivu.supabase.co",
    port: process.env.NODE_ENV === "production" ? 6543 : 5432,
    database: "postgres",
    username: process.env.NODE_ENV === "production"
      ? "postgres.rwhcwuzvuvjwipbdgivu"
      : "postgres",
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
// STEP 4: CALL GEMINI — STREAMING
// =============================================================================
// Instead of generateContent (waits for everything), we call
// streamGenerateContent?alt=sse. This opens an SSE (Server-Sent Events)
// connection: Gemini sends us small JSON chunks as it generates each token.
//
// We return the raw Response from Gemini. The POST handler below will read
// this stream, extract the text tokens, and re-stream them to the browser.
// Think of it as: this function opens the tap, POST() connects the hose.

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
];

async function streamFromGemini(prompt: PromptMessages): Promise<Response> {
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
    // Key difference: streamGenerateContent + alt=sse instead of generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
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

    // Return the raw response — its body is an SSE stream we'll read in POST()
    return response;
  }

  throw new Error("All Gemini models are currently unavailable. Please try again later.");
}

// =============================================================================
// STEP 5: THE ROUTE HANDLER — STREAMING
// =============================================================================
// This handler now returns a streaming response instead of waiting for
// everything. Here's the flow:
//
//   Browser ←──SSE──── Our API ←──SSE──── Gemini
//
// We read Gemini's SSE stream, extract the text from each event, and re-emit
// it to the browser as our own SSE events. At the end we send the sources.
//
// Our SSE protocol to the frontend is simple:
//   data: {"type":"token","text":"Les"}        ← one per token chunk
//   data: {"type":"sources","sources":[...]}   ← one at the very end
//   data: [DONE]                               ← signals end of stream

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

    // Steps 1-3 are identical to before — they don't need streaming
    const embedding = await embedQuery(message);
    const chunks = await retrieveChunks(embedding);
    const prompt = buildPrompt(message, chunks);

    // Step 4: Open the streaming connection to Gemini
    const geminiResponse = await streamFromGemini(prompt);

    // Prepare sources now (we already have the chunks), send them at the end
    const sources = chunks.map((chunk, i) => ({
      number: i + 1,
      title: chunk.source_title,
      url: chunk.source_url,
      fetched_at: chunk.fetched_at,
    }));

    // Step 5: Create a ReadableStream — our "conveyor belt"
    // It reads from Gemini's SSE stream and re-emits to the browser.
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // --- Read Gemini's SSE stream ---
        // Gemini sends us lines like:
        //   data: {"candidates":[{"content":{"parts":[{"text":"Les"}]}}]}
        //
        // We need to:
        // 1. Read the raw bytes from Gemini's response body
        // 2. Decode them into text
        // 3. Split by lines, find lines starting with "data: "
        // 4. Parse the JSON, extract the text
        // 5. Re-emit as our own SSE event to the browser

        const reader = geminiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // Lines can be split across chunks, so we buffer

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (split by newline)
            // A line is complete when we see \n — we handle \r\n too
            const lines = buffer.split(/\r?\n/);
            // Last element might be incomplete — keep it in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              // SSE format: lines starting with "data: " contain the payload
              // Empty lines are just event separators — skip them
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6); // Remove "data: " prefix
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const sseEvent = `data: ${JSON.stringify({ type: "token", text })}\n\n`;
                  controller.enqueue(encoder.encode(sseEvent));
                }
              } catch {
                // Skip malformed JSON (keep-alive pings, etc.)
              }
            }
          }

          // --- Stream is done, send sources and close ---
          const sourcesEvent = `data: ${JSON.stringify({ type: "sources", sources })}\n\n`;
          controller.enqueue(encoder.encode(sourcesEvent));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

        } catch (err) {
          controller.error(err);
        }
      },
    });

    // Return the stream as an SSE response
    // These headers tell the browser: "this is a stream, don't buffer it"
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",   // SSE content type
        "Cache-Control": "no-cache",            // Don't cache the stream
        Connection: "keep-alive",               // Keep the connection open
      },
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
