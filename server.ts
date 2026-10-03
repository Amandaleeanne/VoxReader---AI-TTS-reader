import express from "express";
import dotenv from "dotenv";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { EdgeTTS } from "node-edge-tts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "50mb" }));

// Shared default GoogleGenAI client (User-Agent header required by AI Studio guidelines)
const defaultAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const VALID_GEMINI_VOICES = ["Kore", "Puck", "Fenrir", "Charon", "Zephyr"] as const;

export const EDGE_VOICES = [
  { id: "en-US-AriaNeural", name: "Aria (US Neural - Expressive)", lang: "en-US" },
  { id: "en-US-GuyNeural", name: "Guy (US Neural - Professional)", lang: "en-US" },
  { id: "en-US-JennyNeural", name: "Jenny (US Neural - Warm & Friendly)", lang: "en-US" },
  { id: "en-GB-SoniaNeural", name: "Sonia (UK Neural - Sophisticated)", lang: "en-GB" },
  { id: "en-GB-RyanNeural", name: "Ryan (UK Neural - Clear)", lang: "en-GB" },
  { id: "en-AU-NatashaNeural", name: "Natasha (AU Neural - Bright)", lang: "en-AU" },
  { id: "en-CA-ClaraNeural", name: "Clara (CA Neural - Smooth)", lang: "en-CA" },
];

// Health / status endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiVoices: VALID_GEMINI_VOICES,
    edgeVoices: EDGE_VOICES,
  });
});

// Endpoint: Generate Speech via Gemini 3.8 Flash Lite TTS (Supports default or user-provided Gemini key)
app.post("/api/tts/gemini", async (req, res) => {
  try {
    const { text, voice } = req.body;
    const customKey = (req.headers["x-gemini-key"] as string) || "";
    const activeKey = customKey.trim() || process.env.GEMINI_API_KEY;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required for TTS generation." });
    }

    if (!activeKey) {
      return res.status(503).json({
        error: "Gemini API key is not configured. You can use free EdgeTTS, offline Web Speech, or add your key in Voice Settings.",
      });
    }

    const aiClient = customKey.trim()
      ? new GoogleGenAI({
          apiKey: customKey.trim(),
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        })
      : defaultAi;

    const selectedVoice = VALID_GEMINI_VOICES.includes(voice) ? voice : "Kore";
    const cleanText = text.trim().slice(0, 3000);

    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: cleanText,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(502).json({ error: "No audio data received from Gemini TTS model." });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      voice: selectedVoice,
    });
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate speech with Gemini TTS.",
    });
  }
});

// Endpoint: Generate Speech via EdgeTTS (100% Free, No API key needed, high-quality neural voices)
app.post("/api/tts/edge", async (req, res) => {
  let tempFile = "";
  try {
    const { text, voice } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required for EdgeTTS." });
    }

    const selectedVoice = voice || "en-US-AriaNeural";
    const cleanText = text.trim().slice(0, 3000);

    const tts = new EdgeTTS({ voice: selectedVoice });
    tempFile = path.join(os.tmpdir(), `edge-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);

    await tts.ttsPromise(cleanText, tempFile);

    const buffer = fs.readFileSync(tempFile);
    const base64Audio = buffer.toString("base64");

    return res.json({
      audioBase64: base64Audio,
      mimeType: "audio/mp3",
      voice: selectedVoice,
    });
  } catch (error: any) {
    console.error("EdgeTTS Error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate speech with EdgeTTS.",
    });
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore
      }
    }
  }
});

// Endpoint: Generate Speech via OpenAI TTS (Using user's own OpenAI API key)
app.post("/api/tts/openai", async (req, res) => {
  try {
    const userKey = (req.headers["x-openai-key"] as string) || req.body.apiKey;
    const { text, voice = "alloy", speed = 1.0 } = req.body;

    if (!userKey || typeof userKey !== "string" || !userKey.trim()) {
      return res.status(401).json({
        error: "An OpenAI API key is required to use OpenAI voices. Add your key in Voice Settings.",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for OpenAI TTS." });
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.trim().slice(0, 3000),
        voice: voice || "alloy",
        speed: Math.max(0.25, Math.min(speed, 4.0)),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData.error?.message || `OpenAI TTS error (HTTP ${response.status})`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return res.json({
      audioBase64: base64Audio,
      mimeType: "audio/mp3",
      voice,
    });
  } catch (error: any) {
    console.error("OpenAI TTS Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to generate OpenAI TTS speech." });
  }
});

// Endpoint: Generate Speech via ElevenLabs TTS (Using user's own ElevenLabs API key)
app.post("/api/tts/elevenlabs", async (req, res) => {
  try {
    const userKey = (req.headers["x-elevenlabs-key"] as string) || req.body.apiKey;
    const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = req.body;

    if (!userKey || typeof userKey !== "string" || !userKey.trim()) {
      return res.status(401).json({
        error: "An ElevenLabs API key is required to use ElevenLabs voices. Add your key in Voice Settings.",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for ElevenLabs TTS." });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": userKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 3000),
        model_id: "eleven_monolingual_v1",
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData.detail?.message || `ElevenLabs TTS error (HTTP ${response.status})`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return res.json({
      audioBase64: base64Audio,
      mimeType: "audio/mp3",
      voice: voiceId,
    });
  } catch (error: any) {
    console.error("ElevenLabs TTS Error:", error);
    return res.status(500).json({ error: error?.message || "Failed to generate ElevenLabs TTS speech." });
  }
});

// Helper: Fully decode HTML entities (decimal, hex, named, double-encoded) and normalize quotes
function decodeHtmlAndNormalizeQuotes(text: string): string {
  if (!text) return "";
  let s = text;

  // 1. Resolve double-encoded entities: e.g. &amp;#8220; -> &#8220;
  s = s.replace(/&amp;(#[0-9a-zA-Z]+;?|[a-zA-Z]+;?)/gi, "&$1");

  // 2. Specific quotation and apostrophe entities (curly & straight, decimal, hex, named)
  s = s
    .replace(/&(?:#\s*8220|#\s*147|#x201c|ldquo);?/gi, "“")
    .replace(/&(?:#\s*8221|#\s*148|#x201d|rdquo);?/gi, "”")
    .replace(/&(?:#\s*8216|#\s*145|#x2018|lsquo);?/gi, "‘")
    .replace(/&(?:#\s*8217|#\s*146|#x2019|rsquo);?/gi, "’")
    .replace(/&(?:#\s*34|#x22|quot);?/gi, '"')
    .replace(/&(?:#\s*39|#x27|apos);?/gi, "'")
    .replace(/&(?:#\s*171|#xab|laquo);?/gi, "«")
    .replace(/&(?:#\s*187|#xbb|raquo);?/gi, "»")
    .replace(/&(?:#\s*8218|#x201a|sbquo);?/gi, "‚")
    .replace(/&(?:#\s*8222|#x201e|bdquo);?/gi, "„");

  // 3. Catch orphaned numeric entity codes where &# was stripped
  // e.g. "8220;Hello" or "8221;" or "8217;"
  s = s
    .replace(/(?:^|\b|\s)8220;/g, " “")
    .replace(/8220;/g, "“")
    .replace(/8221;?/g, "”")
    .replace(/8216;/g, "‘")
    .replace(/8217;?/g, "’");

  // 4. Other typographical symbols
  s = s
    .replace(/&(?:#\s*8212|#x2014|mdash);?/gi, "—")
    .replace(/&(?:#\s*8211|#x2013|ndash);?/gi, "–")
    .replace(/&(?:#\s*8230|#x2026|hellip);?/gi, "…")
    .replace(/&(?:#\s*160|#xa0|nbsp);?/gi, " ")
    .replace(/&(?:#\s*60|#x3c|lt);?/gi, "<")
    .replace(/&(?:#\s*62|#x3e|gt);?/gi, ">")
    .replace(/&(?:#\s*38|#x26|amp);?/gi, "&");

  // 5. General decimal entities
  s = s.replace(/&#\s*(\d+);?/g, (_, codeStr) => {
    try {
      const code = parseInt(codeStr, 10);
      return code >= 32 && code !== 127 ? String.fromCodePoint(code) : "";
    } catch {
      return "";
    }
  });

  // 6. General hex entities
  s = s.replace(/&#x\s*([0-9a-fA-F]+);?/g, (_, hexStr) => {
    try {
      const code = parseInt(hexStr, 16);
      return code >= 32 && code !== 127 ? String.fromCodePoint(code) : "";
    } catch {
      return "";
    }
  });

  return s;
}

// Endpoint: Proxy binary files (PDF, ePub) with streaming and CORS headers
app.get("/api/proxy-file", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).send("A valid URL parameter is required.");
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
    } catch {
      return res.status(400).send("Invalid URL format.");
    }

    const fileRes = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VoxRead/1.0",
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!fileRes.ok) {
      return res.status(fileRes.status).send(`Failed to fetch file: ${fileRes.statusText}`);
    }

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return res.send(buffer);
  } catch (err: any) {
    console.error("Proxy file error:", err);
    return res.status(500).send(err.message || "Failed to proxy file.");
  }
});

// Endpoint: Extract article content from a webpage URL or download PDF/ePub files
app.post("/api/extract-webpage", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "A valid URL is required." });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: "Invalid URL format." });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VoxRead/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,application/epub+zip,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch webpage: HTTP ${response.status} ${response.statusText}`,
      });
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const pathnameLower = parsedUrl.pathname.toLowerCase();
    const isPdf =
      pathnameLower.endsWith(".pdf") ||
      contentType.includes("application/pdf") ||
      contentType.includes("application/x-pdf");
    const isEpub =
      pathnameLower.endsWith(".epub") ||
      contentType.includes("application/epub") ||
      contentType.includes("application/epub+zip");

    // Handle direct PDF or ePub file links
    if (isPdf || isEpub) {
      let fileName = "";
      const disposition = response.headers.get("content-disposition");
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        if (match?.[1]) {
          fileName = decodeURIComponent(match[1]);
        }
      }
      if (!fileName) {
        const segments = parsedUrl.pathname.split("/").filter(Boolean);
        fileName = segments.pop() || (isPdf ? "document.pdf" : "book.epub");
      }
      if (!fileName.toLowerCase().endsWith(isPdf ? ".pdf" : ".epub")) {
        fileName += isPdf ? ".pdf" : ".epub";
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const proxyDownloadUrl = `/api/proxy-file?url=${encodeURIComponent(parsedUrl.toString())}`;

      let base64: string | undefined = undefined;
      // Include base64 directly for files under 25MB for single-roundtrip parsing
      if (buffer.length < 25 * 1024 * 1024) {
        base64 = buffer.toString("base64");
      }

      return res.json({
        isBinaryFile: true,
        fileType: isPdf ? "pdf" : "epub",
        fileName,
        url: parsedUrl.toString(),
        domain: parsedUrl.hostname,
        base64,
        proxyDownloadUrl,
        sizeBytes: buffer.length,
        contentType: isPdf ? "application/pdf" : "application/epub+zip",
      });
    }

    const html = await response.text();

    // Extract title
    let title = "";
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    const titleTagMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);

    if (ogTitleMatch?.[1]) {
      title = ogTitleMatch[1];
    } else if (titleTagMatch?.[1]) {
      title = titleTagMatch[1];
    } else if (h1Match?.[1]) {
      title = h1Match[1].replace(/<[^>]+>/g, "").trim();
    } else {
      title = parsedUrl.hostname;
    }

    // Clean decode HTML entities & quotes in title
    title = decodeHtmlAndNormalizeQuotes(
      title
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );

    // Extract documentation navigation (Next / Previous page buttons for docs or articles)
    let docNavigation: { next?: { title: string; url: string }; prev?: { title: string; url: string } } | undefined = undefined;

    const isDocUrl =
      /\/docs?(\/|$)/i.test(parsedUrl.pathname) ||
      /^docs?\./i.test(parsedUrl.hostname);

    const linkRegex = /<a\b([^>]*)>(.*?)<\/a>/gis;
    let linkMatch: RegExpExecArray | null;

    let foundNext: { title: string; url: string } | null = null;
    let foundPrev: { title: string; url: string } | null = null;
    const docLinks: { title: string; url: string }[] = [];

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const attrs = linkMatch[1];
      const rawLinkHtml = linkMatch[2];
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch || !hrefMatch[1] || hrefMatch[1].startsWith("#") || hrefMatch[1].startsWith("javascript:")) {
        continue;
      }

      const href = hrefMatch[1];
      let absLinkUrl: string;
      try {
        absLinkUrl = new URL(href, parsedUrl).toString();
      } catch {
        continue;
      }

      // Ignore current page URL or anchor on same page
      if (absLinkUrl === parsedUrl.toString() || absLinkUrl.split("#")[0] === parsedUrl.toString().split("#")[0]) {
        continue;
      }

      const linkText = decodeHtmlAndNormalizeQuotes(
        rawLinkHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      );
      const ariaLabelMatch = attrs.match(/aria-label=["']([^"']+)["']/i);
      const titleAttrMatch = attrs.match(/title=["']([^"']+)["']/i);
      const ariaLabel = ariaLabelMatch?.[1] ? decodeHtmlAndNormalizeQuotes(ariaLabelMatch[1]) : "";
      const titleAttr = titleAttrMatch?.[1] ? decodeHtmlAndNormalizeQuotes(titleAttrMatch[1]) : "";
      const fullLabel = `${linkText} ${ariaLabel} ${titleAttr}`.trim();

      const isRelNext = /\brel=["'][^"']*\bnext\b[^"']*["']/i.test(attrs);
      const isRelPrev = /\brel=["'][^"']*\bprev(ious)?\b[^"']*["']/i.test(attrs);
      const isClassNext = /\bclass=["'][^"']*(pagination-nav__link--next|next-page|btn-next|next-link|nav-next)[^"']*["']/i.test(attrs);
      const isClassPrev = /\bclass=["'][^"']*(pagination-nav__link--prev|prev-page|btn-prev|prev-link|nav-prev)[^"']*["']/i.test(attrs);

      const textIsNext =
        /^(next|next\s+page|next\s+chapter|next\s+topic|next\s+article)\b/i.test(fullLabel) ||
        /\b(next\s+page|next\s+topic|next\s+chapter)\b/i.test(fullLabel) ||
        /(\bnext\b.*?(?:→|»|>))/i.test(fullLabel);

      const textIsPrev =
        /^(previous|prev|previous\s+page|previous\s+chapter|previous\s+topic)\b/i.test(fullLabel) ||
        /\b(previous\s+page|prev\s+page)\b/i.test(fullLabel) ||
        /((?:←|«|<).*?\b(previous|prev)\b)/i.test(fullLabel);

      if ((isRelNext || isClassNext || textIsNext) && !foundNext) {
        let displayTitle = fullLabel
          .replace(/^(next\s*[:\-|»>→]\s*|next\s+page\s*[:\-|»>→]?\s*)/i, "")
          .replace(/[»>→]+$/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!displayTitle || displayTitle.toLowerCase() === "next") {
          displayTitle = "Next Page";
        }
        foundNext = { title: displayTitle, url: absLinkUrl };
      }

      if ((isRelPrev || isClassPrev || textIsPrev) && !foundPrev) {
        let displayTitle = fullLabel
          .replace(/^(previous\s*[:\-|«<←]\s*|prev\s*[:\-|«<←]?\s*)/i, "")
          .replace(/^[«<←]+/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!displayTitle || displayTitle.toLowerCase() === "previous" || displayTitle.toLowerCase() === "prev") {
          displayTitle = "Previous Page";
        }
        foundPrev = { title: displayTitle, url: absLinkUrl };
      }

      // Collect doc links for fallback
      if (isDocUrl && /\/docs?(\/|$)/i.test(absLinkUrl) && linkText.length > 3) {
        docLinks.push({ title: linkText, url: absLinkUrl });
      }
    }

    // Fallback for doc pages: if next link wasn't explicitly tagged, use the first subsequent doc link
    if (isDocUrl && !foundNext && docLinks.length > 0) {
      foundNext = { title: docLinks[0].title, url: docLinks[0].url };
    }

    if (foundNext || foundPrev) {
      docNavigation = {
        next: foundNext || undefined,
        prev: foundPrev || undefined,
      };
    }

    // Strip scripts, styles, svg, forms, navigation, footer, headers
    let cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "");

    // Extract readable paragraphs and heading elements
    const blockRegex = /<(p|h1|h2|h3|h4|blockquote|li)[^>]*>(.*?)<\/\1>/gis;
    const blocks: string[] = [];
    let match: RegExpExecArray | null;

    const currentBaseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, "");

    while ((match = blockRegex.exec(cleanHtml)) !== null) {
      const tagName = match[1].toLowerCase();
      const isHeadingTag = /^h[1-4]$/.test(tagName);
      const headingLevel = isHeadingTag ? parseInt(tagName[1], 10) : 2;

      let hasInternalHeaderLink = false;
      let internalHeaderTitle = "";

      // Process <a> tags:
      // If mailto: -> discard hyperlink and parse as plain text email
      // If external -> preserve as markdown link [anchor](url)
      // If internal -> discard hyperlink! If it's a section anchor / header, make it a heading!
      const blockWithProcessedLinks = match[2].replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, (_, href, anchorHtml) => {
        try {
          // Check mailto: link -> parse as plain text e-mail address and discard hyperlink
          if (/^mailto:/i.test(href)) {
            let emailText = anchorHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            emailText = emailText.replace(/^mailto:\s*/i, "").trim();
            if (!emailText) {
              emailText = href.replace(/^mailto:\s*/i, "").split("?")[0].trim();
            }
            return ` ${emailText} `;
          }

          const absUrl = new URL(href, parsedUrl).toString();
          let cleanAnchor = anchorHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          // Remove anchor symbols like ¶, §, #
          cleanAnchor = cleanAnchor.replace(/[¶§#]/g, "").trim();

          const linkBase = absUrl.split("#")[0].replace(/\/$/, "");
          const isInternal = href.startsWith("#") || (absUrl.includes("#") && currentBaseUrl === linkBase);

          if (isInternal) {
            // Internal hyperlink: DISCARD HYPERLINK!
            if (!cleanAnchor) return "";
            hasInternalHeaderLink = true;
            internalHeaderTitle = cleanAnchor;
            return ` ${cleanAnchor} `;
          }

          if (!cleanAnchor) return "";
          if (cleanAnchor === absUrl || cleanAnchor === href) {
            return ` ${absUrl} `;
          }
          return ` [${cleanAnchor}](${absUrl}) `;
        } catch {
          return anchorHtml;
        }
      });

      const rawBlockText = blockWithProcessedLinks
        .replace(/<[^>]+>/g, " ")
        .replace(/&(?:para|sect);/gi, "")
        .replace(/[¶§\u00B6\u00A7\u2029\u2028\f]/g, "")
        .replace(/\bmailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, "$1")
        .replace(/\bmailto:\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      let text = decodeHtmlAndNormalizeQuotes(rawBlockText);

      // If this block is an HTML heading tag (<h1>-<h4>) OR is primarily an internal header link:
      // Turn it into a larger and bolder header (## Title) with NO hyperlink!
      if (isHeadingTag && text.length > 0) {
        const hashes = "#".repeat(Math.min(headingLevel, 3));
        text = `${hashes} ${text}`;
      } else if (hasInternalHeaderLink && internalHeaderTitle && (text === internalHeaderTitle || text.length <= internalHeaderTitle.length + 10)) {
        text = `## ${internalHeaderTitle}`;
      }

      if (text.length > 2 && !/cookie|privacy policy|terms of service|all rights reserved/i.test(text)) {
        blocks.push(text);
      }
    }

    let articleContent = blocks.join("\n\n");

    if (articleContent.length < 100) {
      const bodyText = decodeHtmlAndNormalizeQuotes(
        cleanHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );
      articleContent = bodyText.slice(0, 10000);
    }

    return res.json({
      title,
      domain: parsedUrl.hostname,
      url: parsedUrl.toString(),
      content: articleContent,
      excerpt: articleContent.slice(0, 240) + (articleContent.length > 240 ? "..." : ""),
      docNavigation,
    });
  } catch (error: any) {
    console.error("Webpage Extraction Error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to extract article content from URL.",
    });
  }
});

// Setup Vite middleware or static file serving
const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxRead Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
