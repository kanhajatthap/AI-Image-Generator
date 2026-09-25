/**
 * Cross-chat assistant memory (ChatGPT-style).
 *
 * Personal facts the user reveals in any chat — their name, their wife's name,
 * where they live, what they do — are automatically extracted and stored on the
 * `users` document as a `memory: string[]` array. On every text turn those
 * facts are injected into the system prompt, so context given in chat #1 is
 * remembered when the user opens chat #2. No manual "add fact" needed — the app
 * just remembers what you tell it, and you can delete a fact from Settings.
 *
 * Facts are captured automatically when a prompt looks like it contains a
 * durable personal fact (name intros, "my wife's name is …, my mom's name is …",
 * "I live in …"): a Gemini extraction call (cheap, fired only on a heuristic
 * hit) produces the facts, with a regex fallback for when that's unavailable.
 */

import { Db, ObjectId } from "mongodb";
import { TEXT_SYSTEM_PROMPT } from "./text";

export const MAX_MEMORY_FACTS = 50;

// Gate only fires on explicit "this is my name" phrases — deliberately NOT on
// "i am a …" to avoid capturing things like "I am a software engineer". The
// negative lookahead also skips plain questions ("mera naam kya hai?").
export const NAME_INTRO_RE =
  /\b(?:my name is|my name's|call me|mera naam|mera name|meri naam|mujhe bulao|mujhe bulate|mujhe bolte|mujhe call kar|mujhe bula sakte)\s+(?!(?:kya|what|kaunsa|kaun|who|whose)\b)\S.{0,47}/i;

// Catches "my wife's name is Pooja", "meri wife ka naam Pooja hai", "meri mummy
// ka naam Sunita hai" — a relation-word possession, not a plain question.
const RELATIVE_NAME_RE =
  /\b(?:my|meri|mere|apni|apne)\s+(wife|husband|girlfriend|boyfriend|bhai|brother|sister|behen|behan|mom|maa|mummy|mother|papa|dad|father|dada|dadi|nana|nani|beta|beti|son|daughter|friend|boss|patni|biwi|pati)\s*(?:'s|of|ka|ki|ke)\s+(?:naam|name)(?:a|e)?\s+(?:hai|hain|raha|rahi|is)?\s*([A-Za-z][A-Za-z' .-]{1,39})/i;

// Other low-risk durable-fact markers ("I live in Delhi", "I work as a …") that
// justify running the (heuristic-gated) Gemini extractor.
const FACT_MARKER_RE =
  /\b(?:i live in|i stay in|i work as|i work at|main rehta|main rehti|me rehta|mein rehta|mera favourite|meri favourite|mujhe pasand|i love|i like|i was born|mera birth|i am from|mai hu se|hometown)\b/i;

// Hindi family words → friendly English labels used in generated facts.
const RELATION_MAP: Record<string, string> = {
  bhai: "brother",
  behen: "sister",
  behan: "sister",
  patni: "wife",
  biwi: "wife",
  pati: "husband",
  maa: "mother",
  mummy: "mother",
  papa: "father",
  beti: "daughter",
  beta: "son",
  dada: "paternal grandfather",
  dadi: "paternal grandmother",
  nana: "maternal grandfather",
  nani: "maternal grandmother",
};

/** True when the message might contain a durable personal fact worth saving. */
export function hasMemoryCandidate(prompt: string): boolean {
  return NAME_INTRO_RE.test(prompt) || RELATIVE_NAME_RE.test(prompt) || FACT_MARKER_RE.test(prompt);
}

// Strip filler verbs ("hai", "ha") that sit inside the phrase, so "mera naam
// Rahul hai jaldi batana" yields "Rahul" instead of "Rahul hai...".
const FILLER_VERB_RE = /\b(?:hai|hain|ha|tha|hoga|hoge|honge|honi)\b/i;
const QUESTION_WORDS_RE = /\b(?:kya|what|kaunsa|kaun|who|whose|why|kaise|kaisi)\b/i;

function normalizeFact(fact: string): string {
  return fact.replace(/\s+/g, " ").trim();
}

function factKey(fact: string): string {
  return normalizeFact(fact).toLowerCase();
}

function mergeDedup(current: string[], incoming: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...current, ...incoming]) {
    const fact = normalizeFact(raw);
    if (!fact) continue;
    const key = factKey(fact);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
    if (out.length >= limit) break;
  }
  return out;
}

/** Reads the user's stored memory facts (returns [] on any lookup problem). */
export async function getUserMemory(db: Db, userId: string): Promise<string[]> {
  try {
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) }, { projection: { memory: 1 } });
    const memory = user?.memory;
    const facts = Array.isArray(memory) ? memory.filter((f): f is string => typeof f === "string") : [];
    return facts.slice(0, MAX_MEMORY_FACTS);
  } catch {
    return [];
  }
}

/** Merges new facts with the existing set (deduped, capped) and persists them. */
export async function addUserMemoryFacts(db: Db, userId: string, facts: string[]): Promise<string[]> {
  const clean = Array.from(new Set(facts.map(normalizeFact))).filter(Boolean);
  if (!clean.length) return getUserMemory(db, userId);
  try {
    const current = await getUserMemory(db, userId);
    const merged = mergeDedup(current, clean, MAX_MEMORY_FACTS);
    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { memory: merged } });
    return merged;
  } catch {
    return getUserMemory(db, userId);
  }
}

/** Removes one fact (case-insensitive match) and returns the updated list. */
export async function removeUserMemoryFact(db: Db, userId: string, fact: string): Promise<string[]> {
  try {
    const current = await getUserMemory(db, userId);
    const target = factKey(fact);
    const remaining = current.filter((f) => factKey(f) !== target);
    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { memory: remaining } });
    return remaining;
  } catch {
    return getUserMemory(db, userId);
  }
}

/** Builds the full system prompt for a text turn, memory first-class included. */
export function buildMemorySystemPrompt(memory: string[]): string {
  if (!memory.length) return TEXT_SYSTEM_PROMPT;
  const facts = memory
    .map((f) => `- ${normalizeFact(f)}`)
    .join("\n");
  return (
    TEXT_SYSTEM_PROMPT +
    "\n\nTHE USER'S PRIVATE PROFILE (facts they told you). Use them naturally, never recite, never expose them " +
    "unless the user asks:\n" +
    facts
  );
}

const MEMORY_EXTRACTION_SYSTEM_PROMPT =
  "You are a memory extractor. From the user message, find durable personal facts the user reveals " +
  "about themselves: their name, how they want to be addressed, occupation, city, interests, relationships, " +
  "or preferences. Return ONLY a JSON array of short standalone fact strings phrased in third person, " +
  "e.g. [\"The user's name is Rohan.\", \"The user works as a designer.\"]. " +
  "Exclude one-off questions, thanks, or answerable requests. If no durable personal fact exists, return []. " +
  "Do not return anything other than the JSON array.";

async function callGeminiForFacts(text: string): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${
        process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite"
      }:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: MEMORY_EXTRACTION_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 512 },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== "string" || !raw.trim()) return null;

    let parsed: unknown = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      parsed = JSON.parse(parsed as string);
    } catch {
      return null;
    }
    // Some models double-encode the JSON as a string.
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, MAX_MEMORY_FACTS);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanPhrase(p: string): string {
  return p
    .replace(FILLER_VERB_RE, " ")
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(raw: string): string {
  const words = cleanPhrase(raw).split(/\s+/).filter((w) => !FILLER_VERB_RE.test(w));
  return words.slice(0, 3).join(" ");
}

// For relative-name captures: stop at the first filler verb or connector
// ("hai", "aur", "and") so "meri wife ka naam Pooja hai aur wo engineer hai"
// yields just "Pooja" instead of trailing junk.
const STOP_WORD_RE =
  /^(?:hai|hain|ha|tha|hoga|hoge|honge|honi|is|are|ka|ki|ke|aur|and|wa|wo|the|a|an)$/i;

function cleanRelativeName(raw: string): string {
  const words: string[] = [];
  for (const w of raw.trim().replace(/[.!?]+$/, "").split(/\s+/)) {
    if (words.length >= 3) break;
    if (STOP_WORD_RE.test(w)) break;
    words.push(w);
  }
  return words.join(" ");
}

export function fallbackRegexFacts(prompt: string): string[] {
  const nameM = NAME_INTRO_RE.exec(prompt);
  if (nameM) {
    // Pull out the phrase after the intro keyword.
    const phrase = cleanName(
      nameM[0].replace(
        /^(?:my name is|my name's|call me|mera naam|mera name|meri naam|mujhe bulao|mujhe bulate|mujhe bolte|mujhe call kar|mujhe bula sakte)\s+(?!(?:kya|what|kaunsa|kaun|who|whose)\b)/i,
        "",
      ),
    );
    if (!phrase || QUESTION_WORDS_RE.test(phrase)) return [];
    return [`The user's name is ${phrase}.`];
  }

  const relM = RELATIVE_NAME_RE.exec(prompt);
  if (relM) {
    const relation = relM[1]?.toLowerCase();
    const name = cleanRelativeName(relM[2] || "");
    if (!relation || !name || QUESTION_WORDS_RE.test(name)) return [];
    const label = RELATION_MAP[relation] ?? relation;
    return [`The user's ${label}'s name is ${name}.`];
  }

  return [];
}

/** Lightweight: only attempts extraction when the prompt looks factual. */
export async function extractMemoryFacts(prompt: string): Promise<string[]> {
  if (!hasMemoryCandidate(prompt)) return [];
  const facts = await callGeminiForFacts(prompt);
  return facts ?? fallbackRegexFacts(prompt);
}