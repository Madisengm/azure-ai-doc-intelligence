import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExtractionResult, UploadUrlRequest, UploadUrlResponse } from '../models/document';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  getUploadUrl(payload: UploadUrlRequest): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(
      `${this.base}/get-upload-url`,
      payload
    );
  }

  getAllResults(): Observable<ExtractionResult[]> {
    return this.http
      .get<{ results: ExtractionResult[] }>(`${this.base}/get-results`)
      .pipe(map(res => res.results));
  }

  getResultById(id: string): Observable<ExtractionResult> {
    return this.http.get<ExtractionResult>(`${this.base}/results/${id}`);
  }
}