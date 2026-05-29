import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { getGakrcliConfigHomeDir } from './envUtils.js'

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

export function getPackageRoot(startUrl: string = import.meta.url): string {
  try {
    if (startUrl.startsWith('file://')) {
      let dir = dirname(fileURLToPath(startUrl))

      // In the bundled npm package this starts from dist/cli.mjs. In tests and
      // source runs it starts under src/utils. Walk upward until we find the
      // package root that owns the shipped assets.
      while (true) {
        if (
          existsSync(join(dir, 'package.json')) &&
          existsSync(join(dir, 'assets'))
        ) {
          return dir
        }

        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    }
  } catch {
    // Ignore and fall back below.
  }

  return process.cwd()
}

const REQUIRED_DIRS = [
  'agents',
  'cache',
  'commands',
  'logs',
  'memory',
  'output-styles',
  'projects',
  'rules',
  'sessions',
  'skills',
  'workflows',
]

export type InitUserDirsResult = {
  configHome: string
  createdDirs: string[]
  createdConfigFile: boolean
  syncedAssets: Record<'agents' | 'rules' | 'skills', number>
  missingAssetDirs: string[]
}

type InitUserDirsOptions = {
  configHome?: string
  packageRoot?: string
}

function countFiles(dir: string): number {
  let count = 0

  try {
    for (const entry of readdirSync(dir)) {
      const entryPath = join(dir, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        count += countFiles(entryPath)
      } else {
        count += 1
      }
    }
  } catch {
    // Ignore inaccessible copied entries.
  }

  return count
}

function syncMissingDir(src: string, dest: string): number {
  let copied = 0

  try {
    for (const entry of readdirSync(src)) {
      const srcPath = join(src, entry)
      const destPath = join(dest, entry)

      try {
        const stat = statSync(srcPath)
        if (stat.isDirectory()) {
          if (!existsSync(destPath)) {
            cpSync(srcPath, destPath, { recursive: true })
            copied += countFiles(destPath)
          } else {
            copied += syncMissingDir(srcPath, destPath)
          }
        } else if (!existsSync(destPath)) {
          mkdirSync(dirname(destPath), { recursive: true })
          cpSync(srcPath, destPath)
          copied += 1
        }
      } catch {
        // Ignore individual entry errors and continue.
      }
    }
  } catch {
    // Source may not exist or be inaccessible.
  }

  return copied
}

export function initUserDirs(
  options?: InitUserDirsOptions,
): InitUserDirsResult {
  const configHome = options?.configHome ?? getGakrcliConfigHomeDir()
  const packageRoot = options?.packageRoot ?? getPackageRoot()
  const result: InitUserDirsResult = {
    configHome,
    createdDirs: [],
    createdConfigFile: false,
    syncedAssets: {
      agents: 0,
      rules: 0,
      skills: 0,
    },
    missingAssetDirs: [],
  }

  if (!existsSync(configHome)) {
    mkdirSync(configHome, { recursive: true })
  }

  for (const dir of REQUIRED_DIRS) {
    const fullPath = join(configHome, dir)
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true })
      result.createdDirs.push(dir)
    }
  }

  const configFile = join(configHome, 'config.json')
  if (!existsSync(configFile)) {
    const version =
      typeof MACRO !== 'undefined'
        ? (MACRO.DISPLAY_VERSION ?? MACRO.VERSION)
        : '0.0.0'
    const configContent = JSON.stringify(
      { version, createdAt: new Date().toISOString() },
      null,
      2,
    )
    writeFileSync(configFile, configContent)
    result.createdConfigFile = true
  }

  for (const dir of ['agents', 'rules', 'skills'] as const) {
    const destDir = join(configHome, dir)
    const assetDir = join(packageRoot, 'assets', dir)

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    if (existsSync(assetDir)) {
      result.syncedAssets[dir] = syncMissingDir(assetDir, destDir)
    } else {
      result.missingAssetDirs.push(assetDir)
    }
  }

  return result
}
