import { Modal, Space, Spin, Typography } from 'antd';

type Props = {
  open: boolean;
  running: boolean;
  logs: string[];
  onClose: () => void;
};

export const MigrationLogModal = ({ open, running, logs, onClose }: Props) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Migration Progress"
      width={900}
      footer={null}
      closable={true}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        {running ? (
          <Space>
            <Spin size="small" />
            <Typography.Text>Migration is running...</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="success">Migration completed.</Typography.Text>
        )}

        <div
          style={{
            maxHeight: 400,
            overflow: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            padding: 12,
            background: 'rgba(0,0,0,0.02)',
          }}
        >
          <Space orientation="vertical" style={{ width: '100%' }}>
            {logs.length ? (
              logs.map((line, index) => (
                <Typography.Text key={`${line}-${index}`}>
                  {line}
                </Typography.Text>
              ))
            ) : (
              <Typography.Text type="secondary">No logs yet.</Typography.Text>
            )}
          </Space>
        </div>
      </Space>
    </Modal>
  );
};
