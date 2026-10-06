/**
 * GakrCLI-in-Chrome agent server.
 *
 * Chrome extensions cannot open sockets to local processes, so the only path
 * from the side panel into the CLI runs through a native messaging host that
 * Chrome spawns. That host reads the port published here and hands it to the
 * extension via `SERVER_STARTED`.
 *
 * This process owns the agent. The Chrome-spawned host owns the pipe to the
 * extension. Neither starts the other.
 */

import { DEFAULT_SERVER_PORT } from './contract.js'
import { AgentServer } from './httpServer.js'
import { callExtensionTool } from '../chromeNativeHostClient.js'
import { clearPublishedPort, publishPort } from './portFile.js'

/**
 * Start the agent server and run until interrupted.
 *
 * Falls back to an ephemeral port when the default is taken: a second Chrome
 * profile or a stale listener should degrade to "still works on another port"
 * rather than refusing to start. The extension is told the real port via
 * `SERVER_STARTED` either way, so it does not need to be 12306.
 */
export async function runChromeAgentServer(): Promise<void> {
  const server = new AgentServer((name, args) => callExtensionTool(name, args))

  let port: number
  try {
    port = await server.listen(DEFAULT_SERVER_PORT)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EADDRINUSE') {
      throw error
    }
    port = await server.listen(0)
  }

  await publishPort(port)

  // biome-ignore lint/suspicious/noConsole: this is a foreground CLI process
  console.log(
    `GakrCLI in Chrome agent server listening on http://127.0.0.1:${port}`,
  )

  await new Promise<void>(resolvePromise => {
    const shutdown = (): void => {
      void server
        .close()
        .finally(() => clearPublishedPort().finally(resolvePromise))
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}