import Groq from "groq-sdk";
import { ExtractionResult } from "../types";

export const parseScheduleFromImage = async (base64Image: string, apiKey: string): Promise<ExtractionResult> => {
  console.log("[Groq Service] Iniciando servicio con Key provista por usuario.");

  if (!apiKey) {
    throw new Error("Falta la API Key de Groq. Por favor configúrala en la aplicación.");
  }

  const groq = new Groq({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  console.log("[Groq Service] Cliente creado. Enviando petición a modelo...");

  const prompt = `
    ACTÚA COMO UN DIGITALIZADOR DE DATOS EXPERTO.
    Tu misión es extraer CADA UNA de las horas visibles en esta planilla de transporte, SIN OMITIR NINGUNA FILA.
    
    Estructura de salida JSON requerida:
1. 'routeNumber': Número de la ruta(ej: "4", "R-10").
    2. 'planillaNumber': Número de planilla / unidad.
    3. 'headers': Array con los 5 nombres de los encabezados de columna encontrados.
    4. 'grid': Array PLANO(unidimensional) con TODOS los horarios, fila por fila.
       - IMPORTANTE: Debes recorrer la tabla completa de arriba a abajo.
       - Si la tabla tiene muchas filas, extráelas TODAS.No pares a la mitad.
       - Formato de hora: "HH:mm".
       - Si una celda está vacía, usa null.

    No inventes datos, pero intenta corregir errores OCR obvios(ej: 'B' -> '8').
    Responde SOLO con el JSON válido.
  `;

  try {
    const completionPromise = groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 7000,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("La solicitud excedió el tiempo límite de 60 segundos.")), 60000)
    );

    const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

    const jsonStr = completion.choices[0]?.message?.content || "{}";
    console.log("[Groq Service] Respuesta cruda:", jsonStr);
    return JSON.parse(jsonStr) as ExtractionResult;

  } catch (error: any) {
    console.error("Groq Error:", error);
    const msg = error?.message || JSON.stringify(error) || "Error desconocido";
    throw new Error(`Error de Groq: ${msg}. Revisa tu API Key y conexión.`);
  }
};
