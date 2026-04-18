import { GoogleGenAI } from "@google/genai";
import { NORA_SYSTEM_INSTRUCTION } from "../constants";
import { MoodType } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || '' 
});

export class GeminiService {
  static async chat(message: string, history: { role: string; parts: string }[] = [], imageBase64?: string, mood?: MoodType) {
    const modelName = "gemini-3-flash-preview"; 
    
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Llave maestra no encontrada. Por favor revisa la configuración de API Keys.");
      }

      const moodContext = mood ? `[ESTADO DEL RADAR: ${mood.toUpperCase()}] ` : "";
      
      const contents: any[] = [];
      
      // Enforce correct sequence for multi-turn chat
      history.forEach(h => {
        if (h.parts && h.parts.trim()) {
          contents.push({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.parts }]
          });
        }
      });

      // Prepare current message parts
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
      
      // Attempt zero-history fallback
      try {
        const fallback = await ai.models.generateContent({
          model: modelName,
          contents: (mood ? `[Radar: ${mood}] ` : "") + message,
          config: { systemInstruction: NORA_SYSTEM_INSTRUCTION }
        });
        return fallback.text || "Ay Karin, me perdí un segundo... ¿qué me decías? ✨";
      } catch (innerError: any) {
        const errorMsg = error?.message || "Error desconocido";
        if (errorMsg.includes("API_KEY_INVALID")) {
          return "Ay, mi Karin... parece que mi llave de acceso no es válida. ¿Podrías revisar las API Keys en el menú de configuración? ✨";
        }
        return `Ay, mi cielo, parece que hay un poquito de interferencia en la señal (${errorMsg})... ¿me lo puedes repetir? Estoy atenta. ✨`;
      }
    }
  }
}
