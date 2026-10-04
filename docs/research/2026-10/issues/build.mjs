// Renders the ticket files into the review document, or creates them on GitHub as sub-issues of epics.
//   node build.mjs render <out.md>
//   node build.mjs create [--waves=1,2,3,4,backlog] [--dry-run]

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter(f => /^\d\d-.*\.md$/.test(f))
  .sort();

const epics = {
  launch: {
    title: 'Epic: launch surface',
    body: 'Everything a developer meets in the first thirty minutes: the README, the demo, the adapters they have to write, how email gets in, how they switch. Marketing and sales both called these launch-blocking; none opens a migration.',
  },
  'host-integration': {
    title: 'Epic: host integration',
    body: 'The seams the host app plugs into: the in-process events hook, what the package emails and records on its own, and small config fields that let the host hand the helpdesk what it already knows.',
  },
  'inbox-workflow': {
    title: 'Epic: inbox workflow',
    body: 'What an agent reaches for while working the queue: tags, snooze, counts and unread rows, bulk actions, shortcuts, merge, drafts. Tags and snooze were named by every report.',
  },
  'team-collaboration': {
    title: 'Epic: team collaboration',
    body: 'What a team of two to ten needs so two people do not answer the same customer and an escalation stays inside the helpdesk: presence, mentions, and later in-app notifications.',
  },
  'hours-feedback-reporting': {
    title: 'Epic: business hours, feedback and reporting',
    body: "The founder's month-one questions: are the colours honest over a weekend, did the resolution help, how fast do we reply. Business hours first, then a rating, then one overview page over the same SQL.",
  },
  'agent-ui-craft': {
    title: 'Epic: agent UI craft',
    body: 'The UX review in Preserve mode: keep the information architecture and labels, raise the craft. Token-derived surfaces, skeletons, empty states, pressed and error states, then the aside, the properties card and finally the split list-and-thread layout.',
  },
  'widget-customer': {
    title: 'Epic: widget and customer side',
    body: 'What the customer sees: accent and contrast fixes, the first form\'s fold, marking a conversation resolved, "Seen", and later a full-page conversations component for an in-app Support page.',
  },
};

const parseList = v =>
  v
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const tickets = files.map(file => {
  const text = readFileSync(join(here, file), 'utf8');
  const [, fm, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2];
  }
  if (!epics[meta.epic]) throw new Error(`${file}: unknown epic ${meta.epic}`);
  return {
    file,
    id: meta.id,
    epic: meta.epic,
    wave: meta.wave,
    size: meta.size,
    title: JSON.parse(meta.title),
    labels: meta.labels.split(',').map(s => s.trim()),
    depends: parseList(meta.depends),
    betterWith: parseList(meta.better_with),
    body: body.trim(),
  };
});
const byId = Object.fromEntries(tickets.map(t => [t.id, t]));
for (const t of tickets)
  for (const d of [...t.depends, ...t.betterWith])
    if (!byId[d]) throw new Error(`${t.id}: unknown ref ${d}`);

const sizeWord = {
  S: 'S, under a day',
  M: 'M, a few days',
  L: 'L, a week or more',
};
const waveName = {
  1: 'Wave 1: launch surface and correctness, no schema change',
  2: 'Wave 2: the columns and the table everything else leans on',
  3: 'Wave 3: working the queue',
  4: 'Wave 4: bigger surfaces, on partner pull',
  backlog: 'Backlog: on request',
};
const waveWhy = {
  1: 'The design partners deploy against this. Every item is small, independent, and none opens a migration.',
  2: 'Four generated migrations (`tags`, `snoozed_until`, `agent_seen_at`, `conversation_event`), each its own PR. The timeline needs the wave-1 events hook. Tags and snooze were named by every report and are the first things an agent reaches for.',
  3: 'All build on wave-2 data (bulk tagging, the `z` key, snooze lines in the thread). The two aside PRs reshape the conversation view before the split layout rewrites the page.',
  4: 'Each is a larger surface or a feature a partner should ask for first.',
  backlog: 'Written up so the answer exists when someone asks; not scheduled.',
};

function footer(t, ref, epicRef) {
  const lines = [];
  lines.push(
    `**Size:** ${sizeWord[t.size]} · **${t.wave === 'backlog' ? 'Backlog' : 'Wave ' + t.wave}** · **Epic:** ${epicRef(t.epic)}`
  );
  if (t.depends.length)
    lines.push(`**Depends on:** ${t.depends.map(ref).join(', ')}`);
  if (t.betterWith.length)
    lines.push(`**Better with:** ${t.betterWith.map(ref).join(', ')}`);
  return lines.join('\n');
}

if (process.argv[2] === 'render') {
  const out = process.argv[3];
  const part1 = readFileSync(join(here, 'synthesis-part1.md'), 'utf8');
  const declined = readFileSync(join(here, 'declined.md'), 'utf8');
  const method = readFileSync(join(here, 'method.md'), 'utf8');
  const ref = id => `[${byId[id].title}](#${id})`;
  const epicRef = key => `[${epics[key].title}](#epic-${key})`;
  let md = `# Better Helpdesk against Zendesk, Intercom, Chatwoot and Libredesk\n\nResearched 2 October 2026. ${tickets.length} GitHub issues in seven epics, scheduled in four waves and a backlog, each completable on its own.\n\n`;
  md += method + '\n\n' + part1 + '\n\n';
  md += '## The epics\n\n';
  for (const [key, e] of Object.entries(epics)) {
    md += `<a id="epic-${key}"></a>\n**${e.title}.** ${e.body} Issues: ${tickets
      .filter(t => t.epic === key)
      .map(t => `[${t.id}](#${t.id})`)
      .join(', ')}.\n\n`;
  }
  md += '## The plan\n\n| Wave | Issues | Why this order |\n|---|---|---|\n';
  for (const w of ['1', '2', '3', '4', 'backlog']) {
    const ids = tickets
      .filter(t => t.wave === w)
      .map(t => `[${t.id}](#${t.id})`)
      .join(', ');
    md += `| ${waveName[w]} | ${ids} | ${waveWhy[w]} |\n`;
  }
  md += '\n' + declined + '\n\n## The issues\n\n';
  for (const w of ['1', '2', '3', '4', 'backlog']) {
    md += `### ${waveName[w]}\n\n`;
    for (const t of tickets.filter(t => t.wave === w)) {
      md += `<a id="${t.id}"></a>\n#### ${t.title}\n\nLabels: ${t.labels.map(l => '`' + l + '`').join(' ')}\n\n${t.body}\n\n${footer(t, ref, epicRef)}\n\n---\n\n`;
    }
  }
  writeFileSync(out, md);
  console.log(`rendered ${tickets.length} issues to ${out}`);
} else if (process.argv[2] === 'create') {
  const args = process.argv.slice(3);
  const dry = args.includes('--dry-run');
  const wavesArg = args.find(a => a.startsWith('--waves='));
  const waves = wavesArg
    ? wavesArg.slice(8).split(',')
    : ['1', '2', '3', '4', 'backlog'];
  const gh = (...a) =>
    dry
      ? (console.log(
          'gh',
          a
            .map(s => (/\s/.test(s) ? JSON.stringify(s.slice(0, 60)) : s))
            .join(' ')
        ),
        '')
      : execFileSync('gh', a, { encoding: 'utf8' }).trim();
  const repo = dry
    ? 'OWNER/REPO'
    : gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
  const existing = dry
    ? []
    : JSON.parse(gh('label', 'list', '--limit', '200', '--json', 'name')).map(
        l => l.name
      );
  const colours = {
    epic: '3e4b9e',
    'area: admin': '1d76db',
    'area: widget': '0e8a16',
    'area: email': 'fbca04',
    'area: config': '5319e7',
    'area: docs': '0075ca',
    'area: examples': 'c2e0c6',
    'size: S': 'e6e6e6',
    'size: M': 'bfbfbf',
    'size: L': '7f7f7f',
    'wave 1': 'b60205',
    'wave 2': 'd93f0b',
    'wave 3': 'e99695',
    'wave 4': 'f9d0c4',
    backlog: 'ededed',
  };
  for (const [name, color] of Object.entries(colours))
    if (!existing.includes(name)) gh('label', 'create', name, '--color', color);
  const numberOf = out => Number((out.match(/\/issues\/(\d+)/) || [])[1]);
  const selected = tickets.filter(t => waves.includes(t.wave));
  const epicNumbers = {};
  for (const [key, e] of Object.entries(epics)) {
    const children = selected.filter(t => t.epic === key);
    if (!children.length) continue;
    const body = `${e.body}\n\nThe issues below are tracked as sub-issues; the research behind them is in \`docs/gap-analysis-2026-10.md\`.`;
    epicNumbers[key] = numberOf(
      gh(
        'issue',
        'create',
        '--title',
        e.title,
        '--body',
        body,
        '--label',
        'epic'
      )
    );
    console.log(`${e.title} → #${epicNumbers[key] || '?'}`);
  }
  const numbers = {};
  for (const t of selected) {
    const body = `${t.body}\n\n${footer(
      t,
      id => `⟨${id}⟩`,
      key => `#${epicNumbers[key]}`
    )}`;
    numbers[t.id] = numberOf(
      gh(
        'issue',
        'create',
        '--title',
        t.title,
        '--body',
        body,
        ...t.labels.flatMap(l => ['--label', l])
      )
    );
    console.log(`${t.id} → #${numbers[t.id] || '?'}`);
  }
  // Sub-issues need the issue's database id, not its number.
  for (const t of selected) {
    const id = dry
      ? 0
      : gh('api', `repos/${repo}/issues/${numbers[t.id]}`, '--jq', '.id');
    gh(
      'api',
      '-X',
      'POST',
      `repos/${repo}/issues/${epicNumbers[t.epic]}/sub_issues`,
      '-F',
      `sub_issue_id=${id}`,
      '--silent'
    );
  }
  const ref = id =>
    numbers[id] ? `#${numbers[id]}` : `"${byId[id].title}" (not created)`;
  for (const t of selected) {
    const body = `${t.body}\n\n${footer(t, ref, key => `#${epicNumbers[key]}`)}`;
    gh('issue', 'edit', String(numbers[t.id] || 0), '--body', body);
  }
  console.log(
    `created ${Object.keys(epicNumbers).length} epics and ${selected.length} issues`
  );
} else {
  console.error(
    'usage: node build.mjs render <out.md> | create [--waves=1,2] [--dry-run]'
  );
  process.exit(1);
}
