import DocsLayout from '../../components/DocsLayout'
import { skills } from '../../data/skills'
import CopyCommand from '../../components/CopyCommand'
import { SITE } from '../../data/site'

const toc = [
  { id: 'built-in', label: 'built-in skills' },
  { id: 'create', label: 'create your own' },
]

export default function Skills() {
  return (
    <DocsLayout
      title="gakrcli skills — extend the agent"
      description="Use and create gakrcli skills: reusable prompts that give the agent specialized capabilities — batch execution, debugging, configuration, and more."
      heading="skills"
      lede="Skills are reusable prompts that give the agent specialized capabilities. Use built-in skills or write your own."
      toc={toc}
    >
      <h2 id="built-in">built-in skills</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">invocation</th>
              <th scope="col">description</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(s => (
              <tr key={s.name}>
                <td><code>{s.invocation}</code></td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="create">create your own</h2>
      <p>Skills live in <code>~/.gakrcli/skills/</code>. Each skill is a markdown file with frontmatter that tells gakrcli how to invoke it:</p>
      <pre><code>{`---
name: my-skill
description: A short description shown in /skills
---

Write your prompt here. The agent will execute this
when the skill is invoked.`}</code></pre>
      <p>Create a new skill with a single command:</p>
      <CopyCommand command="gakrcli --execute 'create a skill at ~/.gakrcli/skills/review-pr.md that reviews pull requests for common mistakes'" />
      <p style={{ marginTop: 16 }}>Skills support <a href={SITE.github} rel="noopener">MCP tools</a> and can use the full agent toolchain — Bash, Read, Edit, Grep, Glob, and any connected MCP servers.</p>
    </DocsLayout>
  )
}
