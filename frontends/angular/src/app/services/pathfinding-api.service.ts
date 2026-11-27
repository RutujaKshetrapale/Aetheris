import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
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
} from '../models/contract.models';

declare global {
  interface Window {
    __AETHERIS_API_BASE_URL__?: string;
  }
}

export function normalizeApiBaseUrl(originOrBaseUrl?: string): string {
  const configured = (originOrBaseUrl ?? '').trim();
  if (!configured) {
    return '/api/v1';
  }
  const trimmed = configured.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

export function formatHttpError(err: unknown, activeBaseUrl: string, fallbackMessage: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return `Backend API unreachable (${activeBaseUrl}). Verify the backend server is running or explicitly switch to Offline Local Engine (Dev) mode.`;
    }
    const problem = err.error as ProblemDetails | string | null;
    if (problem && typeof problem === 'object' && ('title' in problem || 'detail' in problem)) {
      const title = problem.title || `HTTP ${err.status}`;
      const detail = problem.detail || err.message;
      return `HTTP ${problem.status || err.status} • ${title}: ${detail}`;
    }
    if (typeof problem === 'string') {
      try {
        const parsed = JSON.parse(problem) as ProblemDetails;
        if (parsed && (parsed.title || parsed.detail)) {
          return `HTTP ${parsed.status || err.status} • ${parsed.title}: ${parsed.detail || err.message}`;
        }
      } catch {
        return `HTTP ${err.status}: ${problem || err.statusText}`;
      }
    }
    return `HTTP ${err.status}: ${err.statusText || err.message}`;
  }
  if (err instanceof Error) return err.message;
  return fallbackMessage;
}

@Injectable({
  providedIn: 'root'
})
export class PathfindingApiService {
  private baseUrl: string;

  constructor(private http: HttpClient) {
    const initial =
      typeof window !== 'undefined' ? window.__AETHERIS_API_BASE_URL__ : undefined;
    this.baseUrl = normalizeApiBaseUrl(initial);
  }

  getApiBaseUrl(): string {
    return this.baseUrl;
  }

  setApiBaseUrl(originOrBaseUrl?: string): void {
    this.baseUrl = normalizeApiBaseUrl(originOrBaseUrl);
  }

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.baseUrl}/health`);
  }

  getLiveness(): Observable<ProbeStatus> {
    return this.http.get<ProbeStatus>(`${this.baseUrl}/health/live`);
  }

  getReadiness(): Observable<ProbeStatus> {
    return this.http.get<ProbeStatus>(`${this.baseUrl}/health/ready`);
  }

  getAlgorithms(): Observable<AlgorithmInfo[]> {
    return this.http.get<AlgorithmInfo[]>(`${this.baseUrl}/pathfinding/algorithms`);
  }

  tracePath(request: PathfindingRequest): Observable<PathfindingResponse> {
    return this.http.post<PathfindingResponse>(`${this.baseUrl}/pathfinding/trace`, request);
  }

  getPresets(): Observable<GridPreset[]> {
    return this.http.get<GridPreset[]>(`${this.baseUrl}/presets`);
  }

  getPreset(id: string): Observable<GridPreset> {
    return this.http.get<GridPreset>(`${this.baseUrl}/presets/${encodeURIComponent(id)}`);
  }

  createPreset(request: SavePresetRequest): Observable<GridPreset> {
    return this.http.post<GridPreset>(`${this.baseUrl}/presets`, request);
  }

  updatePreset(id: string, request: SavePresetRequest): Observable<GridPreset> {
    return this.http.put<GridPreset>(`${this.baseUrl}/presets/${encodeURIComponent(id)}`, request);
  }

  deletePreset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/presets/${encodeURIComponent(id)}`);
  }

  exportPresets(request?: ExportPresetsRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/presets/export`, request ?? {}, { responseType: 'text' });
  }

  importPresets(bundleJson: string): Observable<ImportPresetsResponse> {
    return this.http.post<ImportPresetsResponse>(`${this.baseUrl}/presets/import`, bundleJson, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  runBenchmark(request: BenchmarkRequest): Observable<BenchmarkRecord> {
    return this.http.post<BenchmarkRecord>(`${this.baseUrl}/benchmarks`, request);
  }

  getBenchmark(id: string): Observable<BenchmarkRecord> {
    return this.http.get<BenchmarkRecord>(`${this.baseUrl}/benchmarks/${encodeURIComponent(id)}`);
  }
}
