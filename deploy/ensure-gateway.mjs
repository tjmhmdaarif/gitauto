// Ensures the local OpenAI-compatible AI gateway is reachable before the
// pipeline runs, so enrichment does not silently fall back to heuristics.
//
// The default endpoint is the omniroute gateway on http://127.0.0.1:3001/v1.
// If it is not answering, we start `omniroute serve` detached and wait for it.
// A failure here is not fatal: the pipeline still runs and degrades to the
// built-in heuristic enrichment.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

function readEnvFile() {
  const env = {};
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnvFile();
const baseUrl = (env.AI_BASE_URL || 'http://127.0.0.1:3001/v1').replace(/\/+$/, '');
const apiKey = env.AI_API_KEY || '';
const modelsUrl = `${baseUrl}/models`;

async function probe() {
  try {
    const response = await fetch(modelsUrl, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

if (await probe()) {
  console.log(`AI gateway reachable at ${baseUrl}`);
  process.exit(0);
}

console.log(`AI gateway not reachable at ${baseUrl}; attempting to start omniroute...`);
const port = (baseUrl.match(/:(\d+)/) || [])[1] || '3001';

const child = spawn(
  'omniroute',
  ['serve', '--port', port, '--no-open', '--log', '--no-recovery'],
  { detached: true, stdio: 'ignore', shell: true, cwd: root }
);
child.unref();

for (let attempt = 0; attempt < 30; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (await probe()) {
    console.log('AI gateway started.');
    process.exit(0);
  }
}

console.error('Could not start the AI gateway; enrichment will fall back to heuristics.');
process.exit(1);
