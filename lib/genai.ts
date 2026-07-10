import { GoogleGenAI } from '@google/genai';

/**
 * Shared Gemini client.
 *
 * The Google org security policy disallows raw API keys, so locally we use
 * Vertex AI + Application Default Credentials (set GOOGLE_GENAI_USE_VERTEXAI=true
 * and run `gcloud auth application-default login`). Falls back to an API key if
 * that flag is off (e.g. a future environment where keys are allowed).
 */
let client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (client) return client;

  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not set for Vertex mode.');
    client = new GoogleGenAI({ vertexai: true, project, location });
    return client;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  client = new GoogleGenAI({ apiKey });
  return client;
}
