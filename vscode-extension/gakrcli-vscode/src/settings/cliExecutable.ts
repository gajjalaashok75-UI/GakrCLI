import type * as vscode from 'vscode';

export const DEFAULT_CLI_EXECUTABLE = 'gakrcli';

type ConfigLike = Pick<vscode.WorkspaceConfiguration, 'get'>;

export function resolveCliExecutable(config: ConfigLike): string {
  const wrapper = config.get<string>('gakrcliProcessWrapper', '')?.trim();
  return wrapper || DEFAULT_CLI_EXECUTABLE;
}
