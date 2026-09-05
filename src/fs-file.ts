import fs from 'node:fs';
import path from 'node:path';

/** Stage on the destination filesystem; a failed write or rename leaves the old file intact. */
export function replaceFile(target: string, write: (temporary: string) => void): void {
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.tps-write-'));
  try {
    const temporary = path.join(staging, 'file');
    write(temporary);
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** Copy source bytes and mode without opening an existing (possibly read-only) target for writing. */
export function copyFile(source: string, target: string): void {
  replaceFile(target, temporary => fs.copyFileSync(source, temporary));
}
