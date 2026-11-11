import { Row } from '@umami/react-zen';
import { IconLabel } from '@/components/common/IconLabel';
import { LinkButton } from '@/components/common/LinkButton';
import { PageHeader } from '@/components/common/PageHeader';
import { useLink, useMessages, useNavigation } from '@/components/hooks';
import { useLinkUrl } from '@/components/hooks/useLinkUrl';
import { Edit, ExternalLink, Link } from '@/components/icons';
import { LinkQRCodeButton } from '../LinkQRCodeButton';

export function LinkHeader({ showActions = true }: { showActions?: boolean }) {
  const link = useLink();

  return (
    <PageHeader title={link.name} description={link.url} icon={<Link />}>
      {showActions && link.id && (
        <LinkHeaderActions linkId={link.id} slug={link.slug} name={link.name} />
      )}
    </PageHeader>
  );
}

function LinkHeaderActions({ linkId, slug, name }: { linkId: string; slug: string; name: string }) {
  const { t, labels } = useMessages();
  const { renderUrl } = useNavigation();
  const link = useLink();
  const { getLinkUrl } = useLinkUrl(link.teamId);
  const url = getLinkUrl({ slug, domainId: link.domainId });

  return (
    <Row alignItems="center" gap="3">
      <LinkQRCodeButton url={url} name={name} showLabel />
      <LinkButton href={renderUrl(`/links/${linkId}/edit`, false)}>
        <IconLabel icon={<Edit />} label={t(labels.edit)} />
      </LinkButton>
      <LinkButton href={url} target="_blank" prefetch={false} asAnchor>
        <IconLabel icon={<ExternalLink />} label={t(labels.view)} />
      </LinkButton>
    </Row>
  );
}
