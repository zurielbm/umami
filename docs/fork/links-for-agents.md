# Creating and managing links as an agent

For an agent that needs to create, change or look up short links in a running instance of this
fork, without a person clicking through the interface.

**If you have the `umami` MCP server, use its tools** (see "MCP tools" below) instead of raw
requests. The rules on this page apply either way.

Last checked: 2026-11-11, against Umami v3.4.1. Creating, changing and listing links, and the
link-domain requests for a user's own domains, were run against a local instance of this fork.
Deleting a link and the team variants (`teamId`) were written from the route code and are covered
by unit tests only. If a request behaves differently, trust the
instance, fix this page, and tell the owner.

## What you need

- **The instance address**, for example `https://analytics.example.com`. Ask the owner; it is not
  recorded in this repository.
- **An API key.** A person creates it in the interface under Settings → API keys. It starts with
  `umami_`. API keys only exist on self-hosted instances.

Handle the key as a secret:

- Read it from an environment variable (`UMAMI_API_TOKEN` is the name the MCP server uses). Never
  write it into a file in the repository, a commit, a log or a chat message.
- A key can do everything its user can do. The owner intends agents to have their own non-admin
  user; if you were handed an admin's key, say so before using it.
- A key cannot reach account or admin routes (`/api/me/password`, `/api/me/api-keys`, `/api/2fa`,
  `/api/auth`, `/api/users`, `/api/admin`). A 401 on those is expected.

Send the key on every request:

```text
Authorization: Bearer umami_<key>
```

## Requests

All paths are relative to the instance address. Bodies and responses are JSON.

| Task | Request |
| ---- | ------- |
| List your links | `GET /api/links?search=<text>&page=1&pageSize=20` |
| List a team's links | `GET /api/teams/<teamId>/links` |
| Read one link | `GET /api/links/<linkId>` |
| Create a link | `POST /api/links` |
| Change a link | `POST /api/links/<linkId>` |
| Delete a link | `DELETE /api/links/<linkId>` |
| List link domains | `GET /api/link-domains` (add `?teamId=<teamId>` for a team's) |
| Add a link domain | `POST /api/link-domains` with `{"hostname":"go.clientbrand.com"}` (and `teamId` for a team) |
| Check a domain reaches this instance | `POST /api/link-domains/<domainId>/check` |
| Remove a link domain | `DELETE /api/link-domains/<domainId>` |

### Create

```bash
curl -sS -X POST "$UMAMI_URL/api/links" \
  -H "Authorization: Bearer $UMAMI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Spring promo","url":"https://example.com/sale","slug":"spring-promo"}'
```

| Field | Rule |
| ----- | ---- |
| `name` | Required. Up to 100 characters. Shown in the interface only. |
| `url` | Required. The destination. Up to 500 characters. Send a complete address starting with `https://`; the API does not check that it is a valid address, and a bad one produces a broken redirect. |
| `slug` | Required. 8 to 100 characters, unique across the whole instance. Use letters, digits and hyphens. |
| `teamId` | Optional. Set it to make the link belong to a team instead of your user. |
| `domainId` | Optional. The `id` of a link domain with the same owner as the link. The link then opens at `https://<hostname>/<slug>`. |

The response is the saved link, including its `id`. Keep the `id`; every later request needs it.

### Change

Send only the fields that change (`name`, `url`, `slug`, `domainId`), to
`POST /api/links/<linkId>`. Send `"domainId": null` to move a link back to the default address.

### List

The response is `{ "data": [...], "count": <total>, "page": 1, "pageSize": 20 }`. `search` matches
the name, destination and slug. Keep requesting the next `page` until you have `count` items.

## The address to hand out

```text
<base>/<slug>
```

`<base>` is the instance's `LINKS_URL` setting, or `<instance address>/q` when that is unset. Read
the current value from `GET /api/config` (field `linksUrl`); if the field is empty, use
`<instance address>/q`.

Example: `https://analytics.example.com/q/spring-promo`.

If the link has a `domainId`, hand out `https://<hostname>/<slug>` instead, using the hostname of
that domain from `GET /api/link-domains`. The default address keeps working as well.

## Link domains

A link domain lets a client's own hostname front their links. Adding one through the API only
registers the name; a person still has to point DNS at the server and arrange a certificate (see
[`link-domains.md`](link-domains.md)). So:

- Add a domain only when the owner asked for that hostname. Do not guess hostnames.
- After adding, call the check route. `{"connected":true}` means links on it work. `false` with
  `"reason":"unreachable"` means DNS or the certificate is not ready; `"other-server"` means the
  name points somewhere else. Report the result; do not retry in a loop.
- Do not assign a link to a domain that is not connected unless the owner says to; its branded
  address will not open until the domain is.
- A domain serves only the links assigned to it, and a link can only use a domain with the same
  owner (the same user, or the same team).

## QR codes

The interface has a QR button on the Links page and on each link's page, with PNG and SVG
downloads. The MCP tool `get_link_qr` returns the same code as SVG text or a base64 PNG, with a
file name. There is no plain API route for it; without MCP, generate the code yourself from the
address above, with error-correction level M and a 4-module margin (see `src/lib/qr.ts`).

**Counting scans separately from clicks.** A code normally holds the plain address, so a scan
and a click look the same. `get_link_qr` with `utmSource: "qr"` puts `?utm_source=qr` inside the
code; scans then appear under that UTM source in the link's statistics. Decide this before a
code is printed, because a printed code cannot be changed. The owner has not chosen a default;
ask.

## Before you create anything

- **Search first.** Look for an existing link to the same destination and reuse it instead of
  creating a duplicate.
- **Choose a readable slug** when the link is for people (`spring-promo`, not random characters),
  and check it is free by searching for it.
- **Report back** the name, the address to hand out, and the `id` of everything you created or
  changed.

## Things that go wrong

| What you see | Cause | What to do |
| ------------ | ----- | ---------- |
| 401 | Missing or wrong key, a revoked key, or a blocked route | Check the header; ask the owner for a new key. Do not retry in a loop. |
| 400 on create or change | A field broke a rule above, most often a slug under 8 characters | Fix the field. |
| 400 "That slug is already taken." on change | Another link has that slug | Pick another slug. |
| 400 "That domain cannot be used for this link." | The domain does not exist or belongs to a different user or team than the link | Use a domain from the same owner's list. |
| 400 "This domain is already used by this Umami instance." | The hostname is the instance's own address | Ask the owner for a different hostname. |
| 500 on create | Usually a slug that is already taken; create does not report this cleanly | Search for the slug. If it exists, pick another. Otherwise report the error. |
| Redirect still goes to the old destination after a change | When the instance uses Redis, each link is cached for up to 24 hours and a change does not clear it | Tell the owner. Do not delete and recreate the link to force it; that discards its statistics. |

## Do not

- **Delete a link without being asked.** Deletion is permanent and takes the link's address out of
  service for everyone who has it, including printed QR codes.
- **Change the slug of a link that is already in use.** The old address stops working at once.
- **Create links in bulk** (more than a handful) without the owner confirming the list first.
- **Remove a link domain without being asked.** Every branded address on it stops working at once,
  including printed QR codes; the links themselves survive at their default address.

## MCP tools

The instance has an MCP endpoint at `/mcp`, enabled with `MCP_ENABLED=1` and signed in with the
same API key. It offers the Umami team's read-only analytics tools (see `packages/mcp/README.md`)
plus this fork's link tools:

| Tool | What it does |
| ---- | ------------ |
| `list_teams` | Teams you belong to. A team is how links are filed under a company or client. |
| `list_link_domains` | Branded hostnames, yours or a team's (`teamId`). |
| `list_links` | Links with their public address, yours or a team's. Search here before creating. |
| `get_link` | One link. |
| `create_link` | Creates a link. `teamId` files it under a company; `domainId` puts it on that company's domain. Leave `slug` out for a random one. |
| `update_link` | Changes the name, destination or domain. It cannot change the slug. |
| `get_link_qr` | The QR code for a link, as SVG or PNG. |

- **Statistics for a link:** pass the link's `id` as `websiteId` to `get_website_stats`,
  `get_website_traffic` or `get_website_metrics`. A link is tracked like a website of its own.
- **Which company a link belongs to:** its `teamId`, and its `domain` when it has one. File a
  client's links under that client's team, not under your own user.
- **There is no tool that deletes a link, adds a domain or removes one.** Those stay with a
  person, in the interface.
- The link tools exist only on the instance's `/mcp` endpoint, not in the standalone
  `npx @umami/mcp` server.
- If your tool list has no `create_link`, the instance runs a build from before these tools.
  Tell the owner; do not fall back to raw requests without saying so.

Checked on 2026-11-11 against a local instance: every tool above, a scan recorded under
`utm_source=qr`, and the link's statistics read back through `get_website_stats`.
