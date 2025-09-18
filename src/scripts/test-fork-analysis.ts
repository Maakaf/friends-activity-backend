import { ForkPRAnalyzer } from '../normalized/fork-pr-analyzer.js';
import { readFileSync } from 'fs';

// Read the normalized output
const data = JSON.parse(readFileSync('normalized-output.json', 'utf8'));

console.log('🔍 Fork-Parent Relationships:');
console.log('============================');

// Show fork relationships
const forks = data.data.repos.filter((repo: any) => repo.parentRepoId);
for (const fork of forks) {
  const parent = data.data.repos.find((r: any) => r.repoId === fork.parentRepoId);
  console.log(`📁 ${fork.repoName} (${fork.repoId}) -> ${parent?.repoName} (${fork.parentRepoId})`);
  console.log(`   Fork count: ${fork.forkCount}, Parent fork count: ${parent?.forkCount}`);
}

console.log('\n🔄 Merged PRs Analysis:');
console.log('=======================');

// Show merged PRs
const mergedPRs = data.data.prs.filter((pr: any) => pr.mergedAt);
console.log(`Total PRs: ${data.data.prs.length}`);
console.log(`Merged PRs: ${mergedPRs.length}`);

// Group by repo
const prsByRepo = new Map();
for (const pr of mergedPRs) {
  if (!prsByRepo.has(pr.repoId)) {
    prsByRepo.set(pr.repoId, []);
  }
  prsByRepo.get(pr.repoId).push(pr);
}

for (const [repoId, prs] of prsByRepo) {
  const repo = data.data.repos.find((r: any) => r.repoId === repoId);
  console.log(`\n📊 ${repo?.repoName} (${repo?.forkCount} forks): ${prs.length} merged PRs`);
  
  // Check if this repo has forks that could have contributed
  const forks = data.data.repos.filter((r: any) => r.parentRepoId === repoId);
  if (forks.length > 0) {
    console.log(`   Potential fork contributors: ${forks.map((f: any) => f.repoName).join(', ')}`);
  }
}

console.log('\n✅ Step 1 Complete: Fork relationships tracked');
console.log('⏳ Step 2 In Progress: PR-commit relationships (commits arrays ready)');
console.log('⏳ Step 3 In Progress: Merged fork PR identification (basic structure ready)');