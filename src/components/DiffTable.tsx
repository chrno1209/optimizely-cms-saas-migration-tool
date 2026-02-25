import { EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Modal, Space, Switch, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { ComparisonItem, ComparisonStatus } from '../types';
import { stableStringify } from '../utils/diff';

type Props = {
  title: string;
  items: ComparisonItem[];
  isMigrating: boolean;
  isDarkTheme: boolean;
  ignoredJsonProperties: string[];
  hideIdenticalItems?: boolean;
  showHideIdenticalToggle?: boolean;
  enablePushToTarget?: boolean;
  onHideIdenticalItemsChange?: (value: boolean) => void;
  onPushItem: (item: ComparisonItem) => void;
};

const statusMeta: Record<ComparisonStatus, { label: string; color: string }> = {
  onlySource: { label: 'Only in Source', color: 'green' },
  onlyTarget: { label: 'Only in Target', color: 'orange' },
  different: { label: 'Different', color: 'magenta' },
  identical: { label: 'Identical', color: 'default' },
};

export const DiffTable = ({
  title,
  items,
  isMigrating,
  isDarkTheme,
  ignoredJsonProperties,
  hideIdenticalItems = false,
  showHideIdenticalToggle = false,
  enablePushToTarget = true,
  onHideIdenticalItemsChange,
  onPushItem,
}: Props) => {
  const [activeDiff, setActiveDiff] = useState<ComparisonItem | null>(null);

  const data = useMemo(() => {
    const filtered = hideIdenticalItems
      ? items.filter((item) => item.status !== 'identical')
      : items;

    return filtered.map((item) => ({ ...item, rowKey: `${item.category}-${item.key}` }));
  }, [hideIdenticalItems, items]);

  return (
    <Card
      size="small"
      title={title}
      extra={
        showHideIdenticalToggle ? (
          <Space>
            <span style={{ fontSize: 12 }}>Hide identical</span>
            <Switch
              size="small"
              checked={hideIdenticalItems}
              onChange={(checked) => onHideIdenticalItemsChange?.(checked)}
            />
          </Space>
        ) : null
      }
    >
      <Table
        size="small"
        rowKey="rowKey"
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          {
            title: 'Key / Name',
            key: 'name',
            render: (_, row) => (
              <Space orientation="vertical" size={0}>
                <span>{row.name || row.key}</span>
                <span style={{ color: '#888', fontSize: 12 }}>{row.key}</span>
              </Space>
            ),
          },
          {
            title: 'Status in Source',
            key: 'sourceStatus',
            render: (_, row) =>
              row.status === 'onlyTarget' ? <Tag color="red" variant='solid'>Missing</Tag> : <Tag color="green" variant='outlined'>Present</Tag>,
          },
          {
            title: 'Status in Target',
            key: 'targetStatus',
            render: (_, row) =>
              row.status === 'onlySource' ? <Tag color="red" variant='solid'>Missing</Tag> : <Tag color="green" variant='outlined'>Present</Tag>,
          },
          {
            title: 'Comparison',
            dataIndex: 'status',
            key: 'status',
            render: (status: ComparisonStatus) => (
              <Tag color={statusMeta[status].color} variant='solid'>{statusMeta[status].label}</Tag>
            ),
          },
          {
            title: 'Action',
            key: 'action',
            width: 220,
            render: (_, row) => (
              <Space>
                {row.status === 'different' && (
                  <Button icon={<EyeOutlined />} size="small" onClick={() => setActiveDiff(row)}>
                    View Diff
                  </Button>
                )}
                {enablePushToTarget && (row.status === 'different' || row.status === 'onlySource') && (
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    size="small"
                    loading={isMigrating}
                    onClick={() => onPushItem(row)}
                  >
                    Push to Target
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        width={1200}
        title={activeDiff ? `Diff: ${activeDiff.name || activeDiff.key}` : 'Diff Preview'}
        open={Boolean(activeDiff)}
        onCancel={() => setActiveDiff(null)}
        footer={null}
      >
        <ReactDiffViewer
          oldValue={stableStringify(activeDiff?.sourceData ?? {}, ignoredJsonProperties)}
          newValue={stableStringify(activeDiff?.targetData ?? {}, ignoredJsonProperties)}
          splitView
          showDiffOnly={false}
          useDarkTheme={isDarkTheme}
          leftTitle="Source"
          rightTitle="Target"
          styles={{
            diffContainer: {
              maxHeight: 540,
              overflow: 'auto',
            },
          }}
        />
      </Modal>
    </Card>
  );
};
