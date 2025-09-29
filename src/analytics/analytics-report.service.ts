import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileEntity } from './user_profile/user_profile.entity.js';
import { UserActivityEntity } from './user_activity/user_activity.entity.js';
import { RepositoryEntity } from './repository/repository.entity.js';

@Injectable()
export class AnalyticsReportService {
  constructor(
    @InjectRepository(UserProfileEntity) private readonly userRepo: Repository<UserProfileEntity>,
    @InjectRepository(UserActivityEntity) private readonly activityRepo: Repository<UserActivityEntity>,
    @InjectRepository(RepositoryEntity) private readonly repoRepo: Repository<RepositoryEntity>,
  ) {}

  async generateFrontendReport(usernames: string[]) {
    const since180Days = new Date();
    since180Days.setDate(since180Days.getDate() - 180);

    // Get users
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.login = ANY(:usernames)', { usernames })
      .getMany();

    // Get repos with fork_count >= 3
    const repos = await this.repoRepo
      .createQueryBuilder('r')
      .where('r.forkCount >= :minForks', { minForks: 3 })
      .getMany();

    console.log(`Found ${repos.length} repos with fork_count >= 3:`, repos.map(r => `${r.repoName} (${r.forkCount} forks)`));

    // Get activities for last 180 days
    const activities = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.day >= :since', { since: since180Days })
      .andWhere('a.userId = ANY(:userIds)', { userIds: users.map(u => u.userId) })
      .andWhere('a.repoId = ANY(:repoIds)', { repoIds: repos.map(r => r.repoId) })
      .getMany();

    console.log(`Found ${activities.length} activities in last 180 days for repos with fork_count >= 3`);
    console.log('Activities by type:', activities.reduce((acc, a) => { acc[a.activityType] = (acc[a.activityType] || 0) + (a.activityCount || 0); return acc; }, {} as any));

    // Build response
    const result = {
      users: users.map(user => this.buildUserData(user, repos, activities)),
      globalSummary: this.buildGlobalSummary(users, repos, activities, since180Days)
    };

    return result;
  }

  private buildUserData(user: UserProfileEntity, repos: RepositoryEntity[], activities: UserActivityEntity[]) {
    const userActivities = activities.filter(a => a.userId === user.userId);
    const userRepos = this.getUserRepos(user.userId, repos, userActivities);

    return {
      user: {
        username: user.login,
        displayName: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        company: user.company,
        blog: user.blog,
        twitterUsername: user.twitterUsername,
        publicRepos: user.publicRepos,
        followers: user.followers,
        following: user.following,
        accountType: user.type,
        createdAt: user.ghCreatedAt?.toISOString()
      },
      repos: userRepos,
      summary: this.calculateUserSummary(userRepos)
    };
  }

  private getUserRepos(userId: string, repos: RepositoryEntity[], activities: UserActivityEntity[]) {
    const userActivities = activities.filter(a => a.userId === userId);
    const repoActivities = new Map();

    // Group activities by repo
    userActivities.forEach(activity => {
      if (!repoActivities.has(activity.repoId)) {
        repoActivities.set(activity.repoId, {
          commits: 0,
          pullRequests: 0,
          issues: 0,
          prComments: 0,
          issueComments: 0
        });
      }

      const counts = repoActivities.get(activity.repoId);
      const activityCount = activity.activityCount || 0;

      switch (activity.activityType) {
        case 'commit':
          counts.commits += activityCount;
          break;
        case 'pr':
          counts.pullRequests += activityCount;
          break;
        case 'issue':
          counts.issues += activityCount;
          break;
        case 'pr_comment':
          counts.prComments += activityCount;
          break;
        case 'issue_comment':
          counts.issueComments += activityCount;
          break;
      }
    });

    // Build repo list with activity counts
    return Array.from(repoActivities.entries())
      .map(([repoId, counts]) => {
        const repo = repos.find(r => r.repoId === repoId);
        if (!repo) return null;

        return {
          repoName: repo.repoName,
          description: repo.description,
          url: repo.htmlUrl,
          commits: counts.commits,
          pullRequests: counts.pullRequests,
          issues: counts.issues,
          prComments: counts.prComments,
          issueComments: counts.issueComments
        };
      })
      .filter(Boolean);
  }

  private calculateUserSummary(repos: any[]) {
    return repos.reduce((sum, repo) => ({
      totalCommits: sum.totalCommits + repo.commits,
      totalPRs: sum.totalPRs + repo.pullRequests,
      totalIssues: sum.totalIssues + repo.issues,
      totalPRComments: sum.totalPRComments + repo.prComments,
      totalIssueComments: sum.totalIssueComments + repo.issueComments
    }), {
      totalCommits: 0,
      totalPRs: 0,
      totalIssues: 0,
      totalPRComments: 0,
      totalIssueComments: 0
    });
  }

  private buildGlobalSummary(users: UserProfileEntity[], repos: RepositoryEntity[], activities: UserActivityEntity[], since: Date) {
    const totalCounts = activities.reduce((sum, activity) => {
      const count = activity.activityCount || 0;
      switch (activity.activityType) {
        case 'commit': sum.totalCommits += count; break;
        case 'pr': sum.totalPRs += count; break;
        case 'issue': sum.totalIssues += count; break;
        case 'pr_comment': sum.totalPRComments += count; break;
        case 'issue_comment': sum.totalIssueComments += count; break;
      }
      return sum;
    }, { totalCommits: 0, totalPRs: 0, totalIssues: 0, totalPRComments: 0, totalIssueComments: 0 });

    // Count unique repositories from user data
    const uniqueRepoUrls = new Set<string>();
    users.forEach(user => {
      const userRepos = this.getUserRepos(user.userId, repos, activities);
      userRepos.forEach(repo => {
        if (repo && repo.url) {
          uniqueRepoUrls.add(repo.url);
        }
      });
    });

    return {
      ...totalCounts,
      totalRepos: uniqueRepoUrls.size,
      successfulUsers: users.length,
      failedUsers: 0,
      totalUsers: users.length,
      analysisTimeframe: `${since.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
      minForkCountFilter: "3"
    };
  }
}