import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ApiService } from './api-service';
import { DocumentType, UploadUrlResponse } from '../models/document';

export interface UploadProgress {
  percent: number;
  blobName?: string;
  documentType?: DocumentType;
  sasUrl?: string;
  resultId?: string;
  processingDone?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http       = inject(HttpClient);
  private apiService = inject(ApiService);

  readonly ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
  ];

  readonly MAX_SIZE_MB = 10;

  validate(file: File): string | null {
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return `File type not supported. Please upload a PDF, JPEG, PNG, or TIFF.`;
    }
    if (file.size > this.MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${this.MAX_SIZE_MB}MB.`;
    }
    return null;
  }

  upload(file: File, documentType: DocumentType): Observable<UploadProgress> {
    const validationError = this.validate(file);
    if (validationError) return throwError(() => new Error(validationError));

    return new Observable(observer => {
      this.apiService.getUploadUrl({
        fileName: file.name,
        fileType: file.type,
        documentType,
      }).subscribe({
        next: (urlResponse: UploadUrlResponse) => {
          this.http.put(urlResponse.sasUrl, file, {
            headers: new HttpHeaders({
              'x-ms-blob-type': 'BlockBlob',
              'Content-Type':   file.type,
            }),
            reportProgress: true,
            observe:        'events',
          }).pipe(
            filter(event =>
              event.type === HttpEventType.UploadProgress ||
              event.type === HttpEventType.Response
            ),
            map(event => {
              if (event.type === HttpEventType.UploadProgress) {
                const percent = event.total
                  ? Math.round((event.loaded / event.total) * 100)
                  : 0;
                return {
                  percent,
                  blobName:     urlResponse.blobName,
                  documentType: urlResponse.documentType,
                } as UploadProgress;
              }
              // FIX: blob upload complete — Event Grid takes over from here.
              // No explicit processDocument call needed.
              return {
                percent:        100,
                blobName:       urlResponse.blobName,
                documentType:   urlResponse.documentType,
                processingDone: true,
              } as UploadProgress;
            })
          ).subscribe({
            next:     progress => observer.next(progress),
            error:    err      => observer.error(err),
            complete: ()       => observer.complete(),
          });
        },
        error: err => observer.error(err),
      });
    });
  }
}