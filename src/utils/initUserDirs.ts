import { existsSync, readdirSync, mkdirSync, cpSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { getGakrcliConfigHomeDir } from './envUtils.js'

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

// Determine package root at runtime, works for both development and global installs
function getPackageRoot(): string {
  try {
    // Use import.meta.url to get the location of the bundle (dist/cli.mjs)
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const url = import.meta.url
      if (typeof url === 'string' && url.startsWith('file://')) {
        const thisPath = fileURLToPath(url)
        const dir = dirname(thisPath)
        // If this file is bundled into dist/cli.mjs, its directory is the 'dist' folder
        // Package root is the parent of 'dist'
        return resolve(dir, '..')
      }
    }
  } catch (e) {
    // ignore and fall back
  }
  // Fallback to current working directory (dev may work if run from project root)
  return process.cwd()
}

const PACKAGE_ROOT = getPackageRoot()

const REQUIRED_DIRS = ['skills', 'sessions', 'projects', 'rules', 'agents', 'memory', 'cache', 'logs']

/**
 * Recursively copy files from src to dest, but only if the destination file does not already exist.
 * Directories are created as needed. Skips entries that cause errors.
 */
function syncMissingDir(src: string, dest: string): void {
  try {
    const entries = readdirSync(src)
    for (const entry of entries) {
      const srcPath = join(src, entry)
      const destPath = join(dest, entry)
      try {
        const stat = statSync(srcPath)
        if (stat.isDirectory()) {
          if (!existsSync(destPath)) {
            cpSync(srcPath, destPath, { recursive: true })
          } else {
            // Destination exists; recurse to sync its contents
            syncMissingDir(srcPath, destPath)
          }
        } else {
          if (!existsSync(destPath)) {
            mkdirSync(dirname(destPath), { recursive: true })
            cpSync(srcPath, destPath)
          }
        }
      } catch (e) {
        // Ignore individual entry errors and continue
      }
    }
  } catch (e) {
    // src may not exist or be inaccessible; ignore
  }
}

/**
 * Initializes user directories on first run.
 * Creates ~/.gakrcli (or legacy ~/.gakrcli or ~/.opengakrcli) with required subdirectories.
 * Syncs default skills, rules, and agents from package assets, adding missing files/directories.
 */
export function initUserDirs(): void {
  const configHome = getGakrcliConfigHomeDir()

  // Create config home if it doesn't exist
  if (!existsSync(configHome)) {
    mkdirSync(configHome, { recursive: true })
    console.log(`✓ Created config directory: ${configHome}`)
  }

  // Create required subdirectories
  const createdDirs: string[] = []
  for (const dir of REQUIRED_DIRS) {
    const fullPath = join(configHome, dir)
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true })
      createdDirs.push(dir)
    }
  }
  if (createdDirs.length > 0) {
    console.log(`✓ Created directories: ${createdDirs.join(', ')}`)
  }

  // Initialize config.json if it doesn't exist
  const configFile = join(configHome, 'config.json')
  if (!existsSync(configFile)) {
    // MACRO.VERSION is inlined at build time by scripts/build.ts
    const version = MACRO.VERSION
    const configContent = JSON.stringify({ version, createdAt: new Date().toISOString() }, null, 2)
    require('fs').writeFileSync(configFile, configContent)
    console.log(`✓ Created config file: ${configFile}`)
  }

  // Sync default skills from assets (add missing only)
  const skillsDir = join(configHome, 'skills')
  const assetsSkillsDir = join(PACKAGE_ROOT, 'assets', 'skills')

  // Ensure skills directory exists
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true })
  }

  if (existsSync(assetsSkillsDir)) {
    try {
      syncMissingDir(assetsSkillsDir, skillsDir)
    } catch (error) {
      console.warn(`⚠ Could not sync default skills: ${error}`)
    }
  } else {
    console.warn(`⚠ Default skills not found at: ${assetsSkillsDir}`)
  }

  // Sync default rules from assets (add missing only)
  const rulesDir = join(configHome, 'rules')
  const assetsRulesDir = join(PACKAGE_ROOT, 'assets', 'rules')

  // Ensure rules directory exists
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true })
  }

  if (existsSync(assetsRulesDir)) {
    try {
      syncMissingDir(assetsRulesDir, rulesDir)
    } catch (error) {
      console.warn(`⚠ Could not sync default rules: ${error}`)
    }
  } else {
    console.warn(`⚠ Default rules not found at: ${assetsRulesDir}`)
  }

  // Sync default agents from assets (add missing only)
  const agentsDir = join(configHome, 'agents')
  const assetsAgentsDir = join(PACKAGE_ROOT, 'assets', 'agents')

  // Ensure agents directory exists
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true })
  }

  if (existsSync(assetsAgentsDir)) {
    try {
      syncMissingDir(assetsAgentsDir, agentsDir)
    } catch (error) {
      console.warn(`⚠ Could not sync default agents: ${error}`)
    }
  } else {
    console.warn(`⚠ Default agents not found at: ${assetsAgentsDir}`)
  }
}
