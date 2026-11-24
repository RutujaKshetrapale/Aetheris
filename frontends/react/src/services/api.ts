import {
  AlgorithmInfo,
  GridPreset,
  HealthStatus,
  PathfindingRequest,
  PathfindingResponse
} from '../types/contract';

const API_BASE = '/api/v1';

export class AetherisApiClient {
  static async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  static async getAlgorithms(): Promise<AlgorithmInfo[]> {
    const res = await fetch(`${API_BASE}/pathfinding/algorithms`);
    if (!res.ok) throw new Error(`Failed to load algorithms: ${res.statusText}`);
    return res.json();
  }

  static async findPath(request: PathfindingRequest): Promise<PathfindingResponse> {
    const res = await fetch(`${API_BASE}/pathfinding/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pathfinding failed: ${err || res.statusText}`);
    }
    return res.json();
  }

  static async getPresets(): Promise<GridPreset[]> {
    const res = await fetch(`${API_BASE}/presets`);
    if (!res.ok) throw new Error(`Failed to fetch presets: ${res.statusText}`);
    return res.json();
  }
}
