import { registerBundledSkill } from '../bundledSkills.js'

// Prompt text contains `ps` commands as instructions for Gakr to run,
// not commands this file executes.
// eslint-disable-next-line custom-rules/no-direct-ps-commands
const STUCK_PROMPT = `# /stuck - diagnose frozen/slow Gakr sessions

The user thinks another Gakr session on this machine is frozen, stuck, or very slow. Investigate locally and report the findings in the chat.

## What to look for

Scan for other Gakr processes, excluding the current one. PID is in \`process.pid\`, but for shell commands just exclude the PID you see running this prompt. Process names are typically \`gakrcli\` for installed builds or \`cli\` for native dev builds.

Signs of a stuck session:
- **High CPU (>=90%) sustained** - likely an infinite loop. Sample twice, 1-2 seconds apart, to confirm it is not a transient spike.
- **Process state \`D\` (uninterruptible sleep)** - often an I/O hang. The \`state\` column in \`ps\` output matters; first character matters.
- **Process state \`T\` (stopped)** - user probably hit Ctrl+Z by accident.
- **Process state \`Z\` (zombie)** - parent is not reaping.
- **Very high RSS (>=4GB)** - possible memory leak making the session sluggish.
- **Stuck child process** - a hung \`git\`, \`node\`, or shell subprocess can freeze the parent. Check \`pgrep -lP <pid>\` for each session.

## Investigation steps

1. **List all Gakr processes** on macOS/Linux:
   \`\`\`
   ps -axo pid=,pcpu=,rss=,etime=,state=,comm=,command= | grep -E '(gakrcli|cli)' | grep -v grep
   \`\`\`
   Filter to rows where \`comm\` is \`gakrcli\` or where \`comm\` is \`cli\` and the command path contains "gakrcli".

2. **For anything suspicious**, gather more context:
   - Child processes: \`pgrep -lP <pid>\`
   - If high CPU: sample again after 1-2 seconds to confirm it is sustained.
   - If a child looks hung, note its full command line with \`ps -p <child_pid> -o command=\`.
   - Check the session debug log if you can infer the session ID: \`~/.gakrcli/debug/<session-id>.txt\`.

3. **Consider a stack dump** for a truly frozen process:
   - macOS: \`sample <pid> 3\` gives a 3-second native stack sample.
   - This is big; only grab it if the process is clearly hung and you need to know why.

## Report

If every session looks healthy, tell the user that directly. If you found a stuck or slow session, summarize the evidence and the likely cause.

Use a concise report:

1. **Summary** - one short line: hostname, Gakr version, and a terse symptom.
2. **Details** - include PID, CPU%, RSS, state, uptime, command line, child processes, diagnosis, and relevant debug log tail or sample output.

## Notes

- Do not kill or signal any processes. This is diagnostic only.
- If the user gave an argument, such as a specific PID or symptom, focus there first.
`

export function registerStuckSkill(): void {
  registerBundledSkill({
    name: 'stuck',
    description:
      'Investigate frozen/stuck/slow Gakr sessions on this machine and report local diagnostics.',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = STUCK_PROMPT
      if (args) {
        prompt += `\n## User-provided context\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
