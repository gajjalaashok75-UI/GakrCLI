import { describe, expect, it } from 'vitest';
import {
  filterSlashCommands,
  mergeGakrCLICommands,
  normalizeCommands,
} from '../../webview/src/hooks/useSlashCommands';

describe('webview slash command filtering', () => {
  it('normalizes command shapes and deduplicates by command name', () => {
    const commands = mergeGakrCLICommands(normalizeCommands([
      '/surprise-me',
      { name: 'surprise-me', description: 'duplicate should be ignored' },
      { command: '/product-buyer', description: 'product workflow' },
    ]));

    expect(commands.filter((command) => command.name === 'surprise-me')).toHaveLength(1);
    expect(commands.some((command) => command.name === 'provider')).toBe(true);
    expect(commands.some((command) => command.name === 'providers')).toBe(true);
    expect(commands.some((command) => command.name === 'product-buyer')).toBe(true);
  });

  it('matches only command names by prefix, not description text', () => {
    const commands = mergeGakrCLICommands([
      { name: 'tailwind-design-system', description: 'Build production design tokens', argumentHint: '' },
      { name: 'news-scout', description: 'Find product and market updates', argumentHint: '' },
      { name: 'product-buyer', description: 'Create buying guide', argumentHint: '' },
    ]);

    expect(filterSlashCommands(commands, '/prod').map((command) => command.name)).toEqual([
      'product-buyer',
    ]);
    expect(filterSlashCommands(commands, '/market')).toEqual([]);
    expect(filterSlashCommands(commands, '/missing')).toEqual([]);
  });
});
