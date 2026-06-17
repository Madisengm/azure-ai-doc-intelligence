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

  processDocument(blobName: string, documentType: string): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(
      `${this.base}/process-document`,
      { blobName, documentType }
    );
  }

  findSimilar(id: string): Observable<ExtractionResult[]> {
    return this.http
      .get<{ results: ExtractionResult[] }>(`${this.base}/find-similar/${id}`)
      .pipe(map(res => res.results));
  }

  searchDocuments(query: string): Observable<ExtractionResult[]> {
    return this.http
      .post<{ results: ExtractionResult[] }>(`${this.base}/search-documents`, { query })
      .pipe(map(res => res.results));
  }
}