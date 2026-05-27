import { useState, useEffect, useMemo } from 'react';

export interface SlashCommandDef {
  name: string;
  description: string;
  argumentHint: string;
}

interface UseSlashCommandsReturn {
  commands: SlashCommandDef[];
  filteredCommands: (query: string) => SlashCommandDef[];
  isLoaded: boolean;
}

/** GakrCLI-specific commands that are always available */
const GAKRCLI_COMMANDS: SlashCommandDef[] = [
  { name: 'provider', description: 'Set up and save a third-party provider profile', argumentHint: '' },
  { name: 'providers', description: 'Set up and save a third-party provider profile', argumentHint: '' },
];

/** Merge GakrCLI-specific commands into the list (avoiding duplicates) */
function mergeGakrCLICommands(cmds: SlashCommandDef[]): SlashCommandDef[] {
  const byName = new Map<string, SlashCommandDef>();
  for (const command of cmds) {
    const name = command.name.trim().replace(/^\//, '');
    if (!name || byName.has(name)) {
      continue;
    }
    byName.set(name, { ...command, name });
  }

  for (const command of GAKRCLI_COMMANDS) {
    if (!byName.has(command.name)) {
      byName.set(command.name, command);
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Hook for slash command menu. Listens for the command list from the
 * initialize response (sent by extension host as `slash_commands_available`).
 */
export function useSlashCommands(): UseSlashCommandsReturn {
  const [commands, setCommands] = useState<SlashCommandDef[]>(mergeGakrCLICommands([]));
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'slash_commands_available') {
        const hostCommands = normalizeCommands(message.commands);
        setCommands(mergeGakrCLICommands(hostCommands));
        setIsLoaded(true);
      }
      // Also extract slash_commands from system/init message
      // Note: system/init has slash_commands as string[] (names only)
      // Full command objects come via slash_commands_available from the initialize response
      if (message.type === 'cli_output') {
        const data = message.data as Record<string, unknown> | undefined;
        if (data?.type === 'system' && data.subtype === 'init' && Array.isArray(data.slash_commands)) {
          setCommands((current) => {
            const hasOnlyBuiltins = current.every((cmd) =>
              GAKRCLI_COMMANDS.some((builtin) => builtin.name === cmd.name),
            );
            if (!hasOnlyBuiltins) return current;
            const cmds = normalizeCommands(data.slash_commands);
            if (cmds.length > 0) {
              setIsLoaded(true);
              return mergeGakrCLICommands(cmds);
            }
            return current;
          });
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const filteredCommands = useMemo(() => {
    return (query: string): SlashCommandDef[] => {
      if (!query) return commands;

      // Strip leading / if present
      const q = (query.startsWith('/') ? query.slice(1) : query).trim().toLowerCase();
      const prefixMatches = commands.filter((cmd) => cmd.name.toLowerCase().startsWith(q));
      const includesMatches = commands.filter((cmd) =>
        !prefixMatches.includes(cmd) && cmd.name.toLowerCase().includes(q),
      );
      return [...prefixMatches, ...includesMatches].slice(0, 50);
    };
  }, [commands]);

  return { commands, filteredCommands, isLoaded };
}

function normalizeCommands(value: unknown): SlashCommandDef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((command): SlashCommandDef => {
      if (typeof command === 'string') {
        return {
          name: command.replace(/^\//, ''),
          description: '',
          argumentHint: '',
        };
      }

      if (command && typeof command === 'object') {
        const record = command as Record<string, unknown>;
        return {
          name: String(record.name ?? record.command ?? '').replace(/^\//, ''),
          description: String(record.description ?? ''),
          argumentHint: String(record.argument_hint ?? record.argumentHint ?? ''),
        };
      }

      return { name: '', description: '', argumentHint: '' };
    })
    .filter((command) => command.name);
}
