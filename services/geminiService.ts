import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const repairJsonWithAi = async (malformedJson: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a strict JSON fixer. Fix the following text into valid JSON. 
      - If it is a JavaScript object (keys without quotes), quote them.
      - Remove trailing commas.
      - Return ONLY the raw JSON string, no markdown code blocks, no explanation.
      
      Input:
      ${malformedJson}`,
    });
    
    let text = response.text || "{}";
    // Remove markdown if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return text;
  } catch (error) {
    console.error("AI Repair Error:", error);
    throw error;
  }
};

export const generateMongooseSchemaWithAi = async (jsonStructure: string, prompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a Mongoose Schema expert. 
      Generate a Mongoose Schema based on the provided JSON data.
      
      User Instructions: ${prompt}
      
      JSON Data:
      ${jsonStructure}
      
      Output Rules:
      - Return valid JavaScript/TypeScript code defining the schema.
      - Use 'new mongoose.Schema({...})'.
      - Include types, required validations, and other standard Mongoose options where inferred or requested.
      - Do not include imports or 'mongoose.model' calls, just the Schema definition object or the 'const schema = ...' block.
      - Return ONLY the code, no markdown.
      `,
    });
    
    let text = response.text || "";
    text = text.replace(/```javascript/g, '').replace(/```typescript/g, '').replace(/```/g, '').trim();
    return text;
  } catch (error) {
    console.error("AI Schema Gen Error:", error);
    throw error;
  }
};