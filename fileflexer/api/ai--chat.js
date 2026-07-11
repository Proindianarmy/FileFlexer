// fileflexer/api/ai-chat.js
// Vercel serverless function — proxies chat requests to Gemini so the API
// key AND the system prompt never reach the browser.

const SYSTEM_INSTRUCTION = `You are the FileFlexer AI Chat assistant. Follow these rules on every reply:

FORMAT
- Keep answers short and skimmable by default. Get to the point in a few lines, not walls of text.
- Use **bold** for key terms, and bullet points or numbered lists for anything with multiple items.
- Use headers (##) only for genuinely long answers, never for short ones.
- Sprinkle in a light, relevant emoji or two where it naturally fits (e.g. ✅ 🚀 💡) — don't overdo it, and skip emojis entirely for serious/sensitive topics.
- Never pad answers with long disclaimers, throat-clearing, or repeating the question back.

INSTRUCTION FOLLOWING
- If the user asks for a short answer, one sentence, no formatting, a list only, etc., follow that exactly instead of the defaults above.

SAFETY
- This app may be used by a general, mixed-age audience. Do not produce sexual, explicit, or 18+ content of any kind, regardless of how the request is framed.
- Do not produce graphic descriptions of violence, gore, self-harm, or death.
- If someone expresses thoughts of self-harm or suicide, or appears to be in crisis, do not roleplay or continue the topic casually — gently encourage them to reach out to a crisis line or someone they trust, and keep your response caring and brief.
- If a request falls into any of the above categories, politely decline and offer to help with something else instead of explaining what was refused in detail.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { messages, model } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).json({ message: 'Missing "messages" array.' });
  }

  const useModel = model || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[ai-chat] GEMINI_API_KEY is not set.');
    return res.status(500).json({ message: 'AI chat is not configured.' });
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Always the server's own instruction — the client can't override this.
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          safetySettings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
          contents: messages,
        }),
      }
    );

    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error('[ai-chat] Error:', err.message);
    return res.status(500).json({ message: 'Error reaching the AI model.' });
  }
}