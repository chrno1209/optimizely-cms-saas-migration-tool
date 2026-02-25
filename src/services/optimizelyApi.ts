import { ContentNode, EnvironmentConfig } from '../types';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.trim() || '/optimizely-proxy';

const OAUTH_URL = `${API_ORIGIN}/oauth/token`;
const CMS_BASE_URL = `${API_ORIGIN}/preview3`;

type TokenInfo = {
  token: string;
  expiresAt: number;
};

const asArray = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.items)) {
      return obj.items as T[];
    }

    if (Array.isArray(obj.data)) {
      return obj.data as T[];
    }
  }

  return [];
};

export class OptimizelyApiService {
  private tokenCache = new Map<string, TokenInfo>();

  private async getAccessToken(environment: EnvironmentConfig, forceRefresh = false): Promise<string> {
    const current = this.tokenCache.get(environment.id);
    const now = Date.now();

    if (!forceRefresh && current && current.expiresAt > now + 30_000) {
      return current.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: environment.clientId,
      client_secret: environment.clientSecret,
    });

    const response = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        throw new Error(`Invalid credentials for environment "${environment.name}".`);
      }
      throw new Error(`Failed to obtain token for environment "${environment.name}" (${response.status}).`);
    }

    const data = (await response.json()) as { access_token: string; expires_in?: number };

    if (!data.access_token) {
      throw new Error(`No access token returned for environment "${environment.name}".`);
    }

    const expiresInSeconds = data.expires_in ?? 3600;

    this.tokenCache.set(environment.id, {
      token: data.access_token,
      expiresAt: now + expiresInSeconds * 1000,
    });

    return data.access_token;
  }

  private buildUrl(path: string): string {
    if (path.startsWith('/')) {
      return `${CMS_BASE_URL}${path}`;
    }
    return `${CMS_BASE_URL}/${path}`;
  }

  async request<T>(
    environment: EnvironmentConfig,
    path: string,
    init?: RequestInit,
    retryOnUnauthorized = true,
  ): Promise<T> {
    const token = await this.getAccessToken(environment);

    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 && retryOnUnauthorized) {
      await this.getAccessToken(environment, true);
      return this.request<T>(environment, path, init, false);
    }

    if (!response.ok) {
      const maybeText = await response.text();
      const reason = maybeText?.trim() || `HTTP ${response.status}`;
      throw new Error(`API call failed for "${environment.name}": ${reason}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async listContentTypes(environment: EnvironmentConfig): Promise<Record<string, unknown>[]> {
    const response = await this.request<unknown>(environment, '/contenttypes?pageSize=5000');
    return asArray<Record<string, unknown>>(response);
  }

  async getContentType(environment: EnvironmentConfig, key: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/contenttypes/${encodeURIComponent(key)}`);
  }

  async createContentType(environment: EnvironmentConfig, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, '/contenttypes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateContentType(environment: EnvironmentConfig, key: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/contenttypes/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async listDisplayTemplates(environment: EnvironmentConfig): Promise<Record<string, unknown>[]> {
    const response = await this.request<unknown>(environment, '/displaytemplates?pageSize=5000');
    return asArray<Record<string, unknown>>(response);
  }

  async getDisplayTemplate(environment: EnvironmentConfig, key: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/displaytemplates/${encodeURIComponent(key)}`);
  }

  async createDisplayTemplate(environment: EnvironmentConfig, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, '/displaytemplates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDisplayTemplate(environment: EnvironmentConfig, key: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/displaytemplates/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async listContent(environment: EnvironmentConfig): Promise<Record<string, unknown>[]> {
    const response = await this.request<unknown>(environment, '/experimental/content');
    return asArray<Record<string, unknown>>(response);
  }

  async listContentChildren(environment: EnvironmentConfig, key: string): Promise<Record<string, unknown>[]> {
    const response = await this.request<unknown>(environment, `/experimental/content/${encodeURIComponent(key)}/items`);
    return asArray<Record<string, unknown>>(response);
  }

  async getContent(environment: EnvironmentConfig, key: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/experimental/content/${encodeURIComponent(key)}`);
  }

  async createContent(environment: EnvironmentConfig, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, '/experimental/content', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateContent(environment: EnvironmentConfig, key: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(environment, `/experimental/content/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async copyContent(environment: EnvironmentConfig, key: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
      return await this.request<Record<string, unknown>>(environment, `/experimental/content/${encodeURIComponent(key)}:copy`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return null;
    }
  }

  async buildContentTree(environment: EnvironmentConfig, startKey?: string): Promise<ContentNode[]> {
    const visited = new Set<string>();

    const getContentLabel = (item: Record<string, unknown>, fallback: string): string => {
      const locales = item.locales;
      if (locales && typeof locales === 'object') {
        const localizedNames = Object.entries(locales as Record<string, unknown>)
          .map(([localeCode, localeValue]) => {
            if (!localeValue || typeof localeValue !== 'object') {
              return '';
            }

            const displayName = (localeValue as Record<string, unknown>).displayName;
            if (typeof displayName !== 'string' || !displayName.trim()) {
              return '';
            }

            return `[${localeCode}] ${displayName.trim()}`;
          })
          .filter(Boolean);

        if (localizedNames.length > 0) {
          return localizedNames.join(' | ');
        }
      }

      const displayName = typeof item.displayName === 'string' ? item.displayName.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      return displayName || name || fallback;
    };

    const toNode = async (item: Record<string, unknown>): Promise<ContentNode> => {
      const key = String(item.key ?? '');
      if (!key) {
        return {
          key: crypto.randomUUID(),
          name: getContentLabel(item, '(Unnamed)'),
          ...item,
          children: [],
        };
      }

      if (visited.has(key)) {
        return {
          ...(item as ContentNode),
          key,
          name: getContentLabel(item, key),
          children: [],
        };
      }

      visited.add(key);
      const childrenRaw = await this.listContentChildren(environment, key);
      const children = await Promise.all(childrenRaw.map((child) => toNode(child)));

      return {
        ...(item as ContentNode),
        key,
        name: getContentLabel(item, key),
        children,
      };
    };

    if (startKey) {
      const root = await this.getContent(environment, startKey);
      return [await toNode(root)];
    }

    const roots = await this.listContent(environment);
    return Promise.all(roots.map((root) => toNode(root)));
  }
}

export const optimizelyApi = new OptimizelyApiService();
