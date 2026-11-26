import {
  AlgorithmInfo,
  BenchmarkRecord,
  BenchmarkRequest,
  ExportPresetsRequest,
  GridPreset,
  HealthStatus,
  ImportPresetsResponse,
  PathfindingRequest,
  PathfindingResponse,
  ProbeStatus,
  ProblemDetails,
  SavePresetRequest
} from '../types/contract';

export class ApiError extends Error {
  public readonly status: number;
  public readonly problem?: ProblemDetails;
  public readonly isNetworkError: boolean;

  constructor(message: string, status: number, problem?: ProblemDetails, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.isNetworkError = isNetworkError;
  }
}

export function resolveApiBaseUrl(overrideOrigin?: string): string {
  const configured = (overrideOrigin ?? import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '').trim();
  if (!configured) {
    return '/api/v1';
  }
  const trimmed = configured.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

let activeApiBaseUrl = resolveApiBaseUrl();

export function setApiBaseUrl(originOrBaseUrl?: string): void {
  activeApiBaseUrl = resolveApiBaseUrl(originOrBaseUrl);
}

export function getApiBaseUrl(): string {
  return activeApiBaseUrl;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${activeApiBaseUrl}${path}`, init);
  } catch (err: any) {
    throw new ApiError(
      err?.message || 'Unable to reach the configured backend API.',
      0,
      undefined,
      true
    );
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      try {
        const problem = JSON.parse(rawText) as ProblemDetails;
        const msg = problem.detail || problem.title || `HTTP ${res.status}`;
        throw new ApiError(`HTTP ${res.status} (${problem.title}): ${msg}`, res.status, problem, false);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
    throw new ApiError(`HTTP ${res.status}: ${rawText || res.statusText}`, res.status, undefined, false);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${activeApiBaseUrl}${path}`, init);
  } catch (err: any) {
    throw new ApiError(
      err?.message || 'Unable to reach the configured backend API.',
      0,
      undefined,
      true
    );
  }

  const rawText = await res.text();
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      try {
        const problem = JSON.parse(rawText) as ProblemDetails;
        const msg = problem.detail || problem.title || `HTTP ${res.status}`;
        throw new ApiError(`HTTP ${res.status} (${problem.title}): ${msg}`, res.status, problem, false);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
    throw new ApiError(`HTTP ${res.status}: ${rawText || res.statusText}`, res.status, undefined, false);
  }

  return rawText;
}

export class AetherisApiClient {
  static getHealth(): Promise<HealthStatus> {
    return requestJson<HealthStatus>('/health');
  }

  static getLiveness(): Promise<ProbeStatus> {
    return requestJson<ProbeStatus>('/health/live');
  }

  static getReadiness(): Promise<ProbeStatus> {
    return requestJson<ProbeStatus>('/health/ready');
  }

  static getAlgorithms(): Promise<AlgorithmInfo[]> {
    return requestJson<AlgorithmInfo[]>('/pathfinding/algorithms');
  }

  static tracePath(request: PathfindingRequest): Promise<PathfindingResponse> {
    return requestJson<PathfindingResponse>('/pathfinding/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  static getPresets(): Promise<GridPreset[]> {
    return requestJson<GridPreset[]>('/presets');
  }

  static getPreset(id: string): Promise<GridPreset> {
    return requestJson<GridPreset>(`/presets/${encodeURIComponent(id)}`);
  }

  static createPreset(request: SavePresetRequest): Promise<GridPreset> {
    return requestJson<GridPreset>('/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  static updatePreset(id: string, request: SavePresetRequest): Promise<GridPreset> {
    return requestJson<GridPreset>(`/presets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  static deletePreset(id: string): Promise<void> {
    return requestJson<void>(`/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  static exportPresets(request?: ExportPresetsRequest): Promise<string> {
    return requestText('/presets/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request ?? {})
    });
  }

  static importPresets(bundleJson: string): Promise<ImportPresetsResponse> {
    return requestJson<ImportPresetsResponse>('/presets/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bundleJson
    });
  }

  static runBenchmark(request: BenchmarkRequest): Promise<BenchmarkRecord> {
    return requestJson<BenchmarkRecord>('/benchmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  static getBenchmark(id: string): Promise<BenchmarkRecord> {
    return requestJson<BenchmarkRecord>(`/benchmarks/${encodeURIComponent(id)}`);
  }
}
