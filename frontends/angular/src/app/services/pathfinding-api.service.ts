import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HealthStatus, PathfindingRequest, PathfindingResponse } from '../models/contract.models';

@Injectable({
  providedIn: 'root'
})
export class PathfindingApiService {
  private readonly baseUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.baseUrl}/health`);
  }

  tracePath(request: PathfindingRequest): Observable<PathfindingResponse> {
    return this.http.post<PathfindingResponse>(`${this.baseUrl}/pathfinding/trace`, request);
  }
}
