import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

app.post("/api/analyze-media", async (req, res) => {
  try {
    const { items, prompt } = req.body;
    // items: { type: "image" | "video", dataUrl: string, name: string }[]

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Convert dataUrls to generative parts
    const parts = items.map((item: any) => {
      const match = item.dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }
      return null;
    }).filter(Boolean);

    if (parts.length === 0 && items.length > 0) {
       return res.status(400).json({ error: "No valid media found." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            ...parts,
            { text: prompt || "Analyze these media files and suggest a short creative script and timeline arrangement for a vertical video (TikTok/Reels). Also return an array of suggested durations (in seconds) for each clip." }
          ],
        },
      ],
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A catchy title for the video" },
            script: { type: Type.STRING, description: "A short voiceover script or captions" },
            suggestions: { type: Type.STRING, description: "Overall editing advice" },
            clipDurations: {
               type: Type.ARRAY,
               items: { type: Type.NUMBER },
               description: "Suggested duration in seconds for each clip in the order they were provided."
            }
          },
          required: ["title", "script", "suggestions", "clipDurations"]
        }
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze media" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
