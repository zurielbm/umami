import { Row } from '@umami/react-zen';
import { useMessages } from '@/components/hooks';
import { Plus } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { LinkDomainsButton } from './LinkDomainsButton';
import { LinkEditForm } from './LinkEditForm';

export function LinkAddButton({ teamId }: { teamId?: string }) {
  const { t, labels } = useMessages();

  // Fork: the Domains button lives here so LinksPage.tsx, which the Umami team edits, stays untouched.
  return (
    <Row alignItems="center" gap="3">
      <LinkDomainsButton teamId={teamId} />
      <DialogButton icon={<Plus />} label={t(labels.addLink)} variant="primary" width="600px">
        {({ close }) => <LinkEditForm teamId={teamId} onClose={close} />}
      </DialogButton>
    </Row>
  );
}
