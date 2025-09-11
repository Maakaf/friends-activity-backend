import { Injectable, Logger, Inject } from '@nestjs/common';
import { CommentBronzeRepo } from './comment.repo.js';
import { mapComment, mergeComment } from './mappers.js';
import type { Comment } from './types.js';

@Injectable()
export class CommentSilverService {
  private readonly log = new Logger(CommentSilverService.name);
  constructor(@Inject(CommentBronzeRepo) private readonly repo: CommentBronzeRepo) {}

  async getCommentsSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
  }): Promise<Comment[]> {
    const bronzeRows = await this.repo.loadSince(params);
    const byId = new Map<string, Comment>();

    for (const b of bronzeRows) {
      const cur = mapComment(b);
      if (!cur) continue;

      const prev = byId.get(cur.commentId);
      if (!prev) {
        byId.set(cur.commentId, cur);
      } else {
        byId.set(cur.commentId, mergeComment(prev, cur));
      }
    }

    const out = [...byId.values()];
    this.log.debug(`silver.comments: ${out.length} (from ${bronzeRows.length} bronze rows)`);
    return out;
  }
}
