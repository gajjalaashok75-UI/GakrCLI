# Security Policy

## Supported Versions

GakrCLI is currently maintained on the latest `main` branch and the latest npm release only.

| Version | Supported |
| ------- | --------- |
| Latest release (0.5.2+) | :white_check_mark: |
| Older releases | :x: |
| Unreleased forks / modified builds | :x: |

Security fixes are generally released in the next patch version and may also be landed directly on `main` before a package release is published.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in GakrCLI, please report it privately.

**Preferred reporting channels:**

- GitHub Security Advisories / private vulnerability reporting for this repository
- Email: security@gakrcli.dev (if available)

**Please include:**

- A clear description of the issue
- Affected version, commit, or environment
- Reproduction steps or a proof of concept
- Impact assessment (data exposure, code execution, etc.)
- Any suggested remediation, if available
- Your preferred contact method for follow-up

**Please do NOT:**
- Open a public issue for an unpatched vulnerability
- Share vulnerability details in discussions or social media
- Attempt to exploit the vulnerability beyond proof of concept

## Response Process

Our general goals are:

- **Initial triage acknowledgment**: Within 7 days
- **Follow-up after validation**: When we can reproduce the issue
- **Coordinated disclosure**: After a fix is available and tested

Severity, exploitability, and maintenance bandwidth may affect timelines.

### Severity Classification

We use the following severity levels:

- **Critical**: Remote code execution, privilege escalation, or data breach
- **High**: Significant security impact with clear exploitation path
- **Medium**: Security weakness with limited impact or difficult exploitation
- **Low**: Minor security issues or theoretical vulnerabilities

## Disclosure and CVEs

Valid reports may be fixed privately first and disclosed after a patch is available.

If a report is accepted and the issue is significant enough to warrant formal tracking, we may:

- Publish a GitHub Security Advisory
- Request or assign a CVE through the appropriate channel
- Coordinate with package registries for security notifications

CVE issuance is not guaranteed for every report but will be considered for issues with significant impact.

## Scope

This policy applies to:

- The GakrCLI source code in this repository
- Official release artifacts published from this repository
- The `@gakr-gakr/gakrcli` npm package
- Official documentation and setup guides

### In Scope Security Issues

- **Code execution vulnerabilities**: Command injection, unsafe deserialization
- **Authentication bypasses**: API key leakage, credential theft
- **Data exposure**: Unintended file access, sensitive information disclosure
- **Privilege escalation**: Sandbox escapes, permission bypasses
- **Denial of service**: Resource exhaustion, infinite loops
- **Cryptographic issues**: Weak encryption, insecure random generation
- **Input validation**: Path traversal, injection attacks
- **MCP security**: Malicious MCP server exploitation
- **Plugin security**: Unsafe plugin loading or execution

### Out of Scope

This policy does not cover:

- **Third-party services**: Model providers, endpoints, or hosted services
- **Local misconfiguration**: User environment setup issues
- **Unofficial distributions**: Forks, mirrors, or downstream repackages
- **Social engineering**: Phishing or user deception attacks
- **Physical access**: Issues requiring local machine access
- **Dependency vulnerabilities**: Issues in npm packages (report to respective maintainers)
- **Rate limiting**: API quota exhaustion or billing issues
- **Feature requests**: Non-security functionality requests

## Security Best Practices

### For Users

- **Keep GakrCLI updated** to the latest version
- **Secure your API keys** and use environment variables
- **Review MCP servers** before installation
- **Use sandboxing** and permission controls
- **Avoid untrusted plugins** from unknown sources
- **Monitor file access** in sensitive directories
- **Use project profiles** to limit scope per project

### For Developers

- **Validate all inputs** from users, files, and external services
- **Use secure defaults** for permissions and access controls
- **Sanitize file paths** to prevent directory traversal
- **Implement proper authentication** for MCP servers
- **Follow secure coding practices** for shell command execution
- **Test security controls** with automated and manual testing
- **Review third-party dependencies** for known vulnerabilities

## Privacy and Data Handling

GakrCLI is designed with privacy in mind:

- **No telemetry**: No usage data is collected or transmitted
- **Local processing**: Most operations happen locally
- **Secure storage**: API keys stored using OS credential managers
- **Minimal data sharing**: Only necessary data sent to LLM providers
- **User control**: Users control what data is shared and when

## Security Features

GakrCLI includes several security features:

- **Sandboxed execution**: Shell commands run in controlled environments
- **Permission system**: Granular control over tool access
- **Credential management**: Secure storage of API keys and tokens
- **Input validation**: Sanitization of user inputs and file paths
- **MCP authentication**: Secure authentication for MCP servers
- **Plugin isolation**: Safe loading and execution of plugins

## Acknowledgments

We appreciate security researchers and users who help improve GakrCLI's security. Valid vulnerability reports may be acknowledged in release notes (with reporter's permission).

## Contact

For security-related questions or concerns:

- Security reports: Use GitHub Security Advisories
- General security questions: Open a discussion in the repository
- Documentation: See [CONTRIBUTING.md](CONTRIBUTING.md) for development security practices

Thank you for helping keep GakrCLI secure!
