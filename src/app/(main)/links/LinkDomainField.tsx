// Fork: picker for the branded domain a link is served from. Renders nothing until the
// owner has added at least one domain, so the link form looks unchanged for everyone else.
import { Column, Label, ListItem, Select } from '@umami/react-zen';
import { useMessages } from '@/components/hooks';
import type { LinkDomainData } from '@/components/hooks/queries/useLinkDomainsQuery';

const DEFAULT = 'default';

export function LinkDomainField({
  domains,
  value,
  onChange,
}: {
  domains: LinkDomainData[];
  value?: string | null;
  onChange: (domainId: string | null) => void;
}) {
  const { t, labels } = useMessages();

  if (!domains.length) {
    return null;
  }

  return (
    <Column gap="1">
      <Label>{t(labels.domain)}</Label>
      <Select
        value={value || DEFAULT}
        onChange={(id: any) => onChange(id === DEFAULT ? null : id)}
        aria-label={t(labels.domain)}
      >
        <ListItem id={DEFAULT}>{t(labels.defaultDomain)}</ListItem>
        {domains.map(({ id, hostname }) => (
          <ListItem key={id} id={id}>
            {hostname}
          </ListItem>
        ))}
      </Select>
    </Column>
  );
}
