import { execFileSync } from 'node:child_process';
import process from 'node:process';

/**
 * Synchronously check if the current process is running with Windows administrator privileges.
 * Returns false on non-Windows platforms.
 */
export function isAdmin(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    execFileSync('fsutil', ['dirty', 'query', process.env.systemdrive || 'C:'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    try {
      execFileSync('fltmc', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
