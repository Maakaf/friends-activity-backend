import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsersSilverService } from '../normalized/user/user.service.js';
import { ReposSilverService } from '../normalized/repo/repo.service.js';
import { IssueSilverService } from '../normalized/issue/issue.service.js';
import { PRSilverService } from '../normalized/pr/pr.service.js';
import { CommentSilverService } from '../normalized/comment/comment.service.js';
import { CommitSilverService } from '../normalized/commit/commit.service.js';
import fs from 'fs';
import path from 'path';

type Args = {
  sinceIso?: string;
  untilIso?: string;
  limit?: number;
  out?: string;
  pretty?: boolean;
  module?: boolean;
};

function parseArgs(): Args {
  const kv = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const i = a.indexOf('=');
      return i === -1
        ? [a.replace(/^--/, ''), '']
        : [a.slice(2, i), a.slice(i + 1)];
    }),
  );
  const num = (s?: string) => (s ? Number(s) : undefined);
  return {
    sinceIso: kv.since,
    untilIso: kv.until,
    limit: num(kv.limit),
    out: kv.out,
    pretty: kv.pretty === 'true' || kv.pretty === '',
    module: kv.module === 'true' || kv.module === '',
  };
}

async function main() {
  const args = parseArgs();

  const sinceIso =
    args.sinceIso ??
    new Date(Date.now() - 180 * 86400e3)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
  const untilIso = args.untilIso;

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const usersSvc = app.get(UsersSilverService);
    const reposSvc = app.get(ReposSilverService);
    const issuesSvc = app.get(IssueSilverService);
    const prsSvc = app.get(PRSilverService);
    const commentsSvc = app.get(CommentSilverService);
    const commitsSvc = app.get(CommitSilverService);

    const [users, repos, issues, prs, comments, commits] = await Promise.all([
      usersSvc.getUsersSince({ sinceIso, untilIso, limit: args.limit }),
      reposSvc.getReposSince({ sinceIso, untilIso, limit: args.limit }),
      issuesSvc.getIssuesSince({ sinceIso, untilIso }),
      prsSvc.getPRsSince({ sinceIso, untilIso }),
      commentsSvc.getCommentsSince({ sinceIso, untilIso }),
      commitsSvc.getCommitsSince({ sinceIso, untilIso }),
    ]);

    const bundle = { users, repos, issues, prs, comments, commits };

    console.log(`Silver bundle:
  users=${users.length}
  repos=${repos.length}
  issues=${issues.length}
  prs=${prs.length}
  comments=${comments.length}
  commits=${commits.length}`);

    if (args.out) {
      const outPath = path.isAbsolute(args.out)
        ? args.out
        : path.join(process.cwd(), args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      if (args.module) {
        const moduleCode = `// Auto-generated Silver snapshot
// ${new Date().toISOString()}
export const silver = ${JSON.stringify(bundle, null, args.pretty ? 2 : 0)} as const;
`;
        fs.writeFileSync(outPath, moduleCode, 'utf8');
        console.log(`Saved Silver as TS module → ${outPath}`);
      } else {
        fs.writeFileSync(
          outPath,
          JSON.stringify(bundle, null, args.pretty ? 2 : 0),
          'utf8',
        );
        console.log(`Saved Silver JSON → ${outPath}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
