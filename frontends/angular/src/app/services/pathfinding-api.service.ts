import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  SavePresetRequest
} from '../models/contract.models';

@Injectable({
  providedIn: 'root'
})
export class PathfindingApiService {
  private readonly baseUrl = '/api/v1';

  constructor(private http: HttpClient) {}

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
