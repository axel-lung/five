import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', '.pg-test');

export default async () => {
  const pg = (globalThis as any).__EMBEDDED_PG__;
  if (pg) {
    await pg.stop();
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
};
