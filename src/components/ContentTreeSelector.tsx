import { Card, Tree, Typography } from 'antd';
import { DataNode } from 'antd/es/tree';
import { ContentNode } from '../types';

type Props = {
  tree: ContentNode[];
  checkedKeys: string[];
  onCheckedKeysChange: (keys: string[]) => void;
};

const getNodeLabel = (node: ContentNode): string => {
  const displayName = (node as Record<string, unknown>).displayName;
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName;
  }
  if (typeof node.name === 'string' && node.name.trim()) {
    return node.name;
  }
  return node.key;
};

const toTreeData = (nodes: ContentNode[]): DataNode[] => {
  return nodes.map((node) => ({
    key: node.key,
    title: getNodeLabel(node),
    children: node.children ? toTreeData(node.children) : undefined,
  }));
};

export const ContentTreeSelector = ({ tree, checkedKeys, onCheckedKeysChange }: Props) => {
  return (
    <Card size="small" title="Content Tree (select branches to migrate)">
      {tree.length ? (
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={(next) => {
            const result = Array.isArray(next) ? next : next.checked;
            onCheckedKeysChange(result.map(String));
          }}
          treeData={toTreeData(tree)}
          defaultExpandAll
          height={360}
        />
      ) : (
        <Typography.Text type="secondary">
          No content tree loaded. Run compare with Contents selected.
        </Typography.Text>
      )}
    </Card>
  );
};
