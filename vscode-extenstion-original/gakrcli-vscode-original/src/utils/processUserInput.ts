/**
 * Utility for processing user input from various sources
 */

/**
 * Get input prompt from either the provided prompt string or stdin
 * @param prompt - The prompt string provided via CLI argument
 * @param format - The input format: 'text' or 'stream-json'
 * @returns The processed input prompt
 */
export async function getInputPrompt(
  prompt: string,
  format: 'text' | 'stream-json'
): Promise<string> {
  // If prompt is provided, use it directly
  if (prompt) {
    return prompt;
  }

  // If no prompt provided and stdin is not a TTY, read from stdin
  if (!process.stdin.isTTY) {
    return readFromStdin(format);
  }

  // No prompt and stdin is TTY - return empty string
  return '';
}

/**
 * Read input from stdin
 * @param format - The input format
 * @returns Promise that resolves with the stdin content
 */
async function readFromStdin(format: 'text' | 'stream-json'): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      const content = Buffer.concat(chunks).toString('utf8');
      resolve(content);
    });

    process.stdin.on('error', (error: Error) => {
      reject(error);
    });

    // Resume stdin to start reading
    process.stdin.resume();
  });
}
