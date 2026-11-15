# GitHub

How a change travels from a branch to `main`: branches, commits, the test that
proves each change, pull requests, CI, tags and releases.

What may change, and what nobody is allowed to do, is [SYSTEM.md](SYSTEM.md).
How the code is shaped is [ARCHITECTURE.md](ARCHITECTURE.md). What a person sees
is [DESIGN.md](DESIGN.md). What each command does is the README's **Run it**.

The model is GitHub flow. `main` is the only branch that lives. Every change
reaches it through a pull request of its own, in whatever order changes are
finished, and every change a person gets is tagged with its own name.

> **This file describes where the repository is going, not everywhere it is.**
> The remote is `github.com/quentinheredia/livesongwars`, private, with the
> merge settings below applied, and the branch is `main`. What is still missing
> is CI, a lint that can run unattended, and the `test:fails-first` checker —
> so the rules here are held by the people merging and by nothing else.
> [docs/implementation/phase0.md](implementation/phase0.md) is that list, and
> every rule here with no tooling behind it says so where it is stated.

GitHub enforces none of this on the free plan: no branch protection, no
rulesets, and a push straight to `main` would be accepted. Every rule holds
because the person merging holds it. **GitHub settings** lists what to switch on
when the plan allows it.

---

## The life of a change

1. **A branch per change**, cut from `main`: `feat/cheer-trial`.
2. **A test that fails**, as the first commit on a `feat` or `fix` branch. It
   asks for what the change will make true, and fails because that is not true
   yet (*A test that fails first*).
3. **Commits on it**, as many as the work needs, until that test passes.
4. **A draft pull request** into `main` as soon as there is something to push,
   so CI runs on every push from then on.
5. **Ready for review** once the local checks pass and the documents the change
   moves have moved.
6. **Merged into `main` by squash**, once it is reviewed and CI is green against
   `main` as it is at that moment. The branch is deleted.
7. **Tagged** with the next number and the branch's slug: `v0.02-cheer-trial`.

Any number of branches are open at once, and each merges when it is ready. None
waits for another:

```
main   feat/cheer-trial   fix/apply-redirect   feat/event-panel
 o v0.01-first-night
 |-----+----------------------------------------+
 |     o                                        o
 |     o                                        o
 |-----|--------------------+                   o
 |     o                    o                   |
 o<----+ squash             |                   o
 | v0.02-cheer-trial        |                   |
 o<-------------------------+ squash            o
 | v0.02.1-apply-redirect                       o  rebased onto main
 o<---------------------------------------------+ squash
 | v0.03-event-panel
```

`feat/event-panel` was started first and merged last. The other two did not wait
for it, and it did not wait for them.

The tags are the list of what has shipped, in the order it reached `main`:

```
git tag --sort=v:refname
v0.01-first-night
v0.02-cheer-trial
v0.02.1-apply-redirect
v0.03-event-panel
```

Work bigger than one pull request — a phase in
[docs/implementation](implementation/) — is an issue or a milestone that pull
requests point at. It is never a branch that lives. A bug or an idea nobody has
started is an issue.

---

## Branches

`main` is the only branch that lives. Every commit on it came through a pull
request, passed CI, and runs with `npm start`: anything on it can ship. It is
never pushed to directly, never rebased and never force-pushed.

Everything else is a branch per change, named `<kind>/<slug>`, cut from `main`,
merged into `main`, and deleted.

| Kind | For | Tagged when it merges |
|---|---|---|
| `feat` | Something a person can now do, or the app can now model | Yes |
| `content` | A night: its card, its photographs, its result. Artist artwork, clips, the data in `src/data` that records them | Yes |
| `fix` | A bug | Yes |
| `refactor` | Structure, with behaviour unchanged | No |
| `docs` | Documents only | No |
| `ci` | The workflow, and scripts only CI runs | No |

The slug is kebab-case, and it becomes the tag's name when the branch merges, so
it names what a person gets, not the task: `feat/cheer-trial`,
`content/august-8-card`, `fix/apply-redirect`. Not `feat/parser-step-2`, not
`quentin/wip`, not `fix-2`.

**Cut from `main`**, freshly pulled.

**One concern.** A bug found on the way to a feature is its own branch, unless
the feature cannot pass without it.

**Independent.** No branch waits for another. Whichever is ready first merges
first, and the rest rebase onto `main` and carry on. A branch that needs
another's work before that work has merged is **stacked** (below); nothing else
ties two branches together.

**Days, not weeks.** A branch drifts further from `main` every day it lives, and
gets harder to merge. A feature too big for a few days lands in slices, each its
own pull request, each leaving `main` working and showing no one anything
unfinished: the resolver first, which no page calls yet, then the page that uses
it. A slice that cannot be hidden waits on its branch until there is a feature
flag to hide it behind (phase 0).

**Kept current by rebasing onto `main`.** A branch is its author's to rewrite;
`--force-with-lease` refuses if anyone else pushed to it in the meantime.

```bash
git fetch
git rebase origin/main
git push --force-with-lease
```

**Stacked**, when B needs A before A has merged: cut B from A and open B's pull
request against A. When A squash-merges and its branch is deleted, GitHub
retargets B's pull request to `main`, but B still carries A's original commits.
Drop them while A's local branch still exists, then push:

```bash
git rebase --onto origin/main feat/a feat/b
git push --force-with-lease
```

---

## Commits

**Subject**: `<area>: <what is now true>`. Lower case after the colon, no full
stop, under 72 characters. GitHub cuts a longer subject short and carries the
rest into the body, and a squash merge appends ` (#12)` to it.

The **area** is the part of the repository the change is for:

| Area | What is in it |
|---|---|
| `domain` | `src/domain` — pure rules: bracket, voting, reducer, csv, applications |
| `server` | `src/server`, `server.ts` — the store, the hub, persistence, asset resolution |
| `app` | `src/app` — routes, pages and API handlers |
| `components` | `src/components` — everything rendered |
| `data` | `src/data` — events, artists, venues, the catalogue |
| `lib` | `src/lib` — client-side helpers shared across components |
| `assets` | `src/assets`, `public/assets` — what was shot, and what is served |
| `scripts` | `scripts/` |
| `docs` | `docs/`, `README.md` |
| `ci` | the workflow |

A change across several takes the one it is for.

The subject says what is true afterwards, not what was done: `app: a browser
that has applied is sent into the site`, not `fix apply redirect bug`.

**Body**: a blank line, then *why*. The diff shows what changed; the message says
why it had to, and what was measured. Wrapped at about 80 columns. The messages
on this repository's history are the model: what was wrong, how it was measured,
and what the number was afterwards.

**Trailers**: `Co-Authored-By:` for everyone who wrote the change, Claude
included.

**Never committed**: secrets or a `.env` (only `.env.example`); the live event
snapshot (`data/` is ignored); raw footage (`src/assets/**/Videos/` is ignored);
a lockfile change without the `package.json` change that caused it.

**Commits that stay apart.** A republished asset set (`node scripts/publish-photos.mjs`)
and a formatter run over files the change does not otherwise touch each go in a
commit of their own, with the reason. A reader must be able to tell an intended
change from an accident. A pull request that holds one merges by **rebase**
rather than squash (*Merging*), so that the commit survives.

---

## A test that fails first

Every `feat` and `fix` branch carries a test that fails before the change and
passes after it. The two results together are the proof that the branch does
what its name says. A test that already passes without the change proves nothing
about the change.

- **It is the branch's first commit**, on its own, before any of the code it
  tests: `domain: a test for a vote too close to call`. That commit is `main`
  plus the test, so checking it out is what "before" means. On `main` it never
  stands alone: a squash folds it into the change, because every commit on
  `main` passes.
- **It tests what the branch's name says**, at the level a person or the app
  shows it. For `feat/cheer-trial` that is the trial refusing to call a vote
  inside `TIE_MARGIN_DB`, not a helper on the way there. The unit tests written
  along the way come on top of it and do not replace it.
- **A fix's test is the bug.** It fails on `main` the way the report describes,
  and the fix makes it pass.
- **It fails because the change is missing.** It fails on an assertion that the
  behaviour is not there, or because something the change adds does not exist
  yet (not compiling counts as failing). A failure from a typo says nothing
  about the change, so read what the test printed.
- **It stays.** Once merged it is an ordinary test on `main`, and it fails again
  if the change is ever undone.

> **There is no `npm run test:fails-first` yet.** The rule is enforced by the
> author and the reviewer reading the two runs. The checker — check out the
> first commit, run the test, require a failure; do the same on the last commit,
> require a pass — is a phase 0 item.

A branch whose first commit came out wrong is rewritten so the test comes first.
A branch is its author's to rewrite:

```bash
git reset --soft origin/main
git commit -m "domain: a test for a vote too close to call" -- tests/voting.test.ts
git commit -m "domain: a vote inside the margin is not called"
git push --force-with-lease
```

The reset keeps the branch's whole change staged. The first commit takes only
the paths it names, and the second takes the rest.

The other kinds:

- **`content`** has no test. What proves it is the data it records being read
  off the artefact — a poster, a card, a photograph — and said so in the pull
  request. A night's roster is checked by `tests/catalogue.test.ts`, which
  counts what the catalogue holds rather than a number typed by hand.
- **`refactor`** has the opposite rule: its tests pass before and after,
  unchanged. That is what shows it changed nothing.
- **`docs`** and **`ci`** have none.

A `feat` that can only be seen, such as a layout or a colour, gives a test
nothing to fail on. One of its commits says so in a trailer, which the reviewer
accepts:

```
No-failing-test: the champion badge's placement; screenshots in the pull request
```

The screenshots, before and after, stand in for the test. The trailer is never a
way past a test that would have failed. Measurements taken in the browser —
a box that overflowed, an LCP, a file that downloaded when it should not have —
go in the pull request whether or not there is a test, because they are the
evidence the change worked.

---

## Before a pull request is ready

```bash
npm run typecheck
npm test
npx cross-env NEXT_DIST_DIR=.next-verify next build
```

`NEXT_DIST_DIR` is not optional. A plain `npm run build` writes `.next`, which
is the directory a running `npm run dev` is serving from, and overwriting it
makes the dev server serve chunks that no longer exist. The verification build
goes somewhere else.

`next build` rewrites `tsconfig.json` to add the types path of whatever
directory it just wrote. Both `.next/types` and `.next-verify/types` are listed
in `include` already, so it now finds them there and writes nothing — and CI
fails if the build leaves the working tree dirty at all, which is what used to
happen every time and get put back by hand.

Then, by what the change touches:

| If the change | Then also |
|---|---|
| Is a `feat` or `fix` | Its failing test, and the failure it printed, read |
| Touches `src/domain` | The tests for that module; these are pure and have no excuse to be untested |
| Changes what a person sees | Screenshots in the pull request, and the box measured in the browser rather than guessed |
| Adds or changes an asset | `node scripts/publish-photos.mjs`, in its own commit, with its output quoted |
| Changes a rule in SYSTEM.md | SYSTEM.md, in the same pull request. The decisions do not move without that file moving first |
| Changes the shape of the code | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Changes what a person sees, structurally | [DESIGN.md](DESIGN.md), including the reason |
| Adds an environment variable | `.env.example` |
| Adds a route | SYSTEM.md's **Routes** |
| Changes the event's shape | The CSV columns in `src/domain/csv.ts`, and whether an old snapshot still restores |

---

## Pull requests

### Opening one

```bash
gh pr create --draft --title "<area>: <what is now true>"
```

**Title**: the subject the squash will write, so it follows the commit rules.

**Draft first**, as soon as there is something to push: CI runs on every push
from then on, and the diff is there to look at. Marked ready with `gh pr ready`
once the checks above pass.

**Size**: one concern, small enough to review in one sitting — a few hundred
lines of hand-written change, not counting published assets and lockfiles. A
refactor and the behaviour change it makes room for are two pull requests, the
refactor first: its tests pass unchanged, which is what shows it changed
nothing.

**Description**:

```markdown
One paragraph: what is true once this merges that was not before, and why it is
wanted.

Closes #<issue>.

## What is in it

- ...

## Checks

The test that fails first: its name, the failure it printed on the branch's
first commit, and that it passes now. What else ran locally and what it
reported. For a change a person sees: screenshots, and anything measured in the
browser.

## Not in it

What is left for later, and where it is tracked. "Nothing" is an answer.
```

`Closes #<issue>` closes the issue when the pull request merges. A slice of a
bigger piece of work says `Part of #<issue>` instead, which links to it without
closing it.

**Read the diff on GitHub before asking anyone to.** "Files changed" is a
different view from the editor, and most slips show there: a debugging print, a
stray file, a published asset that changed for no reason, another session's work
swept in by `git add -A`.

### Review

What the reviewer reads for, in this order:

1. **SYSTEM.md, Restrictions**: honesty (null is not zero, nothing illustrative),
   determinism, the asset conventions, accessibility. A break here blocks the
   merge, whatever else is good.
2. **Correctness**: the tests cover the change; a `feat` or `fix` has a test
   that fails without it, and fails for that reason.
3. **The documents the change moves** (the table above).
4. **SYSTEM.md, Code**: names that carry the logic, one reason to change, no
   function added where one exists.

Formatting is not a review topic.

A comment says what and why. One that is a matter of taste starts `nit:` and
does not block. The author answers every comment, with a change or a reason;
whoever opened a thread resolves it.

With no second person, the author reads the diff on GitHub after a break, and
`/code-review` in Claude Code reads it too. The pull request's Checks section
says which review it had.

### Merging

A pull request merges when:

- **CI is green.** Typecheck, tests, build.
- **It is reviewed**, and every comment is answered.
- **CI passed against `main` as it is now.** With several branches merging in
  any order, two pull requests can each be green against the `main` they started
  from and break it together: one renames what the other calls. If anything has
  merged since CI last ran, the branch is updated and CI runs again.
- **`main` itself is green.** Nothing merges onto a red `main` except what makes
  it green (*When `main` breaks*).

The author merges, tags it if it is a `feat`, `content` or `fix`, and GitHub
deletes the branch.

| Pull request | Method | Why |
|---|---|---|
| Any | **Squash** | One commit per pull request on `main`, its message written once, at merge. `git log main` reads as the list of changes, and taking one back out is one revert |
| One holding a commit that must stay apart | **Rebase and merge**, after tidying the branch so every commit has a written message and none fails: the test that fails first is folded into the change it tests | A squash would fold a republished asset set into the change that caused it |

There are no merge commits: `main` stays a straight line, which is what keeps a
revert or a `git bisect` simple.

The squash message starts as the pull request's title and description. Before
confirming, cut what only matters on GitHub — the Checks section, screenshots —
and keep the first paragraph, `Closes`, and the `Co-Authored-By:` trailers.

### When CI fails

- `gh pr checks` lists the jobs; `gh run view <run-id> --log-failed` prints the
  failing step's log.
- A test that passes locally and fails in CI is usually a file the run does not
  have: `data/` is ignored, and so is raw footage. A test that depends on either
  is a test that will fail in CI.
- A test that fails and then passes on a re-run is a bug, in the test or the
  code. One re-run to confirm it; after that it is an issue, not a habit.
- Pushing again cancels the run still going for that pull request.

---

## Tags and releases

Every `feat`, `content` and `fix` pull request is tagged when it merges, with
the branch's slug. The list of tags is then the list of what has shipped, in the
order it reached `main`.

| Branch | Tag | Example |
|---|---|---|
| `feat/…`, `content/…` | The next number, then the slug | `feat/event-panel`, merged after `v0.02.1-apply-redirect`, is `v0.03-event-panel` |
| `fix/…` | The last number with a patch number added, then the slug | `fix/apply-redirect`, merged after `v0.02-cheer-trial`, is `v0.02.1-apply-redirect` |
| `refactor/…`, `docs/…`, `ci/…` | None | Nothing a person uses changed. They are in `git log`, not in the tag list |

Numbers are handed out at merge, not when a branch is cut. That is what lets
changes finish in any order: whichever merges next takes the next number. The
numbers count on from `v0.01`; when they reach `1.0` is a person's decision, not
this file's.

The person who merges tags it straight away, before anything else merges:

```bash
git switch main
git pull --tags
git describe --tags --abbrev=0
gh pr view <n> --json mergeCommit --jq .mergeCommit.oid
git tag -a v0.03-event-panel <commit> -m "v0.03-event-panel: <pull request title> (#<n>)"
git push origin v0.03-event-panel
gh release create v0.03-event-panel --verify-tag --generate-notes
```

`git describe` prints the last tag, which the new number follows. The tag goes
on the pull request's own squash commit, which `gh pr view` prints, not on
whatever `main` has reached since. The release lists the pull request, who wrote
it, and the diff since the tag before.

A tag is never moved and never reused. A fix after it is a new tag.

---

## When `main` breaks

CI runs again on every push to `main`. When it goes red, making it green again
comes before anything else merges:

1. **Revert the pull request that broke it.** The merged pull request's page has
   a Revert button, which opens the revert as a pull request of its own. It
   merges like any other once CI is green, and it is tagged as a fix if what it
   takes out was tagged: `v0.03.1-revert-event-panel`, so the tag list says the
   change left.
2. **The fix comes back as a new pull request**, with a test that would have
   caught it.

Revert first, fix after, rather than a fix on top of a red `main`: the revert is
known to work, and the fix is not yet.

An urgent fix is a `fix/` branch like any other, reviewed first. There is no
separate path.

**During a show, none of this applies.** The event runs off whatever is already
deployed. A night is not the time to merge anything; the snapshot at
`data/event.csv` is the recovery path, not a hotfix.

---

## GitHub settings

On the free plan, under **Settings → General → Pull Requests**:

- Allow **squash** merging and **rebase** merging; not merge commits.
- Squash default commit message: **pull request title and description**.
- **Automatically delete head branches**: on.
- **Always suggest updating pull request branches**: on.

The same from the command line:

```bash
gh repo edit --enable-merge-commit=false --enable-rebase-merge --enable-squash-merge \
  --squash-merge-commit-message pr-title-description \
  --delete-branch-on-merge --allow-update-branch
```

When the repository is public or on GitHub Pro, the rules above become GitHub's
to enforce:

- A **branch ruleset on `main`**: require a pull request (no approvals while
  there is one person, one when there are two); require the checks named in
  *Merging*, with the branch up to date; require a linear history; block force
  pushes and deletion.
- A **tag ruleset on `v*`**: block updates and deletion. A tag is never moved.

---

## Open

These belong to a person, not to this file.

- **Deploys.** Nothing deploys today. The usual shape once something does: every
  merge to `main` deploys to a staging environment, and a person promotes a tag
  from there to production. The app is one process — Next and `ws` on one port —
  so it needs a host that keeps a process alive, not a serverless one; see
  ARCHITECTURE.md.
- **Tagging by hand.** A person can forget. A workflow on each push to `main`
  could read the merged branch's kind and slug and tag it, so that no merge is
  left out of the list.
- **Two people editing at once.** This has already happened in this repository
  and cost a commit that swallowed another session's work. Branches are the
  answer, which is most of why this file exists.
