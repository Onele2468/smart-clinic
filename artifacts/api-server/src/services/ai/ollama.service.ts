const OLLAMA_URL = `${process.env.OLLAMA_URL}/api/generate`;

const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

export interface OllamaRequest {
  model: string;
  prompt: string;
}

export interface OllamaResponse {
  response: string;
}

export async function generateWithOllama(
  prompt: string,
): Promise<OllamaResponse> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    response: string;
  };

  return {
    response: data.response,
  };
}