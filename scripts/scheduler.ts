//
// Scheduler: runs the automation pipeline on a schedule
//
// Modes:
//   node dist/scripts/scheduler.js --run-now   run once and exit (used by the Windows task)
//   node dist/scripts/scheduler.js --trigger   same as --run-now, on-demand
//   node dist/scripts/scheduler.js            stay alive and run on a cron schedule
//
import cron from 'node-cron';
import { runPipeline } from './main.js';
import { ENV } from '../src/config.js';

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *';

function banner(): void {
  const title = `${ENV.BOT_NAME} \u00b7 daily repo/skill digest bot`;
  const width = title.length + 4;
  const rule = '\u2500'.repeat(width);
  const pad = ' '.repeat(width - title.length);
  console.log('');
  console.log(`  \u250C${rule}\u2510`);
  console.log(`  \u2502 ${title}${pad} \u2502`);
  console.log(`  \u2514${rule}\u2518`);
  console.log('');
}

async function runOnce(trigger: boolean): Promise<number> {
  banner();
  console.log(`Trigger mode: ${trigger ? 'ON-DEMAND' : 'Scheduled'}`);
  try {
    const result = await runPipeline(trigger);
    if (result.digestText) {
      console.log('\nDigest generated successfully.');
      console.log('---');
      console.log(result.digestText.substring(0, 500));
      console.log('---');
    }
    console.log(`Pipeline complete. Date: ${result.date}`);
    return 0;
  } catch (err) {
    console.error('Pipeline failed:', (err as Error).message);
    return 1;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--trigger') || args.includes('--run-now')) {
    process.exitCode = await runOnce(true);
    return;
  }

  banner();
  console.log(`Schedule: "${CRON_SCHEDULE}" (default 0 0 * * * = daily at 00:00 server time)`);
  console.log('Waiting for next run... (Ctrl+C to stop)');

  cron.schedule(CRON_SCHEDULE, () => {
    void runOnce(false);
  });
}

main();
