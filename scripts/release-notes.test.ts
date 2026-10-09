import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

// The release workflow writes its notes in shell, so this runs that exact
// shell: the step's script is lifted out of the workflow and pointed at a
// throwaway repository with a stubbed gh.

const workflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8'
);

function releaseNotesScript(): string {
  const lines = workflow.split('\n');
  const step = lines.findIndex(line =>
    line.includes('name: Create the GitHub Release')
  );
  const run = lines.findIndex(
    (line, i) => i > step && step > -1 && line.trimEnd().endsWith('run: |')
  );
  expect(run).toBeGreaterThan(-1);
  const indent = (lines[run + 1] ?? '').match(/^ +/)?.[0] ?? '';
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() !== '' && !line.startsWith(indent)) break;
    body.push(line.slice(indent.length));
  }
  return body.join('\n');
}

// A shell function shadows the real binary, so the script under test needs no
// gh installed and no PATH of its own. There is no release yet, every pull
// request lookup is answered from GH_PULLS, an author's earlier merged pull
// requests are counted from GH_PRIOR ("alice=0 bob=2"), and the notes gh was
// handed are kept at GH_NOTES_OUT.
const ghStub = [
  'gh() {',
  '  if [ "$1" = release ] && [ "$2" = view ]; then return 1; fi',
  '  if [ "$1" = release ] && [ "$2" = create ]; then',
  '    while [ "$#" -gt 0 ]; do',
  '      if [ "$1" = --notes-file ]; then cp "$2" "$GH_NOTES_OUT"; fi',
  '      shift',
  '    done',
  '    return 0',
  '  fi',
  '  if [ "$1" = api ] && [ "$2" = search/issues ]; then',
  '    if [ -n "$GH_SEARCH_FAILS" ]; then return 1; fi',
  '    local q author',
  '    while [ "$#" -gt 0 ]; do case $1 in q=*) q=$1 ;; esac; shift; done',
  '    author=$(printf %s "$q" | sed -n "s/.*author:\\([^ ]*\\).*/\\1/p")',
  '    printf %s "$GH_PRIOR" | tr " " "\\n" | grep "^$author=" | cut -d= -f2',
  '    return 0',
  '  fi',
  '  if [ "$1" = api ]; then',
  '    if [ -n "$GH_API_FAILS" ]; then return 1; fi',
  // repos/<owner>/<repo>/commits/<sha>/pulls
  '    local sha',
  '    sha=$(printf %s "$2" | cut -d/ -f5)',
  '    grep "^$sha\t" "$GH_PULLS" | cut -f2- || true',
  '    return 0',
  '  fi',
  '  return 1',
  '}',
  '',
].join('\n');

const root = mkdtempSync(join(tmpdir(), 'release-notes-'));

afterAll(() => rmSync(root, { force: true, recursive: true }));

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

type Shape = 'a merge commit' | 'a squash' | 'a rebase';

/** v0.1.2, one merged pull request, then 0.1.3 landed the given way. */
function history(shape: Shape): string {
  const repo = mkdtempSync(join(root, 'repo-'));
  const commit = (subject: string) =>
    git(repo, 'commit', '-q', '--allow-empty', '-m', subject);
  git(repo, 'init', '-q', '-b', 'main');
  commit('feat(widget): ship the first thing');
  git(repo, 'tag', 'v0.1.2');
  git(repo, 'checkout', '-q', '-b', 'fix-the-admin');
  commit('fix(admin): a fix');
  commit('test(admin): cover it');
  git(repo, 'checkout', '-q', 'main');
  git(
    repo,
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'Merge pull request #4 from better-helpdesk/fix-the-admin',
    'fix-the-admin'
  );
  if (shape === 'a merge commit') {
    git(repo, 'checkout', '-q', '-b', 'release-0-1-3');
    commit('chore(release): 0.1.3');
    git(repo, 'checkout', '-q', 'main');
    git(
      repo,
      'merge',
      '-q',
      '--no-ff',
      '-m',
      'Merge pull request #5 from better-helpdesk/release-0-1-3',
      'release-0-1-3'
    );
  } else if (shape === 'a squash') {
    commit('chore(release): 0.1.3 (#5)');
  } else {
    commit('chore(release): 0.1.3');
  }
  git(repo, 'tag', 'v0.1.3');
  return repo;
}

/** What GitHub answers for each commit: the pull request it was merged in. */
function pulls(repo: string): string {
  const log = git(repo, 'log', '--format=%H%x09%s', 'v0.1.2..v0.1.3');
  const rows = log
    .trim()
    .split('\n')
    .flatMap(line => {
      const [sha = '', subject = ''] = line.split('\t');
      if (/admin|#4/.test(subject)) {
        return [`${sha}\t4\tfix(admin): a fix\talice`];
      }
      if (/0\.1\.3|#5/.test(subject)) {
        return [`${sha}\t5\tchore(release): 0.1.3\tbob`];
      }
      return [];
    });
  return `${rows.join('\n')}\n`;
}

type Stub = { apiFails?: boolean; searchFails?: boolean; prior?: string };

/** Every line of the notes handed to gh. */
function notesFor(shape: Shape, stub: Stub = {}): string[] {
  const repo = history(shape);
  const runnerTemp = mkdtempSync(join(root, 'runner-'));
  const pullsFile = join(runnerTemp, 'pulls.tsv');
  const notesOut = join(runnerTemp, 'notes-handed-to-gh.md');
  writeFileSync(pullsFile, pulls(repo));
  const script = ghStub + releaseNotesScript();
  execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_API_FAILS: stub.apiFails ? '1' : '',
      GH_SEARCH_FAILS: stub.searchFails ? '1' : '',
      GH_PRIOR: stub.prior ?? 'alice=1 bob=1',
      GH_NOTES_OUT: notesOut,
      GH_PULLS: pullsFile,
      GH_TOKEN: 'stub',
      GITHUB_REF_NAME: 'v0.1.3',
      GITHUB_REPOSITORY: 'better-helpdesk/better-helpdesk',
      RUNNER_TEMP: runnerTemp,
    },
  });
  return readFileSync(notesOut, 'utf8').split('\n');
}

function bulletsFor(shape: Shape, stub: Stub = {}): string[] {
  return notesFor(shape, stub).filter(line => line.startsWith('- '));
}

describe('the generated release notes', () => {
  for (const shape of ['a merge commit', 'a squash', 'a rebase'] as const) {
    it(`do not announce a release landed by ${shape}`, () => {
      expect(bulletsFor(shape)).toEqual([
        '- fix(admin): a fix (#4) by @alice.',
      ]);
    });
  }

  it('do not fall back to the raw merge commit when gh fails', () => {
    expect(bulletsFor('a merge commit', { apiFails: true })).toEqual([
      '- fix(admin): a fix.',
      '- test(admin): cover it.',
    ]);
  });

  it('welcome an author with no pull request merged before the previous release', () => {
    const notes = notesFor('a squash', { prior: 'alice=0 bob=4' });
    expect(notes).toContain('**New contributors**');
    expect(notes).toContain('- @alice made their first contribution in #4.');
  });

  it('do not welcome a returning author, or anyone when the lookup fails', () => {
    expect(notesFor('a squash', { prior: 'alice=3' })).not.toContain(
      '**New contributors**'
    );
    const failed = notesFor('a squash', {
      prior: 'alice=0',
      searchFails: true,
    });
    expect(failed).not.toContain('**New contributors**');
    expect(failed).toContain('- fix(admin): a fix (#4) by @alice.');
  });
});
