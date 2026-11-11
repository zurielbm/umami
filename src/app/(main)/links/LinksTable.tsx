import { DataColumn, DataTable, type DataTableProps, Row } from '@umami/react-zen';
import { useMemo } from 'react';
import { WebsiteSparkline } from '@/app/(main)/websites/WebsiteSparkline';
import { DateDistance } from '@/components/common/DateDistance';
import { ExternalLink } from '@/components/common/ExternalLink';
import Link from '@/components/common/Link';
import { SortableLabel } from '@/components/common/SortableLabel';
import { useLinkListChartsQuery, useMessages, useNavigation } from '@/components/hooks';
import { useLinkUrl } from '@/components/hooks/useLinkUrl';
import { LinkDeleteButton } from './LinkDeleteButton';
import { LinkEditButton } from './LinkEditButton';
import { LinkQRCodeButton } from './LinkQRCodeButton';

export interface LinksTableProps extends DataTableProps {
  showActions?: boolean;
}

export function LinksTable({ showActions, data = [], ...props }: LinksTableProps & { data?: any[] }) {
  const { t, labels } = useMessages();
  const { websiteId, renderUrl } = useNavigation();
  const { teamId } = useNavigation();
  const { getLinkUrl } = useLinkUrl(teamId);
  const linkIds = useMemo(() => data.map(row => row.id), [data]);
  const chartsQuery = useLinkListChartsQuery(linkIds);
  const charts = chartsQuery.data?.data || {};
  const isChartLoading = chartsQuery.isLoading && !chartsQuery.data;

  return (
    <DataTable {...props} data={data}>
      <DataColumn id="name" label={<SortableLabel label={t(labels.name)} sortKey="name" />}>
        {({ id, name }: any) => {
          return <Link href={renderUrl(`/links/${id}`)}>{name}</Link>;
        }}
      </DataColumn>
      <DataColumn
        id="slug"
        label={<SortableLabel label={t(labels.link)} sortKey="slug" />}
        style={{ minWidth: 0 }}
      >
        {(row: any) => {
          const url = getLinkUrl(row);
          return <ExternalLink href={url}>{url}</ExternalLink>;
        }}
      </DataColumn>
      <DataColumn
        id="url"
        label={<SortableLabel label={t(labels.destinationUrl)} sortKey="url" />}
        style={{ minWidth: 0 }}
      >
        {({ url }: any) => {
          return <ExternalLink href={url}>{url}</ExternalLink>;
        }}
      </DataColumn>
      <DataColumn
        id="chart"
        label={<span style={{ whiteSpace: 'normal' }}>{`${t(labels.visitors)} (7d)`}</span>}
        style={{ minWidth: 0 }}
      >
        {(row: any) => {
          const chart = charts[row.id];

          return (
            <WebsiteSparkline
              values={chart?.values}
              total={chart?.total}
              isLoading={isChartLoading}
            />
          );
        }}
      </DataColumn>
      <DataColumn
        id="created"
        label={
          <SortableLabel label={t(labels.created)} sortKey="createdAt" defaultDirection="desc" />
        }
        width="180px"
      >
        {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
      </DataColumn>
      {showActions && (
        <DataColumn id="action" align="end" width="176px">
          {({ id, name, ...row }: any) => {
            return (
              <Row gap="2">
                <LinkQRCodeButton url={getLinkUrl(row)} name={name} />
                <LinkEditButton linkId={id} />
                <LinkDeleteButton linkId={id} websiteId={websiteId} name={name} />
              </Row>
            );
          }}
        </DataColumn>
      )}
    </DataTable>
  );
}
