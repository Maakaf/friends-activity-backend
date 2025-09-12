import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ReposSilverService } from '../normalized/repo.service.js';

/**
 * Tiny CLI arg parser:
 *   --since=2024-01-01T00:00:00Z
 *   --until=2025-12-31T23:59:59Z
 *   --owners=owner1,owner2
 *   --names=repoA,repoB
 *   --limit=50
 */
function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((kv) => {
      const idx = kv.indexOf('=');
      if (idx === -1) return [kv.replace(/^--/, ''), ''];
      return [kv.slice(2, idx), kv.slice(idx + 1)];
    })
  );

  const csv = (s?: string) =>
    (s ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const num = (s?: string) => (s ? Number(s) : undefined);

  return {
    sinceIso: args.since || undefined,
    untilIso: args.until || undefined,
    owners: csv(args.owners),
    names: csv(args.names),
    limit: num(args.limit),
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const svc = app.get(ReposSilverService);
    const { sinceIso, untilIso, owners, names, limit } = parseArgs();

    const repos = await svc.getReposSince({
      sinceIso,
      untilIso,
      owners: owners.length ? owners : undefined,
      names: names.length ? names : undefined,
      limit,
    });

    console.log(`count=${repos.length}`);
    console.log(JSON.stringify(repos.slice(0, 5), null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
