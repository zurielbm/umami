// Fork: MCP tools for short links, their branded domains and QR codes. The team's analytics
// tools live in packages/mcp and are read-only; these are defined here so that package stays
// untouched, and are added to the endpoint in src/app/mcp/route.ts.
//
// Every tool goes through the same API routes, and so the same permission checks, as the
// interface. There is deliberately no tool that deletes a link or a domain.
import { isUmamiApiError, UmamiClient } from '@umami/api-client';
import {
  type AnyToolDefinition,
  allTools,
  McpToolError,
  type ToolContext,
  type ToolDefinition,
} from '@umami/mcp';
import { z } from 'zod';
import { getRandomChars } from '@/lib/generate';
import { getLinkAddress } from '@/lib/link-url';
import { getQrFileName, getQrSvg } from '@/lib/qr';
import { getQrPngBuffer } from '@/lib/qr-server';
import { createLinkFetch } from './link-dispatch';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PNG_SIZE = 512;
const MAX_PNG_SIZE = 2048;

const WRITE = { readOnlyHint: false, idempotentHint: false, destructiveHint: false };

interface LinkRow {
  id: string;
  name: string;
  url: string;
  slug: string;
  userId?: string | null;
  teamId?: string | null;
  domainId?: string | null;
  createdAt?: string | null;
}

interface DomainRow {
  id: string;
  hostname: string;
  teamId?: string | null;
}

interface TeamRow {
  id: string;
  name: string;
}

interface Page<T> {
  data?: T[];
  count?: number;
  page?: number;
  pageSize?: number;
}

function defineTool<Schema extends z.ZodObject<z.ZodRawShape>>(
  definition: ToolDefinition<Schema>,
): AnyToolDefinition {
  return definition as unknown as AnyToolDefinition;
}

/** The team's client can only reach analytics routes; this one reaches the link routes. */
function getLinkClient(client: ToolContext['client']) {
  return new UmamiClient({
    baseUrl: client.baseUrl,
    headers: client.headers,
    fetch: createLinkFetch(),
  });
}

function getOrigin(client: ToolContext['client']) {
  return client.baseUrl.replace(/\/api\/?$/, '');
}

/** Hostnames of the link domains the given links use, looked up once per owner. */
async function getDomains(api: UmamiClient, links: LinkRow[]): Promise<DomainRow[]> {
  const owners = new Set<string | undefined>();

  for (const link of links) {
    if (link.domainId) {
      owners.add(link.teamId ?? undefined);
    }
  }

  const lists = await Promise.all(
    [...owners].map(teamId => api.getLinkDomains(teamId ? { teamId } : {}) as Promise<DomainRow[]>),
  );

  return lists.flat();
}

function describeLink(link: LinkRow, origin: string, domains: DomainRow[]) {
  return {
    id: link.id,
    name: link.name,
    address: getLinkAddress(link, { origin, domains }),
    destination: link.url,
    slug: link.slug,
    teamId: link.teamId ?? null,
    domain: domains.find(({ id }) => id === link.domainId)?.hostname ?? null,
    createdAt: link.createdAt ?? null,
  };
}

function pageInfo(result: Page<unknown>) {
  const page = result.page ?? 1;
  const pageSize = result.pageSize ?? DEFAULT_PAGE_SIZE;
  const count = result.count ?? 0;

  return { page, pageSize, count, hasMore: page * pageSize < count };
}

const destination = z
  .string()
  .max(500)
  .refine(value => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Must be a complete address starting with https:// or http://.');

export const listTeams = defineTool({
  name: 'list_teams',
  title: 'List teams',
  description:
    'Lists the teams the authenticated user belongs to, with each team ID and name. A team is how links are ' +
    'filed under a company or client: pass its ID as teamId to list_links or create_link.',
  inputSchema: z.object({}),
  async handler(_input, { client }) {
    const result = (await getLinkClient(client).getMyTeams({
      pageSize: MAX_PAGE_SIZE,
    })) as Page<TeamRow>;

    return { teams: (result.data ?? []).map(({ id, name }) => ({ id, name })) };
  },
});

export const listLinkDomains = defineTool({
  name: 'list_link_domains',
  title: 'List link domains',
  description:
    "Lists the branded hostnames (for example go.clientbrand.com) that links can open on. Without teamId, the user's " +
    "own domains; with teamId, that team's. Pass a domain ID as domainId to create_link or update_link. A link can " +
    'only use a domain with the same owner as the link.',
  inputSchema: z.object({
    teamId: z.string().uuid().optional().describe('Team ID from list_teams.'),
  }),
  async handler(input, { client }) {
    const domains = (await getLinkClient(client).getLinkDomains(
      input.teamId ? { teamId: input.teamId } : {},
    )) as DomainRow[];

    return {
      domains: domains.map(({ id, hostname, teamId }) => ({
        id,
        hostname,
        teamId: teamId ?? null,
      })),
    };
  },
});

export const listLinks = defineTool({
  name: 'list_links',
  title: 'List links',
  description:
    "Lists short links with their public address, destination and owner. Without teamId, the user's own links; " +
    "with teamId, that team's links. Search before creating a link so an existing one is reused. Results are paginated.",
  inputSchema: z.object({
    teamId: z.string().uuid().optional().describe('Team ID from list_teams.'),
    search: z.string().optional().describe('Matches the name, destination and slug.'),
    page: z.number().int().positive().optional().describe('Page number, starting at 1.'),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe(`Results per page (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}).`),
  }),
  async handler(input, { client }) {
    const api = getLinkClient(client);
    const query = {
      search: input.search,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
    };
    const result = (
      input.teamId
        ? await api.getTeamLinks({ teamId: input.teamId, ...query })
        : await api.getLinks(query)
    ) as Page<LinkRow>;
    const links = result.data ?? [];
    const domains = await getDomains(api, links);

    return {
      links: links.map(link => describeLink(link, getOrigin(client), domains)),
      ...pageInfo(result),
    };
  },
});

export const getLink = defineTool({
  name: 'get_link',
  title: 'Get link',
  description:
    'Returns one short link: its public address, destination, owner and branded domain. To see how many people ' +
    'opened it, pass the link ID as websiteId to get_website_stats, get_website_traffic or get_website_metrics; ' +
    'a link is tracked like a website of its own.',
  inputSchema: z.object({
    linkId: z.string().uuid().describe('Link ID from list_links or create_link.'),
  }),
  async handler(input, { client }) {
    const api = getLinkClient(client);
    const link = (await api.getLink({ linkId: input.linkId })) as LinkRow;

    return { link: describeLink(link, getOrigin(client), await getDomains(api, [link])) };
  },
});

export const createLink = defineTool({
  name: 'create_link',
  title: 'Create link',
  description:
    'Creates a short link and returns its public address. This changes data. Search with list_links first and reuse ' +
    'an existing link to the same destination. Set teamId to file the link under a company (see list_teams), and ' +
    'domainId to make it open on that company’s branded domain (see list_link_domains). Every visit is then counted ' +
    'against this link. Call get_link_qr afterwards for a QR code.',
  annotations: WRITE,
  inputSchema: z.object({
    name: z.string().min(1).max(100).describe('Label shown in Umami, for example "Spring promo".'),
    url: destination.describe('Where the link sends people. A complete address, https://…'),
    slug: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,100}$/)
      .optional()
      .describe(
        'The last part of the address: 8 to 100 letters, digits, hyphens or underscores, unique across the ' +
          'instance. Choose a readable one for links people will see. Omit for a random one.',
      ),
    teamId: z.string().uuid().optional().describe('Team that owns the link. Omit for your own.'),
    domainId: z
      .string()
      .uuid()
      .optional()
      .describe('Link domain to open on. Must have the same owner as the link.'),
  }),
  async handler(input, { client }) {
    const api = getLinkClient(client);
    let link: LinkRow;

    try {
      link = (await api.createLink({
        name: input.name,
        url: input.url,
        slug: input.slug ?? getRandomChars(9),
        ...(input.teamId ? { teamId: input.teamId } : {}),
        ...(input.domainId ? { domainId: input.domainId } : {}),
      })) as LinkRow;
    } catch (error) {
      // The API answers a taken slug with a bare 500.
      if (input.slug && isUmamiApiError(error) && error.status === 500) {
        throw new McpToolError(
          'invalid_input',
          `Could not create the link. The slug "${input.slug}" is probably already taken; choose another.`,
        );
      }

      throw error;
    }

    return { link: describeLink(link, getOrigin(client), await getDomains(api, [link])) };
  },
});

export const updateLink = defineTool({
  name: 'update_link',
  title: 'Update link',
  description:
    'Changes the name, destination or branded domain of a short link. This changes data. The address people already ' +
    'have keeps working: the slug cannot be changed here, because that would break printed QR codes. Send only the ' +
    'fields that change. Send domainId null to move the link back to the default address.',
  annotations: { ...WRITE, idempotentHint: true },
  inputSchema: z.object({
    linkId: z.string().uuid().describe('Link ID from list_links or create_link.'),
    name: z.string().min(1).max(100).optional().describe('New label.'),
    url: destination.optional().describe('New destination. A complete address, https://…'),
    domainId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('Link domain to open on, or null for the default address.'),
  }),
  async handler(input, { client }) {
    const { linkId, name, url, domainId } = input;

    if (name === undefined && url === undefined && domainId === undefined) {
      throw new McpToolError('invalid_input', 'Nothing to change: send name, url or domainId.');
    }

    const api = getLinkClient(client);
    const link = (await api.updateLink({
      linkId,
      ...(name !== undefined ? { name } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(domainId !== undefined ? { domainId } : {}),
    })) as LinkRow;

    return { link: describeLink(link, getOrigin(client), await getDomains(api, [link])) };
  },
});

export const getLinkQr = defineTool({
  name: 'get_link_qr',
  title: 'Get link QR code',
  description:
    'Returns a QR code that opens a short link, as SVG markup or as a base64-encoded PNG, with a suggested file ' +
    'name. Write the svg text (or the decoded png) to a file to hand it over. The code holds the link’s public ' +
    'address, so scans are counted against the link like any other visit. Set utmSource (for example "qr") to ' +
    'count scans separately from clicks on the same link: they then appear under that UTM source.',
  inputSchema: z.object({
    linkId: z.string().uuid().describe('Link ID from list_links or create_link.'),
    format: z.enum(['svg', 'png']).optional().describe('Image format (default svg).'),
    size: z
      .number()
      .int()
      .min(128)
      .max(MAX_PNG_SIZE)
      .optional()
      .describe(
        `PNG width in pixels (default ${DEFAULT_PNG_SIZE}). Ignored for svg, which scales.`,
      ),
    utmSource: z
      .string()
      .regex(/^[A-Za-z0-9_.-]{1,50}$/)
      .optional()
      .describe('Adds ?utm_source=<value> to the address inside the code.'),
  }),
  async handler(input, { client }) {
    const api = getLinkClient(client);
    const link = (await api.getLink({ linkId: input.linkId })) as LinkRow;
    const address = getLinkAddress(link, {
      origin: getOrigin(client),
      domains: await getDomains(api, [link]),
    });
    const encoded = input.utmSource ? `${address}?utm_source=${input.utmSource}` : address;
    const format = input.format ?? 'svg';
    const base = { linkId: link.id, name: link.name, address, encoded, format };

    if (format === 'png') {
      const size = input.size ?? DEFAULT_PNG_SIZE;
      const png = await getQrPngBuffer(encoded, size);

      return {
        ...base,
        mimeType: 'image/png',
        fileName: getQrFileName(link.name, 'png'),
        size,
        pngBase64: png.toString('base64'),
      };
    }

    return {
      ...base,
      mimeType: 'image/svg+xml',
      fileName: getQrFileName(link.name, 'svg'),
      svg: await getQrSvg(encoded),
    };
  },
});

export const linkTools: AnyToolDefinition[] = [
  listTeams,
  listLinkDomains,
  listLinks,
  getLink,
  createLink,
  updateLink,
  getLinkQr,
];

let tools: AnyToolDefinition[] | undefined;

/**
 * Everything the embedded endpoint offers: the team's analytics tools plus the link tools.
 * Built on first use, so loading this module does not depend on the MCP package.
 */
export function getMcpTools(): AnyToolDefinition[] {
  tools ??= [...allTools, ...linkTools];

  return tools;
}
