export interface EnvironmentConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
}

export interface EnvironmentGroup {
  groupId: string;
  groupName: string;
  environments: EnvironmentConfig[];
}

export type CompareCategory = 'contentTypes' | 'displayTemplates' | 'contents';

export type ComparisonStatus =
  | 'onlySource'
  | 'onlyTarget'
  | 'different'
  | 'identical';

export interface ContentType {
  key: string;
  name?: string;
  [key: string]: unknown;
}

export interface DisplayTemplate {
  key: string;
  name?: string;
  [key: string]: unknown;
}

export interface ContentItem {
  key: string;
  name?: string;
  parentKey?: string;
  [key: string]: unknown;
}

export interface ContentNode extends ContentItem {
  children?: ContentNode[];
}

export interface ComparisonItem<T = unknown> {
  category: CompareCategory;
  key: string;
  name: string;
  status: ComparisonStatus;
  sourceData?: T;
  targetData?: T;
}

export interface ComparisonResult {
  generatedAt: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  categories: Partial<Record<CompareCategory, ComparisonItem[]>>;
  sourceContentTree?: ContentNode[];
  targetContentTree?: ContentNode[];
}

export interface CategoryProgress {
  status: 'idle' | 'loading' | 'done' | 'error';
  message?: string;
}

export type ComparisonProgressMap = Record<CompareCategory, CategoryProgress>;
