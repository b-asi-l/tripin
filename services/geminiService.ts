import { GoogleGenAI, Type } from "@google/genai";
import { VehicleType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTripDescription = async (from: string, to: string, vehicle: VehicleType): Promise<string> => {
  try {
    const prompt = `Write a short, fun, 1-sentence catchy description for a carpooling ride from ${from} to ${to} in a ${vehicle}. Do not include quotes.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return `Enjoy a comfortable ${vehicle} ride from ${from} to ${to}!`;
  }
};

export const suggestTripPrice = async (from: string, to: string, vehicle: VehicleType): Promise<number> => {
  try {
    const prompt = `Estimate a fair pooling price in Indian Rupees (INR) for a ${vehicle} sharing ride from ${from} to ${to} in Kerala. Return only a JSON object with a single field 'price' containing the number.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER }
          }
        }
      }
    });

    const json = JSON.parse(response.text);
    return json.price || 150;
  } catch (error) {
    console.error("Gemini Error:", error);
    return vehicle === VehicleType.BIKE ? 80 : 150;
  }
};