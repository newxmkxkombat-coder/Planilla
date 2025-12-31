
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

export const parseScheduleFromImage = async (base64Image: string): Promise<ExtractionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analiza esta imagen de una planilla de horarios de transporte.
    Busca y extrae con máxima prioridad:
    1. 'routeNumber': El número de la ruta (suele decir RUTA o estar en un círculo/esquina).
    2. 'planillaNumber': El número de la planilla (ID único).
    3. 'headers': Los 5 nombres de los puntos de control (ej: P19C, P25, P55...).
    4. 'grid': Los horarios en formato HH:mm en una lista plana de 5 columnas.
    IMPORTANTE: Si un horario está incompleto o borroso, intenta deducirlo. Si la celda está vacía, usa null.
    Responde estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routeNumber: { type: Type.STRING },
            planillaNumber: { type: Type.STRING },
            headers: { type: Type.ARRAY, items: { type: Type.STRING } },
            grid: { type: Type.ARRAY, items: { type: Type.STRING, nullable: true } }
          },
          required: ["routeNumber", "planillaNumber", "headers", "grid"]
        }
      }
    });

    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr) as ExtractionResult;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("No se pudo leer la planilla. Asegúrate de que los números de Ruta y Planilla sean visibles.");
  }
};
