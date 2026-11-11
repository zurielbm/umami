# Deploying this fork with Docker

For whoever replaces a running official Umami container with this fork, or ships a new build of
the fork. The database stays where it is; only the app container changes.

Last checked: 2026-11-11, on the development server with throwaway containers. A database created
by the official `ghcr.io/umami-software/umami:postgresql-latest` image (v3.4.1) was handed to an
image built from this fork, then handed back to the official image. Every step below was run
there. The owner then made the switch on their VPS through Dokploy the same day (backup, then
the Dokploy steps below) and confirmed the app and its `/mcp` endpoint work.

## What the switch does

- The fork is Umami v3.4.1 plus the fork's features. It uses the same database, the same
  environment variables and the same port (3000) as the official image.
- On first start it applies one extra migration, `fork_01_add_link_domain`: a new, empty
  `link_domain` table and a nullable `domain_id` column on `link`. No existing row is changed.
- Websites, visits, users, links and their statistics carry over. Existing `/q/<slug>` addresses
  keep working.
- Going back is possible: the official v3.4.1 image starts on the migrated database, reports "No
  pending migrations", and ignores the extra table and column.

Do not start the switch from memory. Ask the owner first; it restarts their analytics.

## The owner's server: Dokploy

The owner's VPS runs Umami as a Docker Compose service in Dokploy, with the compose file pasted
in (not read from a repository) and one environment variable, `APP_SECRET`. On that server the
switch is steps 3 and 5 below plus this, instead of steps 1, 2 and 4:

1. In the **existing** Umami service in Dokploy, replace the `image:` line of the `umami` service
   with these two lines, and change nothing else:

   ```yaml
       build: https://github.com/zurielbm/umami.git#production
       image: umami-fork:latest
   ```

2. Press Deploy. Dokploy's deploy command is `docker compose ... up -d --build`, so it downloads
   the branch, builds the image on the VPS and restarts the app container.
3. To ship a later version, push to `production` and press Deploy again.

- **Edit the existing service; never create a new one for this.** The database volume is named
  after the Dokploy service, so a new service starts with an empty database.
- **Do not switch the service to read the compose file from this repository.** The repository's
  `docker-compose.yml` uses a different volume name and publishes a port, which would also start
  an empty database.
- The build used about 4 GB of memory on the development server. If the VPS has less free, the
  build fails or the server starts killing processes; use steps 1, 2 and 4 instead and build
  elsewhere.
- **A variable set in Dokploy's Environment tab does nothing by itself.** That tab only fills
  `${NAME}` placeholders in the compose file. To give the app a variable, list it under the
  `umami` service's `environment:` as well (for example `MCP_ENABLED: "1"`, or
  `LINKS_URL: ${LINKS_URL}`), then deploy. Found on the owner's server: `/mcp` answered 404
  until `MCP_ENABLED` was added to the compose file.
- Building from a Git address was checked on the development server (a copy of the branch served
  over `git://`): the image built, started and served a branded link. The owner's Dokploy
  service builds the same way.
- Dokploy's Traefik sits in front of the container; the service's Domains tab holds the
  hostnames it answers for. Client domains are added there too, see
  [`link-domains.md`](link-domains.md).

## 1. Build the image

GitHub Actions and GitHub Packages are not available on the owner's account (see the global agent
rules), so the image is built locally and copied to the server. Do not publish it to a registry.

Build from a committed tree, so the tag says exactly what is running:

```bash
cd /path/to/this/repo
git status --short            # must be empty
TAG="$(git rev-parse --short HEAD)"
docker build -t umami-fork:"$TAG" .
```

- The build takes about five minutes on the development server and downloads the geo database,
  so it needs internet access.
- The image is about 1 GB.
- The build log must list `ƒ Proxy (Middleware)`, `/ld/[hostname]/[slug]` and
  `/api/link-domains`. If it does not, the link-domain routing is missing; stop.

## 2. Copy the image to the server

```bash
docker save umami-fork:"$TAG" | gzip | ssh <user>@<server> 'gunzip | docker load'
```

Building on the server instead (`git clone`, then the same `docker build`) also works, but the
Next.js build needs several GB of memory and can be killed on a small VPS. That path was not
tried.

## 3. Back up the database

On the server, in the folder that holds the compose file:

```bash
docker compose exec -T db pg_dump -U umami umami > umami-backup-$(date +%F).sql
ls -l umami-backup-*.sql      # must not be empty
```

Also note the version that is running now, in case you need to go back to exactly that image:

```bash
docker compose exec umami node -p "require('./package.json').version"
```

If it prints something older than 3.4.1, the switch is also an Umami upgrade: the Umami team's
own migrations between that version and 3.4.1 run first. That path was not tested here, and
going back to an image older than 3.4.1 afterwards is not safe. Tell the owner before going on.

## 4. Change the image and restart the app

In the compose file, change one line of the `umami` service and leave everything else, including
`APP_SECRET`, the `db` service and the volume:

```yaml
services:
  umami:
    image: umami-fork:<tag>     # was ghcr.io/umami-software/umami:postgresql-latest
```

```bash
docker compose up -d umami
docker compose logs umami | head -20
```

- `up -d umami` recreates only the app container. The database container and its volume are not
  touched. Never run `docker compose down -v`; `-v` deletes the database.
- Keep `APP_SECRET` unchanged. Changing it signs everyone out, splits returning visitors into new
  ones, and invalidates link-domain connection checks.
- `DATABASE_TYPE` is no longer read; leaving it in does no harm.
- The log must show ``Applying migration `fork_01_add_link_domain` `` on the first start and
  `✓ Database is up to date.` on every start.

## 5. Check

- Sign in, open a website and confirm its past data is there.
- Open an existing link (`/q/<slug>`) and confirm it redirects.
- On the Links page, confirm the QR and Domains buttons appear.

Client domains need more than the image: DNS, a certificate, and a reverse proxy that passes the
client's hostname through. See [`link-domains.md`](link-domains.md).

## Going back

Put the previous `image:` line back and run `docker compose up -d umami`. Links that were assigned
to a client domain keep working at their `/q/<slug>` address; the branded addresses stop.

If the data itself is wrong, restore the backup instead. This replaces everything recorded since
the backup, so ask the owner first:

```bash
docker compose stop umami
docker compose exec -T db psql -U umami -d postgres -c 'DROP DATABASE umami' -c 'CREATE DATABASE umami'
docker compose exec -T db psql -U umami -d umami < umami-backup-<date>.sql
docker compose up -d umami
```

The restore commands above are standard Postgres but were not run during the check.

## Shipping a later build

Repeat steps 1 to 4 with the new tag. Keep the previous image on the server until the new one has
been checked, so going back is one line.

## Environment variables

The fork adds none. Optional ones its features use: `LINKS_URL`, `MCP_ENABLED=1`. Any variable
added to the deployment must also be recorded in the owner's Infisical instance; this repo has no
Infisical project assigned yet (see `AGENTS.md`).
