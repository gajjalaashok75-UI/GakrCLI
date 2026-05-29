# Contributing to GakrCLI

Thanks for contributing to GakrCLI!

GakrCLI is a terminal-first AI coding agent built with TypeScript that brings powerful LLM workflows to your command line. It runs on Node.js 20+ and uses Bun for development and building. The project supports 10+ LLM providers, MCP integration, agent workflows, and a comprehensive plugin system. The best contributions are focused, well-tested, and easy to review.

For user-facing documentation, see [README.md](README.md). For security reports, see [SECURITY.md](SECURITY.md).

## Before You Start

- Search existing [issues](https://github.com/gajjalaashok75-UI/GakrCLI/issues) and [discussions](https://github.com/gajjalaashok75-UI/GakrCLI/discussions) before opening a new thread.
- Use issues for confirmed bugs and actionable feature work.
- Use discussions for setup help, ideas, and general community conversation.
- For larger changes, open an issue first so the scope is clear before implementation.
- For security reports, follow [SECURITY.md](SECURITY.md).

## Local Setup

**Requirements:** 
- Node.js 20 or newer
- Bun 1.3.11+ (for development and building)
- ripgrep (`rg`) installed and in PATH

Install dependencies:

```bash
bun install
```

Build the CLI (output: `dist/cli.mjs`):

```bash
bun run build
```

Smoke test:

```bash
bun run smoke
```

Run the app locally:

```bash
bun run dev
```

Type checking (recommended before opening a PR):

```bash
bun run typecheck
```

Run tests:

```bash
bun test
```

If you are working on provider setup or saved profiles, test with:

```bash
bun run doctor:runtime
bun run dev:profile
```

## Development Workflow

- Keep PRs focused on one problem or feature.
- Avoid mixing unrelated cleanup into the same change.
- Preserve existing repo patterns unless the change is intentionally refactoring them.
- Add or update tests when the change affects behavior.
- Update docs when setup, commands, or user-facing behavior changes.
- The binary name is `gakrcli` and the package name is `@gakr-gakr/gakrcli`.

## Project Structure

```
gakrcli/
├── src/
│   ├── entrypoints/     # CLI entry points
│   ├── tools/           # Tool implementations (30+ tools)
│   ├── skills/          # Skill definitions (100+ skills)
│   ├── agents/          # Agent definitions (20+ agents)
│   ├── services/        # Provider integrations and services
│   ├── plugins/         # Plugin system infrastructure
│   ├── integrations/    # Provider and model integrations
│   ├── components/      # React UI components (Ink-based)
│   └── utils/           # Utility functions and helpers
├── assets/              # Bundled assets (skills, agents, rules)
├── docs/                # Documentation
└── dist/                # Built output
```

## Validation

At minimum, run the most relevant checks for your change.

Common checks:

```bash
bun run build
bun run typecheck
bun run smoke
bun run verify:privacy  # Verify no telemetry/phone-home
```

Focused tests:

```bash
bun test ./path/to/test-file.test.ts
```

Full test suite:

```bash
bun test
```

When working on provider/runtime setup:

```bash
bun run doctor:runtime
bun run doctor:runtime:json  # JSON output for automation
```

## Pull Requests

Good PRs usually include:

- A clear title describing what changed
- A description explaining why it changed
- The user or developer impact
- The exact checks you ran
- Screenshots for UI/terminal changes
- Provider testing details if applicable

### PR Template

GitHub pre-fills new PRs from [.github/pull_request_template.md](.github/pull_request_template.md). Use that structure and add extra context when a change affects provider behavior, security, terminal UI, or package/runtime setup.

## Code Style

- Follow the existing code style in the touched files.
- Use TypeScript for type safety and better developer experience.
- Prefer small, readable changes over broad rewrites.
- Do not reformat unrelated files just because they are nearby.
- Keep comments useful and concise.
- Use meaningful variable and function names.

## Provider Changes

GakrCLI supports 10+ LLM providers. If you change provider logic:

- Be explicit about which providers are affected
- Avoid breaking third-party providers while fixing first-party behavior
- Test the exact provider/model path you changed when possible
- Call out any limitations or follow-up work in the PR description
- Update provider documentation if needed

### Supported Providers
- Anthropic (Claude)
- OpenAI and OpenAI-compatible
- Google Gemini
- GitHub Models
- NVIDIA NIMs
- DeepSeek
- Ollama (local)
- Atomic Chat (local)
- Azure OpenAI
- AWS Bedrock
- Google Vertex AI

## Tool Development

When adding or modifying tools:

- Follow the existing tool interface patterns
- Add comprehensive error handling
- Include input validation and sanitization
- Add tests for both success and error cases
- Update tool documentation
- Consider security implications (sandboxing, permissions)

## Skill Development

When adding or modifying skills:

- Place skills in appropriate category directories under `assets/skills/`
- Include comprehensive `SKILL.md` documentation
- Add clear usage examples and when-to-use guidance
- Test skills with multiple providers when possible
- Consider skill dependencies and requirements

## Agent Development

When adding or modifying agents:

- Place agent definitions in `assets/agents/`
- Include clear role definitions and capabilities
- Add usage examples and workflow descriptions
- Test agent routing and model compatibility
- Document any special requirements or limitations

## MCP Integration

When working with MCP (Model Context Protocol):

- Follow MCP specification standards
- Add proper error handling for MCP server failures
- Include authentication and authorization checks
- Test with multiple MCP servers when possible
- Update MCP documentation as needed

## Documentation

When updating documentation:

- Keep language clear and concise
- Include practical examples
- Update version numbers and feature lists
- Test installation and setup instructions
- Consider both technical and non-technical users

## Testing

We use Bun's built-in test runner. When writing tests:

- Place tests next to the code they test (`.test.ts` files)
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies appropriately
- Aim for good coverage of critical paths

### Test Categories
- **Unit tests**: Individual functions and components
- **Integration tests**: Provider integrations and tool workflows
- **End-to-end tests**: Full CLI workflows and user scenarios

## Security

When working on security-sensitive code:

- Follow secure coding practices
- Validate all user inputs
- Use proper authentication and authorization
- Avoid storing secrets in plaintext
- Consider sandboxing and permission systems
- Report security issues via [SECURITY.md](SECURITY.md)

## Performance

When optimizing performance:

- Profile before optimizing
- Focus on user-visible improvements
- Consider memory usage and startup time
- Test with large codebases and long conversations
- Document performance characteristics

## Community

Please be respectful and constructive with other contributors.

Maintainers may ask for:

- Narrower scope or focused follow-up PRs
- Stronger validation and testing
- Documentation updates for behavior changes
- Security review for sensitive changes
- Performance testing for optimization work

This is normal and helps keep the project maintainable as it grows.

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/gajjalaashok75-UI/GakrCLI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gajjalaashok75-UI/GakrCLI/discussions)
- **Documentation**: [docs/](docs/)

Thank you for contributing to GakrCLI!
