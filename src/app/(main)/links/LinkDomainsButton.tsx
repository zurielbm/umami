// Fork: manage the branded domains that links can be served from.
import {
  Button,
  Column,
  Form,
  FormField,
  FormSubmitButton,
  Grid,
  Row,
  Text,
  TextField,
} from '@umami/react-zen';
import { useState } from 'react';
import { ConfirmationForm } from '@/components/common/ConfirmationForm';
import { useApi, useDeleteQuery, useMessages, useModified } from '@/components/hooks';
import {
  type LinkDomainData,
  useLinkDomainsQuery,
} from '@/components/hooks/queries/useLinkDomainsQuery';
import { useUpdateQuery } from '@/components/hooks/queries/useUpdateQuery';
import { Globe, Trash } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';

export function LinkDomainsButton({ teamId }: { teamId?: string }) {
  const { t, labels } = useMessages();

  return (
    <DialogButton icon={<Globe />} label={t(labels.domains)} width="600px">
      <LinkDomains teamId={teamId} />
    </DialogButton>
  );
}

type CheckResult = { connected: boolean; reason?: 'unreachable' | 'other-server' };

export function LinkDomains({ teamId }: { teamId?: string }) {
  const { t, labels, messages, getErrorMessage } = useMessages();
  const { data } = useLinkDomainsQuery(teamId);
  const { mutateAsync, error, touch } = useUpdateQuery('/link-domains', { teamId });
  const [formKey, setFormKey] = useState(0);
  const domains = data ?? [];

  const handleSubmit = async (values: any) => {
    await mutateAsync(values, {
      onSuccess: () => {
        touch('link-domains');
        // Remount the form so the field empties for the next domain.
        setFormKey(key => key + 1);
      },
    });
  };

  return (
    <Column gap="5">
      <Text color="muted">{t(messages.linkDomainHelp)}</Text>
      {domains.length > 0 && (
        <Column gap="3">
          {domains.map(domain => (
            <LinkDomainRow key={domain.id} domain={domain} />
          ))}
        </Column>
      )}
      <Form
        key={formKey}
        onSubmit={handleSubmit}
        error={getErrorMessage(error)}
        defaultValues={{ hostname: '' }}
      >
        <Grid columns="1fr auto" alignItems="end" gap>
          <FormField
            name="hostname"
            label={t(labels.domain)}
            rules={{ required: t(labels.required) }}
          >
            <TextField placeholder="go.example.com" autoComplete="off" />
          </FormField>
          <FormSubmitButton>{t(labels.add)}</FormSubmitButton>
        </Grid>
      </Form>
    </Column>
  );
}

function LinkDomainRow({ domain }: { domain: LinkDomainData }) {
  const { t, labels, messages } = useMessages();
  const { post } = useApi();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);

    try {
      setResult(await post(`/link-domains/${domain.id}/check`));
    } catch {
      setResult({ connected: false, reason: 'unreachable' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Column gap="1">
      <Row alignItems="center" justifyContent="space-between" gap="3">
        <Text weight="bold" style={{ overflowWrap: 'anywhere' }}>
          {domain.hostname}
        </Text>
        <Row alignItems="center" gap="2">
          <Button isDisabled={isChecking} onPress={handleCheck}>
            {t(labels.checkConnection)}
          </Button>
          <LinkDomainDeleteButton domain={domain} />
        </Row>
      </Row>
      {result && (
        <Text color={result.connected ? undefined : 'muted'} size="sm">
          {result.connected
            ? t(labels.connected)
            : t(
                result.reason === 'other-server'
                  ? messages.linkDomainOtherServer
                  : messages.linkDomainUnreachable,
              )}
        </Text>
      )}
    </Column>
  );
}

function LinkDomainDeleteButton({ domain }: { domain: LinkDomainData }) {
  const { t, labels, messages, getErrorMessage } = useMessages();
  const { mutateAsync, isPending, error } = useDeleteQuery(`/link-domains/${domain.id}`);
  const { touch } = useModified();

  const handleConfirm = async (close: () => void) => {
    await mutateAsync(null, {
      onSuccess: () => {
        touch('link-domains');
        touch('links');
        close();
      },
    });
  };

  return (
    <DialogButton
      icon={<Trash />}
      title={t(labels.confirm)}
      aria-label={t(labels.delete)}
      variant="quiet"
      width="400px"
    >
      {({ close }) => (
        <ConfirmationForm
          message={t.rich(messages.confirmRemove, {
            target: domain.hostname,
            b: chunks => <b>{chunks}</b>,
          })}
          isLoading={isPending}
          error={getErrorMessage(error)}
          onConfirm={handleConfirm.bind(null, close)}
          onClose={close}
          buttonLabel={t(labels.delete)}
          buttonVariant="danger"
        />
      )}
    </DialogButton>
  );
}
