/**
 * Server-Sent Events (SSE) stream reading utilities
 */

/**
 * Options for SSE stream reading
 */
export interface SSEReadOptions<T> {
  /**
   * Callback for each parsed SSE message
   */
  onMessage: (data: T) => void;

  /**
   * Optional callback when an error message is received (type: "error")
   * If not provided, errors will throw
   */
  onError?: (message: string) => void;

  /**
   * Whether to throw on JSON parse errors (default: false, ignores partial data)
   */
  throwOnParseError?: boolean;
}

/**
 * Read and parse an SSE stream from a Response object.
 *
 * This function handles the common SSE pattern where:
 * - Messages are prefixed with "data: "
 * - Messages are JSON-encoded
 * - Error messages have a "type: error" field
 *
 * @param response - Fetch Response with SSE body
 * @param options - Configuration options
 * @throws Error if response has no body or if error message received (and no onError handler)
 *
 * @example
 * ```ts
 * const response = await fetch('/api/stream', { method: 'POST', body: ... });
 * await readSSEStream(response, {
 *   onMessage: (data) => {
 *     if (data.type === 'progress') updateProgress(data);
 *     if (data.type === 'complete') setResult(data.result);
 *   },
 * });
 * ```
 */
export async function readSSEStream<T extends { type?: string; message?: string }>(
  response: Response,
  options: SSEReadOptions<T>
): Promise<void> {
  const { onMessage, onError, throwOnParseError = false } = options;

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as T;

            // Handle error messages
            if (data.type === "error" && data.message) {
              if (onError) {
                onError(data.message);
              } else {
                throw new Error(data.message);
              }
              continue;
            }

            onMessage(data);
          } catch (e) {
            if (e instanceof SyntaxError) {
              // JSON parse error - likely partial data
              if (throwOnParseError) throw e;
              continue;
            }
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Simplified SSE stream reader that collects all messages
 *
 * @param response - Fetch Response with SSE body
 * @returns Array of all parsed messages
 */
export async function collectSSEStream<T extends { type?: string; message?: string }>(
  response: Response
): Promise<T[]> {
  const messages: T[] = [];
  await readSSEStream<T>(response, {
    onMessage: (data) => messages.push(data),
  });
  return messages;
}

/**
 * SSE stream reader that separates progress and completion
 *
 * @param response - Fetch Response with SSE body
 * @param onProgress - Callback for progress updates
 * @returns The completion data (message with type: "complete")
 */
export async function readSSEStreamWithProgress<
  TProgress extends { type?: string; message?: string },
  TComplete extends { type: "complete" }
>(
  response: Response,
  onProgress: (data: TProgress) => void
): Promise<TComplete> {
  let result: TComplete | null = null;

  await readSSEStream<TProgress | TComplete | { type: "error"; message: string }>(response, {
    onMessage: (data) => {
      if ("type" in data && data.type === "complete") {
        result = data as TComplete;
      } else {
        onProgress(data as TProgress);
      }
    },
  });

  if (!result) throw new Error("Stream did not complete");
  return result;
}

