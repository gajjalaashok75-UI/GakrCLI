/**
 * Minimal Anthropic-compatible streaming endpoint for panel-agent tests.
 *
 * The real CLI is pointed at this server with `ANTHROPIC_BASE_URL`, so the
 * protocol tested is the CLI's actual print/stream-json path — no model calls,
 * no credentials, no network.
 */

export type FakeReply = {
  text?: string;
  toolUse?: { name: string; input: Record<string, unknown> };
  stopReason?: string;
  /** Delay before the response starts; used to test mid-stream cancel. */
  delayMs?: number;
};

type RecordedRequest = Record<string, unknown>;

export class FakeAnthropic {
  readonly requests: RecordedRequest[] = [];
  private readonly replies: FakeReply[];
  private readonly server: ReturnType<typeof Bun.serve>;
  private toolCallCount = 0;

  constructor(replies: FakeReply[] = []) {
    this.replies = [...replies];
    this.server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: async request => this.handle(request),
    });
  }

  get url(): string {
    return `http://127.0.0.1:${this.server.port}`;
  }

  push(reply: FakeReply): void {
    this.replies.push(reply);
  }

  close(): void {
    this.server.stop(true);
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.endsWith('/v1/messages')) {
      return new Response('not found', { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as RecordedRequest;
    this.requests.push(body);

    const reply = this.replies.shift() ?? { text: 'ok' };
    if (reply.delayMs) {
      await new Promise(resolve => setTimeout(resolve, reply.delayMs));
    }

    const stopReason =
      reply.stopReason ?? (reply.toolUse ? 'tool_use' : 'end_turn');
    const chunks: string[] = [];
    const send = (event: string, data: unknown) => {
      chunks.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('message_start', {
      type: 'message_start',
      message: {
        id: `msg_fake_${this.requests.length}`,
        type: 'message',
        role: 'assistant',
        model: 'fake-model',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 1 },
      },
    });

    if (reply.text !== undefined) {
      send('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      });
      send('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: reply.text },
      });
      send('content_block_stop', {
        type: 'content_block_stop',
        index: 0,
      });
    }

    if (reply.toolUse) {
      const index = reply.text !== undefined ? 1 : 0;
      const toolUseId = `toolu_fake_${++this.toolCallCount}`;
      send('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: toolUseId,
          name: reply.toolUse.name,
          input: {},
        },
      });
      send('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(reply.toolUse.input),
        },
      });
      send('content_block_stop', {
        type: 'content_block_stop',
        index,
      });
    }

    send('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 7 },
    });
    send('message_stop', { type: 'message_stop' });

    return new Response(chunks.join(''), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
