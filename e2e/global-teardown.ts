import * as fs from 'fs';
import * as path from 'path';

export default async function globalTeardown() {
  const authStatePath = path.join(process.cwd(), '.playwright', 'auth.json');
  if (fs.existsSync(authStatePath)) {
    fs.rmSync(authStatePath, { force: true });
  }
}
