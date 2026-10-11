import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from '../../ink.js';
import { Dialog } from '../../ink.js';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { logForDebugging } from '../../utils/debug.js';
import {
  getSkillSearchMode,
  setSkillSearchMode,
  type SkillSearchMode,
} from '../../services/skillSearch/featureCheck.js';

type SkillSearchAction = {
  label: string;
  description: string;
  run: () => Promise<string>;
};

const ACTION_LABEL_COLUMN_WIDTH = 28;

const ABOUT_TEXT = `# Skill Search (自动技能匹配)

Skill Search 使用确定性的关键字触发匹配（OpenHands 风格）在对话中查找相关 skill。
每个 skill 通过其 frontmatter 的 triggers: 关键字（以及 skill 名称本身）被触发，
匹配基于整个词（whole-token），大小写不敏感。

## 工作原理
1. 对话开始时，索引 .gakrcli/skills/ 和 ~/.gakrcli/skills/ 下的 skill 文件
2. 每轮对话根据用户输入，按触发关键字进行确定性匹配
3. 匹配到的 skill 会作为建议展示；在 hybrid 模式下，其内容会自动注入上下文

## 模式
- normal — 匹配后仅展示相关 skill 建议，不自动注入内容
- hybrid — 匹配后自动将 skill 指令注入上下文
- off    — 关闭自动技能匹配

## 控制方式
- /skill-search normal — 仅建议
- /skill-search hybrid — 自动注入
- /skill-search stop   — 关闭
- /skill-search status — 查看当前状态

当前模式: ${getSkillSearchMode()}
`;

function getStatusText(): string {
  const mode = getSkillSearchMode();
  return [
    'Skill Search (自动技能匹配)',
    `Mode: ${mode}`,
    '',
    'Matching is deterministic keyword-trigger based (OpenHands style).',
    'normal = suggest matches · hybrid = auto-inject matched skills · off = disabled',
  ].join('\n');
}

async function clearCacheAfterModeChange(): Promise<string> {
  logForDebugging('[skill-search] mode change: clearing trigger index cache');
  try {
    const { clearTriggerIndexCache } = await import('../../services/skillSearch/triggerMatch.js');
    clearTriggerIndexCache();
    return 'Skill index cache: cleared (will rebuild on next search)';
  } catch {
    return 'Skill index cache: clear skipped';
  }
}

async function startSkillSearch(): Promise<string> {
  if (getSkillSearchMode() !== 'off') {
    return `Skill Search: already enabled (mode=${getSkillSearchMode()})`;
  }
  const applied = setSkillSearchMode('normal');
  const lines = [`Skill Search: enabled (mode=${applied})`];
  lines.push(await clearCacheAfterModeChange());
  logForDebugging(`[skill-search] command: start (mode=${applied})`);
  return lines.join('\n');
}

async function stopSkillSearch(): Promise<string> {
  if (getSkillSearchMode() === 'off') {
    return 'Skill Search: already disabled';
  }
  setSkillSearchMode('off');
  logForDebugging('[skill-search] command: stop (disabled)');
  return 'Skill Search: disabled (SKILL_SEARCH_ENABLED=0)';
}

async function setModeAndReport(mode: SkillSearchMode): Promise<string> {
  const applied = setSkillSearchMode(mode);
  logForDebugging(`[skill-search] command: set mode=${applied}`);
  const headline =
    applied === 'hybrid'
      ? 'Skill Search: mode=hybrid (matched skills auto-injected)'
      : applied === 'normal'
        ? 'Skill Search: mode=normal (matched skills suggested only)'
        : 'Skill Search: disabled';
  return [headline, await clearCacheAfterModeChange()].join('\n');
}

function SkillSearchPanel({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  useRegisterOverlay('skill-search-panel');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = useMemo<SkillSearchAction[]>(
    () => [
      {
        label: 'Status',
        description: 'Show the current skill-search mode',
        run: () => Promise.resolve(getStatusText()),
      },
      {
        label: 'Normal',
        description: 'Deterministic matching; suggest skills without injecting',
        run: () => setModeAndReport('normal'),
      },
      {
        label: 'Hybrid',
        description: 'Deterministic matching; auto-inject matched skill content',
        run: () => setModeAndReport('hybrid'),
      },
      {
        label: 'Stop',
        description: 'Disable automatic skill matching for this session',
        run: stopSkillSearch,
      },
      {
        label: 'About',
        description: 'How automatic skill matching works',
        run: () => Promise.resolve(ABOUT_TEXT),
      },
    ],
    [],
  );

  const selectCurrent = () => {
    const action = actions[selectedIndex];
    if (!action) return;
    void action.run().then(result => {
      onDone(result, { display: 'system' });
    });
  };

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(index => Math.max(0, index - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(index => Math.min(actions.length - 1, index + 1));
      return;
    }
    if (key.return) {
      selectCurrent();
    }
  });

  return (
    <Dialog
      title="Skill Search"
      subtitle={`${actions.length} actions`}
      onCancel={() => onDone('Skill search panel dismissed', { display: 'system' })}
      color="background"
      hideInputGuide
    >
      <Box flexDirection="column">
        {actions.map((action, index) => (
          <Box key={action.label} flexDirection="row">
            <Text>{`${index === selectedIndex ? '›' : ' '} ${action.label}`.padEnd(ACTION_LABEL_COLUMN_WIDTH)}</Text>
            <Text dimColor>{action.description}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>↑/↓ select · Enter run · Esc close</Text>
        </Box>
      </Box>
    </Dialog>
  );
}

export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  const trimmed = args?.trim().toLowerCase() ?? '';

  if (trimmed === 'start') {
    onDone(await startSkillSearch(), { display: 'system' });
    return null;
  }
  if (trimmed === 'normal') {
    onDone(await setModeAndReport('normal'), { display: 'system' });
    return null;
  }
  if (trimmed === 'hybrid') {
    onDone(await setModeAndReport('hybrid'), { display: 'system' });
    return null;
  }
  if (trimmed === 'stop') {
    onDone(await stopSkillSearch(), { display: 'system' });
    return null;
  }
  if (trimmed === 'about') {
    onDone(ABOUT_TEXT, { display: 'system' });
    return null;
  }
  if (trimmed === 'status') {
    onDone(getStatusText(), { display: 'system' });
    return null;
  }

  return <SkillSearchPanel onDone={onDone} />;
}
