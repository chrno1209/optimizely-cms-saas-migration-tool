import {
   CloudUploadOutlined,
   DatabaseOutlined,
   DownloadOutlined,
   MoonOutlined,
   SunOutlined,
} from "@ant-design/icons";
import {
   Alert,
   Button,
   Card,
   ConfigProvider,
   Layout,
   Menu,
   Modal,
   Space,
   Spin,
   Tabs,
   Tag,
   Typography,
   notification,
   theme,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ComparePanel } from "./components/ComparePanel";
import { ContentTreeSelector } from "./components/ContentTreeSelector";
import { DiffTable } from "./components/DiffTable";
import { EnvironmentManager } from "./components/EnvironmentManager";
import { MigrationLogModal } from "./components/MigrationLogModal";
import { optimizelyApi } from "./services/optimizelyApi";
import {
   CompareCategory,
   ComparisonItem,
   ComparisonProgressMap,
   ComparisonResult,
   ContentNode,
   EnvironmentConfig,
   EnvironmentGroup,
} from "./types";
import {
   getEntityName,
   isDeepEqualIgnoring,
   stripReadonlyFields,
} from "./utils/diff";
import {
   flattenGroupsToEnvironments,
   loadGroups,
   migrateLegacyEnvironmentsToGroups,
   loadThemeMode,
   saveGroups,
   saveThemeMode,
} from "./utils/localStorage";

const { Header, Sider, Content } = Layout;

const createInitialProgress = (): ComparisonProgressMap => ({
   contentTypes: { status: "idle", message: "Waiting" },
   displayTemplates: { status: "idle", message: "Waiting" },
   contents: { status: "idle", message: "Waiting" },
});

const flattenContentTree = (nodes: ContentNode[]): ContentNode[] => {
   const result: ContentNode[] = [];

   const walk = (node: ContentNode) => {
      result.push(node);
      node.children?.forEach(walk);
   };

   nodes.forEach(walk);
   return result;
};

const getContentDisplayLabel = (
   node: ContentNode | undefined,
   fallback: string,
): string => {
   if (!node) {
      return fallback;
   }

   const record = node as Record<string, unknown>;
   const locales = record.locales;
   if (locales && typeof locales === "object") {
      const localizedNames = Object.entries(locales as Record<string, unknown>)
         .map(([localeCode, localeValue]) => {
            if (!localeValue || typeof localeValue !== "object") {
               return "";
            }

            const displayName = (localeValue as Record<string, unknown>)
               .displayName;
            if (typeof displayName !== "string" || !displayName.trim()) {
               return "";
            }

            return `[${localeCode}] ${displayName.trim()}`;
         })
         .filter(Boolean);

      if (localizedNames.length > 0) {
         return localizedNames.join(" | ");
      }
   }

   const displayName =
      typeof record.displayName === "string" ? record.displayName.trim() : "";
   const name = typeof node.name === "string" ? node.name.trim() : "";

   return displayName || name || fallback;
};

const App = () => {
   const [api, contextHolder] = notification.useNotification();
   const [groups, setGroups] = useState<EnvironmentGroup[]>(() => loadGroups());
   const [themeMode, setThemeMode] = useState<"light" | "dark">(() =>
      loadThemeMode(),
   );

   const [selectedSourceId, setSelectedSourceId] = useState<string>();
   const [selectedTargetId, setSelectedTargetId] = useState<string>();
   const [selectedCategories, setSelectedCategories] = useState<
      CompareCategory[]
   >(["contentTypes", "displayTemplates"]);
   const [ignoredJsonProperties, setIgnoredJsonProperties] = useState<string[]>(
      ["lastModified", "lastModifiedBy", "created", "createdBy"],
   );
   const [startContentKey, setStartContentKey] = useState("");

   const [isComparing, setIsComparing] = useState(false);
   const [hideIdenticalContentTypes, setHideIdenticalContentTypes] =
      useState(false);
   const [hideIdenticalContents, setHideIdenticalContents] = useState(false);
   const [hideIdenticalDisplayTemplates, setHideIdenticalDisplayTemplates] =
      useState(false);
   const [comparisonProgress, setComparisonProgress] =
      useState<ComparisonProgressMap>(createInitialProgress());
   const [comparisonResult, setComparisonResult] =
      useState<ComparisonResult | null>(null);

   const [checkedContentKeys, setCheckedContentKeys] = useState<string[]>([]);
   const [migrationOpen, setMigrationOpen] = useState(false);
   const [migrationRunning, setMigrationRunning] = useState(false);
   const [migrationLogs, setMigrationLogs] = useState<string[]>([]);

   const environments = useMemo(
      () => flattenGroupsToEnvironments(groups),
      [groups],
   );

   useEffect(() => {
      const migration = migrateLegacyEnvironmentsToGroups();
      if (migration.migrated) {
         setGroups(migration.groups);
         api.success({
            message: "Migrated old environments to new grouped structure.",
         });
      }
   }, [api]);

   useEffect(() => {
      saveGroups(groups);
   }, [groups]);

   useEffect(() => {
      saveThemeMode(themeMode);
   }, [themeMode]);

   const selectedSource = useMemo(
      () => environments.find((env) => env.id === selectedSourceId),
      [environments, selectedSourceId],
   );

   const selectedTarget = useMemo(
      () => environments.find((env) => env.id === selectedTargetId),
      [environments, selectedTargetId],
   );

   const canCompare =
      Boolean(selectedSourceId) &&
      Boolean(selectedTargetId) &&
      selectedSourceId !== selectedTargetId &&
      selectedCategories.length > 0 &&
      (!selectedCategories.includes("contents") ||
         Boolean(startContentKey.trim()));

   const updateCategoryProgress = (
      category: CompareCategory,
      status: "idle" | "loading" | "done" | "error",
      message: string,
   ) => {
      setComparisonProgress((prev) => ({
         ...prev,
         [category]: { status, message },
      }));
   };

   const appendMigrationLog = (line: string) => {
      setMigrationLogs((prev) => [
         ...prev,
         `${new Date().toLocaleTimeString()} - ${line}`,
      ]);
   };

   const addGroup = (groupName: string) => {
      setGroups((prev) => [
         ...prev,
         { groupId: uuidv4(), groupName, environments: [] },
      ]);
      api.success({ message: `Group "${groupName}" created.` });
   };

   const renameGroup = (groupId: string, groupName: string) => {
      setGroups((prev) =>
         prev.map((group) =>
            group.groupId === groupId ? { ...group, groupName } : group,
         ),
      );
      api.success({ message: `Group renamed to "${groupName}".` });
   };

   const deleteGroup = (groupId: string) => {
      const deleted = groups.find((group) => group.groupId === groupId);
      if (!deleted || deleted.environments.length > 0) {
         return;
      }
      setGroups((prev) => prev.filter((group) => group.groupId !== groupId));
      api.info({ message: `Group "${deleted.groupName}" deleted.` });
   };

   const addEnvironment = (
      groupId: string,
      environment: Omit<EnvironmentConfig, "id">,
   ) => {
      const nextEnvironment: EnvironmentConfig = {
         id: uuidv4(),
         ...environment,
      };
      setGroups((prev) =>
         prev.map((group) =>
            group.groupId === groupId
               ? {
                    ...group,
                    environments: [...group.environments, nextEnvironment],
                 }
               : group,
         ),
      );
      api.success({ message: `Environment "${environment.name}" added.` });
   };

   const editEnvironment = (
      groupId: string,
      environment: EnvironmentConfig,
      previousGroupId?: string,
   ) => {
      const sourceGroupId = previousGroupId ?? groupId;

      setGroups((prev) => {
         if (sourceGroupId === groupId) {
            return prev.map((group) =>
               group.groupId === groupId
                  ? {
                       ...group,
                       environments: group.environments.map((env) =>
                          env.id === environment.id ? environment : env,
                       ),
                    }
                  : group,
            );
         }

         let movedEnvironment: EnvironmentConfig | null = null;

         const removed = prev.map((group) => {
            if (group.groupId !== sourceGroupId) {
               return group;
            }

            const remaining = group.environments.filter((env) => {
               if (env.id === environment.id) {
                  movedEnvironment = { ...env, ...environment };
                  return false;
               }
               return true;
            });

            return { ...group, environments: remaining };
         });

         if (!movedEnvironment) {
            return prev;
         }

         return removed.map((group) =>
            group.groupId === groupId
               ? {
                    ...group,
                    environments: [
                       ...group.environments,
                       movedEnvironment as EnvironmentConfig,
                    ],
                 }
               : group,
         );
      });

      api.success({ message: `Environment "${environment.name}" updated.` });
   };

   const deleteEnvironment = (id: string) => {
      const deleted = environments.find((env) => env.id === id);
      setGroups((prev) =>
         prev.map((group) => ({
            ...group,
            environments: group.environments.filter((env) => env.id !== id),
         })),
      );

      if (selectedSourceId === id) {
         setSelectedSourceId(undefined);
      }
      if (selectedTargetId === id) {
         setSelectedTargetId(undefined);
      }
      if (deleted) {
         api.info({ message: `Environment "${deleted.name}" deleted.` });
      }
   };

   const reorderEnvironments = (
      sourceGroupId: string,
      destinationGroupId: string,
      sourceIndex: number,
      destinationIndex: number,
   ) => {
      setGroups((prev) => {
         if (sourceGroupId === destinationGroupId) {
            return prev.map((group) => {
               if (group.groupId !== sourceGroupId) {
                  return group;
               }

               const environmentsInGroup = [...group.environments];
               const [moved] = environmentsInGroup.splice(sourceIndex, 1);
               if (!moved) {
                  return group;
               }
               environmentsInGroup.splice(destinationIndex, 0, moved);
               return { ...group, environments: environmentsInGroup };
            });
         }

         const sourceGroup = prev.find(
            (group) => group.groupId === sourceGroupId,
         );
         const destinationGroup = prev.find(
            (group) => group.groupId === destinationGroupId,
         );

         if (!sourceGroup || !destinationGroup) {
            return prev;
         }

         const sourceEnvironments = [...sourceGroup.environments];
         const [moved] = sourceEnvironments.splice(sourceIndex, 1);
         if (!moved) {
            return prev;
         }

         const destinationEnvironments = [...destinationGroup.environments];
         destinationEnvironments.splice(destinationIndex, 0, moved);

         return prev.map((group) => {
            if (group.groupId === sourceGroupId) {
               return { ...group, environments: sourceEnvironments };
            }
            if (group.groupId === destinationGroupId) {
               return { ...group, environments: destinationEnvironments };
            }
            return group;
         });
      });
   };

   const reorderGroups = (sourceIndex: number, destinationIndex: number) => {
      setGroups((prev) => {
         const next = [...prev];
         const [moved] = next.splice(sourceIndex, 1);
         if (!moved) {
            return prev;
         }
         next.splice(destinationIndex, 0, moved);
         return next;
      });
   };

   const compareEntityCategory = async (
      category: Extract<CompareCategory, "contentTypes" | "displayTemplates">,
      source: EnvironmentConfig,
      target: EnvironmentConfig,
   ): Promise<ComparisonItem[]> => {
      const isContentType = category === "contentTypes";

      const sourceList = isContentType
         ? await optimizelyApi.listContentTypes(source)
         : await optimizelyApi.listDisplayTemplates(source);

      const targetList = isContentType
         ? await optimizelyApi.listContentTypes(target)
         : await optimizelyApi.listDisplayTemplates(target);

      const sourceMap = new Map<string, Record<string, unknown>>();
      const targetMap = new Map<string, Record<string, unknown>>();

      sourceList.forEach((item) => {
         const key = String(item.key ?? "");
         if (key) {
            sourceMap.set(key, item);
         }
      });

      targetList.forEach((item) => {
         const key = String(item.key ?? "");
         if (key) {
            targetMap.set(key, item);
         }
      });

      const allKeys = Array.from(
         new Set([...sourceMap.keys(), ...targetMap.keys()]),
      ).sort();

      const rows = allKeys.map((key): ComparisonItem => {
         const sourceData = sourceMap.get(key);
         const targetData = targetMap.get(key);

         if (sourceData && !targetData) {
            return {
               category,
               key,
               name: getEntityName(sourceData, key),
               status: "onlySource",
               sourceData,
            };
         }

         if (!sourceData && targetData) {
            return {
               category,
               key,
               name: getEntityName(targetData, key),
               status: "onlyTarget",
               targetData,
            };
         }

         return {
            category,
            key,
            name: getEntityName(sourceData, key),
            status: isDeepEqualIgnoring(
               sourceData,
               targetData,
               ignoredJsonProperties,
            )
               ? "identical"
               : "different",
            sourceData,
            targetData,
         };
      });

      return rows;
   };

   const compareContents = async (
      source: EnvironmentConfig,
      target: EnvironmentConfig,
      contentStartKey?: string,
   ): Promise<{
      items: ComparisonItem[];
      sourceTree: ContentNode[];
      targetTree: ContentNode[];
   }> => {
      const sourceTree = await optimizelyApi.buildContentTree(
         source,
         contentStartKey || undefined,
      );
      const targetTree = await optimizelyApi.buildContentTree(
         target,
         contentStartKey || undefined,
      );

      const sourceFlat = flattenContentTree(sourceTree);
      const targetFlat = flattenContentTree(targetTree);

      const sourceMap = new Map(sourceFlat.map((item) => [item.key, item]));
      const targetMap = new Map(targetFlat.map((item) => [item.key, item]));

      const keys = Array.from(
         new Set([...sourceMap.keys(), ...targetMap.keys()]),
      ).sort();

      const items = keys.map((key): ComparisonItem => {
         const sourceNode = sourceMap.get(key);
         const targetNode = targetMap.get(key);

         if (sourceNode && !targetNode) {
            return {
               category: "contents",
               key,
               name: getContentDisplayLabel(sourceNode, key),
               status: "onlySource",
               sourceData: sourceNode,
            };
         }

         if (!sourceNode && targetNode) {
            return {
               category: "contents",
               key,
               name: getContentDisplayLabel(targetNode, key),
               status: "onlyTarget",
               targetData: targetNode,
            };
         }

         const sourcePayload = sourceNode
            ? { ...sourceNode, children: undefined }
            : undefined;
         const targetPayload = targetNode
            ? { ...targetNode, children: undefined }
            : undefined;

         return {
            category: "contents",
            key,
            name:
               getContentDisplayLabel(sourceNode, "") ||
               getContentDisplayLabel(targetNode, key),
            status: isDeepEqualIgnoring(
               sourcePayload,
               targetPayload,
               ignoredJsonProperties,
            )
               ? "identical"
               : "different",
            sourceData: sourcePayload,
            targetData: targetPayload,
         };
      });

      return { items, sourceTree, targetTree };
   };

   const runCompare = async () => {
      if (!selectedSource || !selectedTarget) {
         api.warning({
            message: "Select both source and target environments.",
         });
         return;
      }

      if (selectedSource.id === selectedTarget.id) {
         api.error({
            message: "Source and target environments cannot be the same.",
         });
         return;
      }

      if (!selectedCategories.length) {
         api.warning({ message: "Select at least one category to compare." });
         return;
      }

      if (selectedCategories.includes("contents") && !startContentKey.trim()) {
         api.warning({
            message: "Start content key is required when comparing contents.",
         });
         return;
      }

      setIsComparing(true);
      setComparisonProgress(createInitialProgress());

      try {
         const result: ComparisonResult = {
            generatedAt: new Date().toISOString(),
            sourceEnvironmentId: selectedSource.id,
            targetEnvironmentId: selectedTarget.id,
            categories: {},
         };

         if (selectedCategories.includes("contentTypes")) {
            updateCategoryProgress(
               "contentTypes",
               "loading",
               "Fetching content types...",
            );
            const rows = await compareEntityCategory(
               "contentTypes",
               selectedSource,
               selectedTarget,
            );
            result.categories.contentTypes = rows;
            updateCategoryProgress(
               "contentTypes",
               "done",
               `${rows.length} content types compared`,
            );
         }

         if (selectedCategories.includes("displayTemplates")) {
            updateCategoryProgress(
               "displayTemplates",
               "loading",
               "Fetching display templates...",
            );
            const rows = await compareEntityCategory(
               "displayTemplates",
               selectedSource,
               selectedTarget,
            );
            result.categories.displayTemplates = rows;
            updateCategoryProgress(
               "displayTemplates",
               "done",
               `${rows.length} display templates compared`,
            );
         }

         if (selectedCategories.includes("contents")) {
            updateCategoryProgress(
               "contents",
               "loading",
               "Fetching content tree recursively...",
            );
            const content = await compareContents(
               selectedSource,
               selectedTarget,
               startContentKey.trim(),
            );
            result.categories.contents = content.items;
            result.sourceContentTree = content.sourceTree;
            result.targetContentTree = content.targetTree;

            const defaultChecked = content.items
               .filter(
                  (item) =>
                     item.status === "onlySource" ||
                     item.status === "different",
               )
               .slice(0, 1000)
               .map((item) => item.key);
            setCheckedContentKeys(defaultChecked);

            updateCategoryProgress(
               "contents",
               "done",
               `${content.items.length} content items compared`,
            );
         }

         setComparisonResult(result);
         api.success({ message: "Comparison completed successfully." });
      } catch (error) {
         const message =
            error instanceof Error ? error.message : "Comparison failed.";

         const maybeCors = /failed to fetch|networkerror|network error/i.test(
            message,
         )
            ? " CORS error – you may need a proxy."
            : "";

         api.error({
            message: `Comparison failed: ${message}${maybeCors}`,
         });

         selectedCategories.forEach((category) => {
            updateCategoryProgress(category, "error", "Failed");
         });
      } finally {
         setIsComparing(false);
      }
   };

   const refreshComparisonForCategories = async (
      categories: CompareCategory[],
      source: EnvironmentConfig,
      target: EnvironmentConfig,
   ) => {
      const uniqueCategories = Array.from(new Set(categories));
      if (!uniqueCategories.length) {
         return;
      }

      setIsComparing(true);

      try {
         const nextCategories: ComparisonResult["categories"] = {};
         let nextSourceTree: ContentNode[] | undefined;
         let nextTargetTree: ContentNode[] | undefined;

         if (uniqueCategories.includes("contentTypes")) {
            updateCategoryProgress(
               "contentTypes",
               "loading",
               "Refreshing content types...",
            );
            const rows = await compareEntityCategory(
               "contentTypes",
               source,
               target,
            );
            nextCategories.contentTypes = rows;
            updateCategoryProgress(
               "contentTypes",
               "done",
               `${rows.length} content types compared`,
            );
         }

         if (uniqueCategories.includes("displayTemplates")) {
            updateCategoryProgress(
               "displayTemplates",
               "loading",
               "Refreshing display templates...",
            );
            const rows = await compareEntityCategory(
               "displayTemplates",
               source,
               target,
            );
            nextCategories.displayTemplates = rows;
            updateCategoryProgress(
               "displayTemplates",
               "done",
               `${rows.length} display templates compared`,
            );
         }

         if (uniqueCategories.includes("contents")) {
            if (!startContentKey.trim()) {
               throw new Error(
                  "Start content key is required when refreshing contents comparison.",
               );
            }
            updateCategoryProgress(
               "contents",
               "loading",
               "Refreshing content tree...",
            );
            const content = await compareContents(
               source,
               target,
               startContentKey.trim(),
            );
            nextCategories.contents = content.items;
            nextSourceTree = content.sourceTree;
            nextTargetTree = content.targetTree;

            const defaultChecked = content.items
               .filter(
                  (item) =>
                     item.status === "onlySource" ||
                     item.status === "different",
               )
               .slice(0, 1000)
               .map((item) => item.key);
            setCheckedContentKeys(defaultChecked);

            updateCategoryProgress(
               "contents",
               "done",
               `${content.items.length} content items compared`,
            );
         }

         setComparisonResult((prev) => {
            const base: ComparisonResult = prev ?? {
               generatedAt: new Date().toISOString(),
               sourceEnvironmentId: source.id,
               targetEnvironmentId: target.id,
               categories: {},
            };

            return {
               ...base,
               generatedAt: new Date().toISOString(),
               sourceEnvironmentId: source.id,
               targetEnvironmentId: target.id,
               categories: {
                  ...base.categories,
                  ...nextCategories,
               },
               sourceContentTree: nextSourceTree ?? base.sourceContentTree,
               targetContentTree: nextTargetTree ?? base.targetContentTree,
            };
         });
      } catch (error) {
         uniqueCategories.forEach((category) => {
            updateCategoryProgress(category, "error", "Refresh failed");
         });
         throw error;
      } finally {
         setIsComparing(false);
      }
   };

   const migrateSingleItem = async (
      category: Extract<CompareCategory, "contentTypes" | "displayTemplates">,
      item: ComparisonItem,
      target: EnvironmentConfig,
   ) => {
      const sourceData = (item.sourceData ?? {}) as Record<string, unknown>;
      const payload = stripReadonlyFields(sourceData);

      if (category === "contentTypes") {
         if (item.status === "onlySource") {
            appendMigrationLog(`Creating content type ${item.key}...`);
            await optimizelyApi.createContentType(target, payload);
         } else if (item.status === "different") {
            appendMigrationLog(`Updating content type ${item.key}...`);
            await optimizelyApi.updateContentType(target, item.key, payload);
         }
         return;
      }

      if (item.status === "onlySource") {
         appendMigrationLog(`Creating display template ${item.key}...`);
         await optimizelyApi.createDisplayTemplate(target, payload);
      } else if (item.status === "different") {
         appendMigrationLog(`Updating display template ${item.key}...`);
         await optimizelyApi.updateDisplayTemplate(target, item.key, payload);
      }
   };

   const migrateContentBranch = async (
      source: EnvironmentConfig,
      target: EnvironmentConfig,
      sourceKey: string,
      oldToNewKeys: Map<string, string>,
      visited: Set<string>,
   ) => {
      if (visited.has(sourceKey)) {
         return;
      }
      visited.add(sourceKey);

      const sourceItem = await optimizelyApi.getContent(source, sourceKey);

      appendMigrationLog(`Migrating content ${sourceKey}...`);

      const copied = await optimizelyApi.copyContent(target, sourceKey, {});

      let targetKey = sourceKey;

      if (copied && typeof copied.key === "string") {
         targetKey = copied.key;
         appendMigrationLog(
            `Copied using :copy endpoint (${sourceKey} -> ${targetKey})`,
         );
      } else {
         const payload = stripReadonlyFields(sourceItem);

         const parentKey = String(sourceItem.parentKey ?? "");
         if (parentKey && oldToNewKeys.has(parentKey)) {
            payload.parentKey = oldToNewKeys.get(parentKey);
         }

         try {
            const created = await optimizelyApi.createContent(target, payload);
            targetKey = String(created.key ?? sourceKey);
            appendMigrationLog(`Created content ${sourceKey} -> ${targetKey}`);
         } catch {
            await optimizelyApi.updateContent(target, sourceKey, payload);
            targetKey = sourceKey;
            appendMigrationLog(`Updated existing content ${sourceKey}`);
         }
      }

      oldToNewKeys.set(sourceKey, targetKey);

      const children = await optimizelyApi.listContentChildren(
         source,
         sourceKey,
      );
      for (const child of children) {
         const childKey = String(child.key ?? "");
         if (childKey) {
            await migrateContentBranch(
               source,
               target,
               childKey,
               oldToNewKeys,
               visited,
            );
         }
      }
   };

   const runMigration = async (overrideItem?: ComparisonItem) => {
      if (!comparisonResult || !selectedSource || !selectedTarget) {
         api.warning({ message: "Run comparison first." });
         return;
      }

      if (overrideItem?.category === "contents") {
         api.info({
            message:
               "Content migration is currently disabled. Use Contents for comparison only.",
         });
         return;
      }

      setMigrationLogs([]);
      setMigrationOpen(true);
      setMigrationRunning(true);

      try {
         const migratedCategories = new Set<CompareCategory>();

         const itemsToMigrate: ComparisonItem[] = overrideItem
            ? [overrideItem]
            : [
                 ...(comparisonResult.categories.contentTypes ?? []),
                 ...(comparisonResult.categories.displayTemplates ?? []),
              ].filter(
                 (item) =>
                    item.status === "onlySource" || item.status === "different",
              );

         for (const item of itemsToMigrate) {
            if (
               item.category === "contentTypes" ||
               item.category === "displayTemplates"
            ) {
               await migrateSingleItem(item.category, item, selectedTarget);
               migratedCategories.add(item.category);
            }
         }

         if (selectedCategories.includes("contents")) {
            appendMigrationLog(
               "Skipping contents migration (currently disabled; comparison only).",
            );
         }

         appendMigrationLog("Migration finished successfully.");
         api.success({ message: "Migration completed." });

         if (migratedCategories.size > 0) {
            appendMigrationLog(
               `Refreshing comparison for: ${Array.from(migratedCategories).join(", ")}...`,
            );
            try {
               await refreshComparisonForCategories(
                  Array.from(migratedCategories),
                  selectedSource,
                  selectedTarget,
               );
               appendMigrationLog("Comparison refresh completed.");
            } catch (error) {
               const message =
                  error instanceof Error
                     ? error.message
                     : "Failed to refresh comparison.";
               appendMigrationLog(`WARNING: ${message}`);
               api.warning({
                  message: `Migration succeeded, but refresh failed: ${message}`,
               });
            }
         }
      } catch (error) {
         const message =
            error instanceof Error ? error.message : "Migration failed.";
         appendMigrationLog(`ERROR: ${message}`);
         api.error({ message: `Migration failed: ${message}` });
      } finally {
         setMigrationRunning(false);
      }
   };

   const confirmAndMigrate = (item?: ComparisonItem) => {
      if (!comparisonResult) {
         return;
      }

      Modal.confirm({
         title: "Confirm Migration",
         content:
            "This will overwrite/create items in Target environment. Irreversible. Continue?",
         okText: "Yes, continue",
         okButtonProps: { danger: true },
         onOk: async () => {
            await runMigration(item);
         },
      });
   };

   const exportComparison = () => {
      if (!comparisonResult) {
         api.warning({ message: "No comparison data to export yet." });
         return;
      }

      const blob = new Blob([JSON.stringify(comparisonResult, null, 2)], {
         type: "application/json",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `comparison-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(link.href);

      api.success({ message: "Comparison exported to JSON." });
   };

   const hasComparisonData = Boolean(comparisonResult);
   const safeComparisonResult = comparisonResult;

   return (
      <ConfigProvider
         theme={{
            algorithm:
               themeMode === "dark"
                  ? theme.darkAlgorithm
                  : theme.defaultAlgorithm,
            token: {
               borderRadius: 10,
            },
         }}
      >
         {contextHolder}
         <Layout
            style={{ minHeight: "100vh", maxHeight: "100vh", height: "100vh" }}
         >
            <Sider
               breakpoint="lg"
               collapsedWidth="0"
               width={500}
               theme="light"
               style={{ padding: 12, height: "100vh", overflowY: "auto" }}
            >
               <Space
                  orientation="vertical"
                  size="middle"
                  style={{ width: "100%" }}
               >
                  <Space
                     style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginTop: 12,
                     }}
                  >
                     <Typography.Title level={4} style={{ margin: 0 }}>
                        Optimizely CMS SaaS Migration Tool
                     </Typography.Title>
                     <Button
                        icon={
                           themeMode === "dark" ? (
                              <SunOutlined />
                           ) : (
                              <MoonOutlined />
                           )
                        }
                        onClick={() =>
                           setThemeMode((prev) =>
                              prev === "dark" ? "light" : "dark",
                           )
                        }
                     >
                        {themeMode === "dark" ? "Light" : "Dark"}
                     </Button>
                  </Space>

                  <Menu
                     mode="horizontal"
                     items={[
                        {
                           key: "envs",
                           icon: <DatabaseOutlined />,
                           label: "Environments",
                        },
                        // {
                        //    key: "compare",
                        //    icon: <SyncOutlined />,
                        //    label: "Compare",
                        // },
                        // {
                        //    key: "migrate",
                        //    icon: <CloudUploadOutlined />,
                        //    label: "Migrate",
                        // },
                     ]}
                     selectedKeys={["envs"]}
                  />

                  <EnvironmentManager
                     groups={groups}
                     allEnvironments={environments}
                     onCreateGroup={addGroup}
                     onRenameGroup={renameGroup}
                     onDeleteGroup={deleteGroup}
                     onAdd={addEnvironment}
                     onEdit={editEnvironment}
                     onDelete={deleteEnvironment}
                     onReorderGroups={reorderGroups}
                     onReorderEnvironments={reorderEnvironments}
                  />
               </Space>
            </Sider>

            <Layout style={{ height: "100vh", overflowY: "auto" }}>
               <Header
                  style={{
                     background: "transparent",
                     padding: 16,
                     height: "auto",
                  }}
               >
                  <ComparePanel
                     groups={groups}
                     selectedSourceId={selectedSourceId}
                     selectedTargetId={selectedTargetId}
                     categories={selectedCategories}
                     startContentKey={startContentKey}
                     ignoredJsonProperties={ignoredJsonProperties}
                     comparisonProgress={comparisonProgress}
                     isComparing={isComparing}
                     canCompare={canCompare}
                     onSourceChange={setSelectedSourceId}
                     onTargetChange={setSelectedTargetId}
                     onCategoriesChange={setSelectedCategories}
                     onStartContentKeyChange={setStartContentKey}
                     onIgnoredJsonPropertiesChange={setIgnoredJsonProperties}
                     onCompare={runCompare}
                     onRefresh={runCompare}
                  />
               </Header>

               <Content style={{ padding: 16 }}>
                  <Space
                     orientation="vertical"
                     style={{ width: "100%" }}
                     size="large"
                  >
                     {/* <Alert
                        type="info"
                        showIcon
                        title="Authentication flow: OAuth2 Client Credentials per environment with automatic token refresh on 401."
                     /> */}

                     <Card size="small">
                        <Space wrap>
                           <Button
                              type="primary"
                              icon={<CloudUploadOutlined />}
                              disabled={
                                 !hasComparisonData ||
                                 isComparing ||
                                 migrationRunning
                              }
                              onClick={() => confirmAndMigrate()}
                           >
                              Migrate Selected Differences → Target
                           </Button>
                           <Button
                              icon={<DownloadOutlined />}
                              disabled={!hasComparisonData}
                              onClick={exportComparison}
                           >
                              Export Comparison JSON
                           </Button>
                           {hasComparisonData && (
                              <Tag color="processing">
                                 Compared at{" "}
                                 {new Date(
                                    safeComparisonResult?.generatedAt ??
                                       Date.now(),
                                 ).toLocaleString()}
                              </Tag>
                           )}
                        </Space>
                     </Card>

                     <Spin
                        spinning={isComparing}
                        description="Comparing environments..."
                     >
                        {!hasComparisonData ? (
                           <Card>
                              <Typography.Text type="secondary">
                                 Select environments and click Compare to see
                                 differences.
                              </Typography.Text>
                           </Card>
                        ) : (
                           <Tabs
                              items={selectedCategories.map((category) => {
                                 if (category === "contents") {
                                    return {
                                       key: "contents",
                                       label: "Contents",
                                       children: (
                                          <Space
                                             orientation="vertical"
                                             style={{ width: "100%" }}
                                          >
                                             <ContentTreeSelector
                                                tree={
                                                   safeComparisonResult?.sourceContentTree ??
                                                   []
                                                }
                                                checkedKeys={checkedContentKeys}
                                                onCheckedKeysChange={
                                                   setCheckedContentKeys
                                                }
                                             />
                                             <DiffTable
                                                title="Contents"
                                                items={
                                                   safeComparisonResult
                                                      ?.categories.contents ??
                                                   []
                                                }
                                                isMigrating={migrationRunning}
                                                isDarkTheme={
                                                   themeMode === "dark"
                                                }
                                                ignoredJsonProperties={
                                                   ignoredJsonProperties
                                                }
                                                hideIdenticalItems={
                                                   hideIdenticalContents
                                                }
                                                showHideIdenticalToggle
                                                onHideIdenticalItemsChange={
                                                   setHideIdenticalContents
                                                }
                                                enablePushToTarget={false}
                                                onPushItem={(item) =>
                                                   confirmAndMigrate(item)
                                                }
                                             />
                                             <Alert
                                                type="warning"
                                                showIcon
                                                title="Contents feature is under development"
                                                description="Use Contents to identify missing/not-identical items only. Content migration is currently disabled."
                                             />
                                          </Space>
                                       ),
                                    };
                                 }

                                 if (category === "contentTypes") {
                                    return {
                                       key: "contentTypes",
                                       label: "Content Types",
                                       children: (
                                          <DiffTable
                                             title="Content Types"
                                             items={
                                                safeComparisonResult?.categories
                                                   .contentTypes ?? []
                                             }
                                             isMigrating={migrationRunning}
                                             isDarkTheme={themeMode === "dark"}
                                             ignoredJsonProperties={
                                                ignoredJsonProperties
                                             }
                                             hideIdenticalItems={
                                                hideIdenticalContentTypes
                                             }
                                             showHideIdenticalToggle
                                             onHideIdenticalItemsChange={
                                                setHideIdenticalContentTypes
                                             }
                                             onPushItem={(item) =>
                                                confirmAndMigrate(item)
                                             }
                                          />
                                       ),
                                    };
                                 }

                                 return {
                                    key: "displayTemplates",
                                    label: "Display Templates",
                                    children: (
                                       <DiffTable
                                          title="Display Templates"
                                          items={
                                             safeComparisonResult?.categories
                                                .displayTemplates ?? []
                                          }
                                          isMigrating={migrationRunning}
                                          isDarkTheme={themeMode === "dark"}
                                          ignoredJsonProperties={
                                             ignoredJsonProperties
                                          }
                                          hideIdenticalItems={
                                             hideIdenticalDisplayTemplates
                                          }
                                          showHideIdenticalToggle
                                          onHideIdenticalItemsChange={
                                             setHideIdenticalDisplayTemplates
                                          }
                                          onPushItem={(item) =>
                                             confirmAndMigrate(item)
                                          }
                                       />
                                    ),
                                 };
                              })}
                           />
                        )}
                     </Spin>
                  </Space>
               </Content>
            </Layout>
         </Layout>

         <MigrationLogModal
            open={migrationOpen}
            running={migrationRunning}
            logs={migrationLogs}
            onClose={() => setMigrationOpen(false)}
         />
      </ConfigProvider>
   );
};

export default App;
