# Setting up a link domain

How to put a client's own hostname (for example `go.clientbrand.com`) in front of their links.
Written for the instance owner and for agents helping with setup.

Last checked: 2026-11-11. The application side below was tested on a local server. The DNS and
certificate steps have **not** been run on a deployed instance yet; treat them as the plan, and
correct this page after the first real setup.

## What happens to a request

1. Someone opens `https://go.clientbrand.com/spring-sale`.
2. The client's DNS sends the request to your server.
3. Your reverse proxy answers with a certificate for `go.clientbrand.com` and passes the request
   to Umami **with the original host name**.
4. Umami finds the link with that slug on that domain, records the visit, and redirects to the
   destination.

Steps 1 and 4 need nothing from you. Steps 2 and 3 are set up once per domain.

## Steps

1. **Pick a subdomain with the client**, such as `go.` or `links.`. Do not use their main site's
   hostname: everything on a link domain except its links answers 404.
2. **Add it in Umami:** Links → Domains → type the hostname → Add. Or
   `POST /api/link-domains` (see `links-for-agents.md`).
3. **Client adds a DNS record** for that subdomain pointing at your server: a `CNAME` to your
   server's hostname, or an `A` record to its public IP address.
4. **Make your reverse proxy answer for it over HTTPS** (see the options below).
5. **Press "Check connection"** in the Domains dialog. "Connected" means DNS, the certificate and
   the routing all work.
6. **Assign links to the domain** in the link form (the Domain field appears once a domain
   exists). The table, the link page and the QR code then show the branded address.

## Certificates: options

The owner's instance runs behind Dokploy (told by the owner on 2026-11-11), so the first row is
the one that applies. The others are kept for a different setup.

| Setup | How a client domain gets HTTPS | Effort per domain |
| ----- | ------------------------------ | ----------------- |
| Dokploy (Traefik) | In the Umami service's Domains tab, add the client's hostname for the `umami` service on port 3000, with HTTPS on and the Let's Encrypt certificate. Then redeploy: for a Compose service, Dokploy applies domain changes only on deploy. The client's DNS record must already resolve, or the certificate request fails. | A few clicks and one redeploy |
| Nginx Proxy Manager | Add a Proxy Host for the client's hostname pointing at Umami and request a Let's Encrypt certificate on it. Works once the client's DNS record resolves. | A few clicks |
| Cloudflare Tunnel or proxy | Cloudflare only issues certificates for other people's hostnames through its "Cloudflare for SaaS" custom hostnames feature. The client points a `CNAME` at your fallback hostname. | Add one custom hostname |
| Caddy | On-demand TLS can issue a certificate the first time a new hostname is requested. It needs an endpoint that says whether a hostname is allowed; this fork does not provide one yet. | None after setup |

Whatever is used, the proxy must **forward the original host name** to Umami, in the `Host` or
`X-Forwarded-Host` header. Nginx Proxy Manager does this by default. If the header is replaced
with an internal name, Umami cannot tell which domain was asked for and the link answers 404.

## A short domain for all links

Separate from client domains. Setting `LINKS_URL` to a bare origin, for example
`https://go.example.com`, makes that host serve every link at `/<slug>`, and the interface shows
that address for links without a client domain. The same DNS and certificate steps apply to that
hostname. With a path in it (`https://example.com/q`), `LINKS_URL` only changes the address shown.

Record any change to `LINKS_URL` in Infisical and restart the server.

## Limits

- A slug is unique across the whole instance, so two domains cannot both have `/sale`.
- Slugs are at least 8 characters.
- Link domains do not work when the instance runs under a `BASE_PATH`.
- A domain belongs to one user or one team; only that owner's links can use it.
- A newly added domain can take up to 60 seconds to start answering when several server processes
  run.

## Troubleshooting

| Check connection says | Meaning | Look at |
| --------------------- | ------- | ------- |
| No answer over HTTPS | The name does not resolve, nothing answers on port 443, or the certificate is not valid for the name | The DNS record; the proxy's certificate for this hostname |
| The domain answers, but from a different server | Something else is served on that name, or the proxy does not pass the original host name | Where the DNS record points; the proxy's host header setting |

A link opens at its default address but 404s on the domain: the link is not assigned to that
domain. Edit the link and choose the domain.
