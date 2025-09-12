import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsersSilverService } from '../normalized/user.service.js';
import { RepositoriesSilverService } from '../normalized/repo.service.js';
import { IssueSilverService } from '../normalized/issue.service.js';
import { PRSilverService } from '../normalized/pr.service.js';
import { CommentSilverService } from '../normalized/comment.service.js';
import { CommitSilverService } from '../normalized/commit.service.js';
import fs from 'fs';
import path from 'path';

type Args = {
  sinceIso?: string;
  untilIso?: string;
  limit?: number;
  out?: string;     // optional output file path for JSON
  pretty?: boolean; // pretty-print JSON
};

function parseArgs(): Args {
  const kv = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const i = a.indexOf('=');
      return i === -1 ? [a.replace(/^--/, ''), ''] : [a.slice(2, i), a.slice(i + 1)];
    })
  );
  const num = (s?: string) => (s ? Number(s) : undefined);
  return {
    sinceIso: kv.since || process.env.SILVER_SINCE || undefined,
    untilIso: kv.until || process.env.SILVER_UNTIL || undefined,
    limit: num(kv.limit || process.env.SILVER_LIMIT),
    out: kv.out || process.env.SILVER_OUT || undefined,
    pretty: kv.pretty === 'true' || kv.pretty === '' || false,
  };
}

async function main() {
  const args = parseArgs();

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const usersSvc    = app.get(UsersSilverService);
    const reposSvc    = app.get(RepositoriesSilverService);
    const issuesSvc   = app.get(IssueSilverService);
    const prsSvc      = app.get(PRSilverService);
    const commentsSvc = app.get(CommentSilverService);
    const commitsSvc  = app.get(CommitSilverService);

    // Build the full Silver bundle in memory
    const [users, repos, issues, prs, comments, commits] = await Promise.all([
      usersSvc.getUsersSince({ sinceIso: args.sinceIso, untilIso: args.untilIso, limit: args.limit }),
      reposSvc.getReposSince({ sinceIso: args.sinceIso, untilIso: args.untilIso, limit: args.limit }),
      issuesSvc.getIssuesSince({ sinceIso: args.sinceIso, untilIso: args.untilIso }),
      prsSvc.getPRsSince({ sinceIso: args.sinceIso, untilIso: args.untilIso }),
      commentsSvc.getCommentsSince({ sinceIso: args.sinceIso, untilIso: args.untilIso }),
      commitsSvc.getCommitsSince({ sinceIso: args.sinceIso, untilIso: args.untilIso }),
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
      const outPath = path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(bundle, null, args.pretty ? 2 : 0), 'utf8');
      console.log(`Saved Silver JSON → ${outPath}`);
    } else {
      // Print a small preview only (avoid dumping huge JSON to console)
      console.log('Preview:', JSON.stringify({
        users: users.slice(0, 2),
        repos: repos.slice(0, 2),
        issues: issues.slice(0, 2),
        prs: prs.slice(0, 2),
        comments: comments.slice(0, 2),
        commits: commits.slice(0, 2),
      }, null, args.pretty ? 2 : 0));
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
