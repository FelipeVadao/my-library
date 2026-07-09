import { generateText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { GEMINI_MODEL, LIBRARY_ASSISTANT_SYSTEM_PROMPT } from './config';
import { describeGatewayError } from './errors';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LibraryAssistantAnswer {
  answer: string | null;
  error: string | null;
}

// Bounds tool-call steps: without stopWhen, generateText defaults to
// stopping right after a tool call, with no synthesized final answer.
const MAX_STEPS = 5;

// The only function in the app that talks to the AI Gateway for chat — a
// future provider swap only touches this file and ./config.ts.
export async function answerLibraryQuestion(
  question: string,
  libraryContext: string,
  history: ChatMessage[] = [],
  tools?: ToolSet
): Promise<LibraryAssistantAnswer> {
  try {
    const result = await generateText({
      model: GEMINI_MODEL,
      instructions: `${LIBRARY_ASSISTANT_SYSTEM_PROMPT}\n\n${libraryContext}`,
      messages: [...history, { role: 'user', content: question }] as ModelMessage[],
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
    return { answer: result.text, error: null };
  } catch (err) {
    return { answer: null, error: describeGatewayError(err, 'Não foi possível obter uma resposta da IA.') };
  }
}
