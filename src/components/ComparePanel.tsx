import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import {
   Alert,
   Button,
   Card,
   Checkbox,
   Form,
   Input,
   Select,
   Space,
   Typography,
} from "antd";
import {
   CompareCategory,
   ComparisonProgressMap,
   EnvironmentConfig,
} from "../types";

type Props = {
   environments: EnvironmentConfig[];
   selectedSourceId?: string;
   selectedTargetId?: string;
   categories: CompareCategory[];
   startContentKey: string;
   ignoredJsonProperties: string[];
   comparisonProgress: ComparisonProgressMap;
   isComparing: boolean;
   canCompare: boolean;
   onSourceChange: (value: string) => void;
   onTargetChange: (value: string) => void;
   onCategoriesChange: (categories: CompareCategory[]) => void;
   onStartContentKeyChange: (value: string) => void;
   onIgnoredJsonPropertiesChange: (properties: string[]) => void;
   onCompare: () => void;
   onRefresh: () => void;
};

const categoryLabels: Record<CompareCategory, string> = {
   contentTypes: "Content Types",
   displayTemplates: "Display Templates",
   contents: "Contents",
};

export const ComparePanel = ({
   environments,
   selectedSourceId,
   selectedTargetId,
   categories,
   startContentKey,
   ignoredJsonProperties,
   comparisonProgress,
   isComparing,
   canCompare,
   onSourceChange,
   onTargetChange,
   onCategoriesChange,
   onStartContentKeyChange,
   onIgnoredJsonPropertiesChange,
   onCompare,
   onRefresh,
}: Props) => {
   const isContentsSelected = categories.includes("contents");
   const isStartContentKeyMissing =
      isContentsSelected && !startContentKey.trim();

   return (
      <Card>
         <Space orientation="vertical" style={{ width: "100%" }}>
            <Typography.Title level={4}>Compare Environments</Typography.Title>
            <Form layout="vertical">
               <Space wrap style={{ width: "100%" }}>
                  <Form.Item
                     label="Source Environment"
                     style={{ minWidth: 280, marginBottom: 0 }}
                  >
                     <Select
                        placeholder="Select source"
                        options={environments.map((env) => ({
                           label: env.name,
                           value: env.id,
                        }))}
                        value={selectedSourceId}
                        onChange={onSourceChange}
                     />
                  </Form.Item>

                  <Form.Item
                     label="Target Environment"
                     style={{ minWidth: 280, marginBottom: 0 }}
                  >
                     <Select
                        placeholder="Select target"
                        options={environments.map((env) => ({
                           label: env.name,
                           value: env.id,
                        }))}
                        value={selectedTargetId}
                        onChange={onTargetChange}
                     />
                  </Form.Item>
               </Space>
            </Form>

            <Space orientation="vertical" style={{ width: "100%", marginTop: 16 }}>
               <Typography.Title level={4}>
                  What to compare / migrate?
               </Typography.Title>
               <Checkbox.Group<CompareCategory>
                  value={categories}
                  options={[
                     { label: "Content Types", value: "contentTypes" },
                     { label: "Display Templates", value: "displayTemplates" },
                     { label: "Contents", value: "contents" },
                  ]}
                  onChange={(values) =>
                     onCategoriesChange(values as CompareCategory[])
                  }
               />

               {isContentsSelected && (
                  <Alert
                     type="warning"
                     showIcon
                     title="Contents comparison is under development. Use Contents for identifying missing/not-identical items between environments only. Content migration is currently disabled."
                  />
               )}

               {isContentsSelected && (
                  <Form.Item
                     label="Start content key"
                     required
                     validateStatus={isStartContentKeyMissing ? "error" : ""}
                     help={
                        isStartContentKeyMissing
                           ? "Start content key is required when comparing contents."
                           : undefined
                     }
                     style={{ marginBottom: 0 }}
                  >
                     <Input
                        value={startContentKey}
                        onChange={(event) =>
                           onStartContentKeyChange(event.target.value)
                        }
                        placeholder="Enter start content key"
                     />
                  </Form.Item>
               )}

               <Form.Item
                  label="Ignored JSON properties"
                  extra="These fields are ignored during comparison and diff preview (case-insensitive)."
                  style={{ marginBottom: 0 }}
                  hidden
               >
                  <Select
                     mode="tags"
                     value={ignoredJsonProperties}
                     onChange={(values) =>
                        onIgnoredJsonPropertiesChange(
                           values.map((value) => value.trim()).filter(Boolean),
                        )
                     }
                     tokenSeparators={[","]}
                     placeholder="Examples: lastModified, lastModifiedBy"
                  />
               </Form.Item>
            </Space>

            {selectedSourceId &&
            selectedTargetId &&
            selectedSourceId === selectedTargetId ? (
               <Alert
                  type="error"
                  showIcon
                  title="Source and target environments cannot be the same."
               />
            ) : null}

            <Space wrap style={{ marginTop: 16 }}>
               <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  loading={isComparing}
                  disabled={!canCompare}
                  onClick={onCompare}
               >
                  Compare
               </Button>
               <Button
                  icon={<ReloadOutlined />}
                  disabled={isComparing}
                  onClick={onRefresh}
               >
                  Refresh Comparison
               </Button>
            </Space>

            <Space orientation="vertical" style={{ width: "100%", marginTop: 16 }}>
               <Typography.Title level={5}>Progress</Typography.Title>
               {(
                  [
                     "contentTypes",
                     "displayTemplates",
                     "contents",
                  ] as CompareCategory[]
               )
                  .filter((category) => categories.includes(category))
                  .map((category) => {
                     const progress = comparisonProgress[category];

                     return (
                        <Alert
                           key={category}
                           type={
                              progress.status === "done"
                                 ? "success"
                                 : progress.status === "error"
                                   ? "error"
                                   : progress.status === "loading"
                                     ? "info"
                                     : "warning"
                           }
                           title={`${categoryLabels[category]}: ${progress.message ?? progress.status}`}
                           banner
                           showIcon
                           style={{ marginBottom: 8 }}
                        />
                     );
                  })}
            </Space>
         </Space>
      </Card>
   );
};
