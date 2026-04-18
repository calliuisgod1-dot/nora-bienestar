import { GoogleGenAI } from "@google/genai";
import { NORA_SYSTEM_INSTRUCTION } from "../constants";
import { MoodType } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || '' 
});

export class GeminiService {
  static async chat(message: string, history: { role: string; parts: string }[] = [], imageBase64?: string, mood?: MoodType) {
    // Switching to 3.1 Flash Lite for better free-tier resilience and speed
    const modelName = "gemini-3.1-flash-lite-preview"; 
    
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Llave maestra no encontrada.");
      }

      const moodContext = mood ? `[ESTADO DEL RADAR: ${mood.toUpperCase()}] ` : "";
      
      const contents: any[] = [];
      
      history.forEach(h => {
        if (h.parts && h.parts.trim()) {
          contents.push({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.parts }]
          });
        }
      });

      const currentParts: any[] = [{ text: moodContext + message }];
      if (imageBase64) {
        currentParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64.split(',')[1] || imageBase64
          }
        });
      }

      contents.push({
        role: "user",
        parts: currentParts
      });

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: NORA_SYSTEM_INSTRUCTION,
          temperature: 0.8,
        }
      });

      if (!response.text) {
        throw new Error("Nora se quedó sin palabras.");
      }

      return response.text;
    } catch (error: any) {
      console.error("Error Nora Chat:", error);
      
      const errorMsg = error?.message || "";
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        return "Ay, mi Karin... acabo de gastar muchas millas corriendo para atenderte y me quedé un poquito sin aire. ✨ Dame un minutito para recuperar el aliento y vuelve a escribirme, ¡aquí sigo contigo! 🧘‍♀️";
      }

      try {
        const fallback = await ai.models.generateContent({
          model: modelName,
          contents: (mood ? `[Radar: ${mood}] ` : "") + message,
          config: { systemInstruction: NORA_SYSTEM_INSTRUCTION }
        });
        return fallback.text || "Ay Karin, me perdí un segundo... ¿qué me decías? ✨";
      } catch (innerError: any) {
        if (errorMsg.includes("API_KEY_INVALID")) {
          return "Ay, mi Karin... parece que mi llave de acceso no es válida. ✨";
        }
        return `Ay, mi cielo, parece que hay un poquito de interferencia en la señal... ¿me lo puedes repetir? Estoy atenta. ✨`;
      }
    }
  }
}
