# Agent guide for this fork

Read this before changing anything. It covers what is different about this repository; for how
Umami itself works, read `README.md` and the code.

Last checked: 2026-11-11, against Umami v3.4.1.

## What this repository is

A personal fork of [umami-software/umami](https://github.com/umami-software/umami) that adds a few
features of its own and keeps taking the Umami team's updates. Every choice below serves one goal:
merging the team's next release must stay easy.

| Remote     | Points at                  | Use                                             |
| ---------- | -------------------------- | ----------------------------------------------- |
| `origin`   | `zurielbm/umami`           | The fork. Push here.                            |
| `upstream` | `umami-software/umami`     | The Umami team. Fetch only; pushing is disabled. |

If `upstream` is missing in your checkout:

```bash
git remote add upstream https://github.com/umami-software/umami.git
git remote set-url --push upstream DISABLED
```

## Branches

- **`master` is an exact copy of `upstream/master`.** Never commit to it, never merge a feature
  into it, never force-push it. It only moves by fast-forward. This file does not exist on
  `master`, and that is intended.
- **`production` is the deploy branch.** It collects finished features plus the team's updates,
  and the owner's server builds from it (see `docs/fork/deploying.md`). Whatever is pushed there
  goes live at the owner's next deploy, so merge into it only what the owner asked to ship, and
  only after the checks below pass.
- **Feature branches** are named `feature/<short-name>`, one per feature. Branch them from
  `production`, which has this guide and the fork's features; `master` has neither.
- Do not open pull requests against `umami-software/umami` unless the owner asks.

### Taking the team's updates

Only when the owner asks for a sync.

```bash
git fetch upstream
git checkout master
git merge --ff-only upstream/master     # if this fails, stop and tell the owner; do not force it
git push origin master
git checkout production
git merge master                        # resolve conflicts, then run the checks below
```

After a sync, install dependencies again and rerun every check. Report what conflicted and how
you resolved it.

## Setup and checks

The repo requires pnpm 12.3.4 (`engines.pnpm`) and refuses other versions. Run the pinned version
through `npx` instead of changing the machine's global pnpm:

```bash
npx -y pnpm@12.3.4 install --frozen-lockfile

# Needed once before type checking or running tests. The placeholder URL is never connected to.
DATABASE_URL="postgresql://u:p@localhost:5432/db" npx -y pnpm@12.3.4 run generate:db:client
npx -y pnpm@12.3.4 run build:packages
```

Checks to run before saying work is done:

```bash
npx -y pnpm@12.3.4 exec biome check <files you changed>
npx -y pnpm@12.3.4 exec tsc --noEmit -p tsconfig.json
npx -y pnpm@12.3.4 exec vitest run              # whole suite, about two minutes
npx -y pnpm@12.3.4 exec vitest run <test file>  # one file
```

What to expect:

- **Skipping `build:packages`** makes `src/app/mcp/route.test.ts` fail to load and adds "cannot
  find module `@umami/mcp`" type errors. That is a setup gap, not a code failure.
- **Type errors that exist on plain v3.4.1:** two in `EventsTable.tsx`, one in
  `api/admin/users/[userId]/2fa/route.test.ts`, one in `src/app/mcp/route.ts`. Do not fix them
  here; fixing upstream's files creates merge conflicts. Report any error outside that list.
- **`hostUrl` is reported unused in `LinkEditForm.tsx`.** Leave it: the team's next release
  uses it again, and removing it would create a merge conflict.
- **Formatting complaints on lines you did not write** (for example the `LinksTable` function
  signature): leave them. Format only the lines you changed.
- **The test environment has no canvas.** Anything that draws to one must be stubbed in tests and
  checked in a real browser.
- **GitHub Actions is not a source of truth here.** Run the checks locally and report those
  results.

### Running the app locally

There is no shared development database or Infisical project for this repo yet (see Environment
variables). For a local check, use a throwaway Postgres container bound to loopback. Its
credentials are the public example values from `docker-compose.yml`, not secrets. Check first
whether one is already running (`docker ps`, port 54329) and whether a dev server already listens
on port 3000; reuse them instead of starting duplicates.

```bash
# Terminal 1: disposable database (data is lost when it stops)
docker run --rm --name umami-dev-db -e POSTGRES_DB=umami -e POSTGRES_USER=umami \
  -e POSTGRES_PASSWORD=umami -p 127.0.0.1:54329:5432 postgres:15-alpine

# Once: schema, database client, geo database
export DATABASE_URL="postgresql://umami:umami@127.0.0.1:54329/umami"
npx -y pnpm@12.3.4 exec prisma migrate deploy
npx -y pnpm@12.3.4 run generate:db:client
npx -y pnpm@12.3.4 run build:geo

# Terminal 2: dev server. Generate APP_SECRET into a file outside the repo; never print it.
APP_SECRET="$(cat /path/outside/repo/app_secret)" \
  npx -y pnpm@12.3.4 exec next dev --turbo -H 127.0.0.1 -p 3000
```

- First sign-in on an empty database is `admin` / `umami` (Umami's documented default).
- After changing `prisma/schema.prisma`, regenerate the client **and restart the dev server**. A
  running server keeps the old client and fails with "Unknown argument" or "undefined".
- Clicks from `curl` are not recorded (its user agent is treated as a bot). Send a browser
  `User-Agent` header when you need to see a visit in the database.
- `next dev` appends a block between `<!-- BEGIN:nextjs-agent-rules -->` markers to this file and
  re-adds it if removed. Leave it in place.
- To test a link domain without DNS, send the Host header yourself:
  `curl -i -H "Host: go.brand.test" http://127.0.0.1:3000/<slug>`.

## Keeping changes easy to sync

The Umami team edits this codebase daily. Each line changed in one of their files is a possible
conflict later.

- **Put new behaviour in new files.** Touch an existing file only to wire the new file in, with
  the smallest edit that works.
- **Before editing an existing file, check whether the team is changing it:**
  ```bash
  git fetch upstream
  git diff --stat upstream/master upstream/dev -- <path>
  ```
  If it shows changes, look for another place to hook in.
- **Do not reformat, rename, reorder or tidy the team's code**, even when a linter suggests it.
- **Text shown in the interface:** add the key to `src/components/messages.ts` and the English
  text to `public/intl/messages/en-US.json`. Leave the other locale files alone; missing keys fall
  back without an error.
- **Database changes** need the owner's approval first. Name fork migrations
  `fork_<nn>_<name>` (the first is `fork_01_add_link_domain`). The team numbers theirs
  (`26_…`, `27_…`); the `fork_` prefix sorts after every number, and a numbered migration that
  arrives later still applies on top (checked with `prisma migrate deploy`). In
  `schema.prisma`, put fork models next to the model they relate to, not at the end of the
  file, because the team appends new models there.
- **Exports:** add fork queries and permissions to `src/queries/prisma/index.ts` and
  `src/permissions/index.ts`, and import them from `@/queries/prisma` and `@/permissions` inside
  the team's route files. Their tests mock those two modules; a deep import bypasses the mock and
  breaks their test with "DATABASE_URL is not set".
- **API contracts:** a new route needs a `contract.generated.ts`. Running
  `pnpm openapi:contracts` creates it but also rewrites about 108 of the team's contract files.
  Restore those (`git checkout -- <file>` for every modified `contract.generated.ts` you did not
  mean to change), keep only the files for your routes, then run `pnpm generate:api`. Finish
  with `pnpm openapi:check --explicit` and `pnpm check:api:client`; both must pass.
- **There are two request proxies.** `src/proxy.ts` is used by builds made outside Docker. The
  Dockerfile replaces it with the team's `docker/proxy.ts`, so anything that exists only in
  `src/proxy.ts` is missing from the deployed image. Put proxy logic in a function under
  `src/lib/` (as `link-domain-proxy.ts` does) and call it from both files;
  `src/docker-proxy.test.ts` guards the call in `docker/proxy.ts`.
- **The proxy runs before every request it matches.** Keep it cheap and never let it throw. In
  `src/proxy.ts`, keep `/api/` out of the matcher: Next.js buffers the body of every request the
  proxy sees. The team's Docker proxy matches every path, including the tracking endpoint, so
  code called from it must not wait on the database for ordinary requests.
- **New dependencies:** avoid them. Check `package.json` first; for example `qrcode` was already
  installed.
- **Environment variables:** follow the owner's global rules. Any added, renamed or removed
  variable must be recorded in Infisical as part of the same work.

## Commits and pushes

- Commit or push only when the owner asks.
- No AI attribution anywhere: no `Co-Authored-By` trailers, no "Generated with" lines.
- One logical change per commit. Keep fork documentation separate from feature code where you can.

## What this fork adds

| Feature | State on 2026-11-11 | Where |
| ------- | ------------------- | ----- |
| QR code for a link | On `production`. Checked in a browser: dialog, PNG and SVG downloads, copy; the PNG decodes back to the link | `src/lib/qr.ts`, `src/app/(main)/links/LinkQRCodeButton.tsx` |
| Client-owned link domains | On `production`. Checked against a local server in dev and production builds, and in the Docker image | See "Link domains" below |
| Short link domain for the whole instance | On `production`. Checked in dev and production builds, not in the Docker image | `src/lib/link-domain-proxy.ts`, `LINKS_URL` |
| Link tools for the MCP server | Planned, not started | `packages/mcp/src/tools/` |

None of this has run on a deployed instance with real DNS or certificates yet.

How an agent creates and manages links in a running instance is in
[`docs/fork/links-for-agents.md`](docs/fork/links-for-agents.md). How to replace a running
official Umami container with this fork, and how to ship a later build, is in
[`docs/fork/deploying.md`](docs/fork/deploying.md).

Facts about links that are easy to get wrong:

- A link's public address is `<base>/<slug>`, where `<base>` is the `LINKS_URL` variable or, when
  that is unset, `<instance origin>/q`. Build it with the `useSlug('link')` hook, never by hand.
- The API rejects slugs shorter than 8 characters, although the form in the interface does not say
  so.
- The redirect route `src/app/(collect)/q/[slug]/route.ts` is being changed by the team. Do not
  edit it.
- Build a link's address with `useLinkUrl()` (`src/components/hooks/useLinkUrl.ts`), which knows
  about link domains. `useSlug('link')` only knows the default address.

### Link domains

A link domain is a hostname (for example `go.clientbrand.com`) owned by a user or a team. A link
with that `domainId` opens at `https://<hostname>/<slug>` and still works at its default address.

| Piece | File |
| ----- | ---- |
| Table `link_domain`, column `link.domain_id` | `prisma/schema.prisma`, `prisma/migrations/fork_01_add_link_domain` |
| Hostname rules and helpers (no database access) | `src/lib/link-domain.ts` |
| Queries | `src/queries/prisma/linkDomain.ts` |
| Who may add, remove and use a domain | `src/permissions/link-domain.ts` |
| Routing by hostname | `src/lib/link-domain-proxy.ts`, called from `src/proxy.ts` and `docker/proxy.ts`; cache in `src/lib/link-domain-hosts.ts` |
| Redirect and visit recording | `src/app/(collect)/ld/[hostname]/[slug]/route.ts` |
| API | `src/app/api/link-domains/` (list, add, remove, check connection) |
| Connection check | `src/lib/link-domain-check.ts` |
| Screens | `LinkDomainsButton.tsx`, `LinkDomainField.tsx` in `src/app/(main)/links/` |

Rules the code enforces, and tests cover:

- A domain serves only links that are assigned to it. Every other path on that hostname answers
  404, so the Umami app is never visible on a client's domain.
- A link may only use a domain with the same owner (same user, or same team).
- The instance's own hostnames (the one the request came in on, `LINKS_URL`, `PIXELS_URL`) cannot
  be added as link domains; doing so would make the app answer 404 on its own address.
- Removing a domain clears it from its links; they fall back to the default address.
- The proxy learns about a new or removed domain at once in the same process, and within about
  60 seconds in other processes (the list is refreshed in the background once it is a minute
  old).

Things that are easy to get wrong:

- When the server is bound to a `127.x` address (as the local dev command does), Next.js sends
  the proxy's rewrite back as a second HTTP request instead of handling it internally. That is why
  the hostname travels in the path (`/ld/<hostname>/<slug>`) and why the proxy lets that path
  through. Do not "simplify" either away.
- `LINKS_URL` as a bare origin (`https://go.example.com`) makes that host serve every link at
  `/<slug>`; pages that are not links still reach the app there. With a path
  (`https://example.com/q`) nothing changes.
- Link domains do not work when `BASE_PATH` is set.
- Slugs are still unique across the whole instance, so two domains cannot both have `/sale`.
- Setup steps for DNS and certificates are in
  [`docs/fork/link-domains.md`](docs/fork/link-domains.md).

## Environment variables

- Source of truth is the owner's Infisical instance. This repo has no `.infisical.json` and no
  project assigned yet, so there is nowhere to read values from. Ask the owner for the project ID,
  environment and folder; do not reuse another project's.
- Variables this fork's features depend on: `LINKS_URL` (link base address; a bare origin also
  turns that host into a short link host), `PIXELS_URL`, `MCP_ENABLED=1` (turns on `/mcp`). The
  fork has added no new variables.

## Open decisions

Ask the owner; do not assume an answer.

1. Which Infisical project holds the instance's variables. (Where it runs is settled: a VPS
   managed with Dokploy, as a Compose service; see `docs/fork/deploying.md`.)
2. Whether a QR code should add a marker such as `?src=qr` so scans count separately from clicks.
   Currently it does not.
3. Whether two clients on different domains may use the same slug. Currently slugs are unique
   across the whole instance.

## Keeping this file current

Update this file in the same change whenever you add a fork feature, change a branch or sync rule,
settle an open decision, or find that a command here no longer works. Change the "Last checked"
date when you do. Remove a statement that has stopped being true instead of adding a note beside
it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
