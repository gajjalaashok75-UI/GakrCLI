import type * as vscode from 'vscode';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const DEFAULT_CLI_EXECUTABLE = 'gakrcli';

type ConfigLike = Pick<vscode.WorkspaceConfiguration, 'get'>;

export interface CliLaunchCommand {
  executable: string;
  args: string[];
  displayCommand: string;
}

export interface CliLaunchResolveOptions {
  workspaceFolder?: string;
  extensionPath?: string;
  sourceRoot?: string;
}

export function resolveCliExecutable(config: ConfigLike): string {
  return resolveCliLaunchCommand(config).executable;
}

export function resolveCliLaunchCommand(
  config: ConfigLike,
  workspaceOrOptions?: string | CliLaunchResolveOptions,
): CliLaunchCommand {
  const options = normalizeResolveOptions(workspaceOrOptions);
  const candidateRoots = getCandidateSourceRoots(options);
  const wrapper = config.get<string>('processWrapper', '')?.trim();
  if (wrapper) {
    const parsed = parseCommandLine(wrapper);
    const args = resolveWrapperArgs(parsed.args, candidateRoots);
    return {
      executable: parsed.executable,
      args,
      displayCommand: [parsed.executable, ...args].map(quoteShellToken).join(' '),
    };
  }

  const localCli = candidateRoots
    .map((root) => resolveLocalSourceCli(root))
    .find((cli): cli is string => Boolean(cli));
  if (localCli) {
    return {
      executable: 'node',
      args: [localCli],
      displayCommand: ['node', localCli].map(quoteShellToken).join(' '),
    };
  }

  return {
    executable: DEFAULT_CLI_EXECUTABLE,
    args: [],
    displayCommand: DEFAULT_CLI_EXECUTABLE,
  };
}

export function resolveSourceRootFromExtensionPath(
  extensionPath: string | undefined,
): string | undefined {
  if (!extensionPath) {
    return undefined;
  }

  // Extension development runs from <repo>/vscode-extension/gakrcli-vscode.
  // Marketplace installs do not contain the root CLI source, so this simply
  // falls through to the user/global `gakrcli` binary there.
  const candidates = [
    resolve(extensionPath, '..', '..'),
    extensionPath,
  ];

  return candidates.find((candidate) => Boolean(resolveLocalSourceCli(candidate)));
}

function normalizeResolveOptions(
  workspaceOrOptions: string | CliLaunchResolveOptions | undefined,
): CliLaunchResolveOptions {
  if (typeof workspaceOrOptions === 'string') {
    return { workspaceFolder: workspaceOrOptions };
  }
  return workspaceOrOptions ?? {};
}

function getCandidateSourceRoots(options: CliLaunchResolveOptions): string[] {
  const roots = [
    options.workspaceFolder,
    options.sourceRoot,
    resolveSourceRootFromExtensionPath(options.extensionPath),
  ].filter((root): root is string => Boolean(root));

  return Array.from(new Set(roots.map((root) => resolve(root))));
}

function resolveLocalSourceCli(workspaceFolder: string): string | undefined {
  const packageJsonPath = join(workspaceFolder, 'package.json');
  const cliPath = join(workspaceFolder, 'dist', 'cli.mjs');
  if (!existsSync(packageJsonPath) || !existsSync(cliPath)) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name?: string;
      bin?: Record<string, string>;
    };
    if (
      packageJson.name === '@gakr-gakr/gakrcli' &&
      packageJson.bin?.gakrcli === 'bin/gakrcli'
    ) {
      return cliPath;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function resolveWrapperArgs(args: string[], candidateRoots: string[]): string[] {
  return args.map((arg) => resolveWrapperArg(arg, candidateRoots));
}

function resolveWrapperArg(arg: string, candidateRoots: string[]): string {
  if (isAbsolute(arg) || arg.startsWith('-')) {
    return arg;
  }

  if (!isKnownCliEntrypointArg(arg)) {
    return arg;
  }

  for (const root of candidateRoots) {
    const candidate = resolve(root, arg);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return arg;
}

function isKnownCliEntrypointArg(arg: string): boolean {
  const normalized = arg.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized === 'dist/cli.mjs' || normalized === 'bin/gakrcli';
}

function parseCommandLine(commandLine: string): CliLaunchCommand {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i]!;
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  const [executable = DEFAULT_CLI_EXECUTABLE, ...args] = tokens;
  return {
    executable,
    args,
    displayCommand: tokens.map(quoteShellToken).join(' '),
  };
}

function quoteShellToken(value: string): string {
  if (!value) return '""';
  if (!/[\s"'&()<>^|]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
