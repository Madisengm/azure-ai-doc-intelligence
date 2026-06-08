import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UploadService } from '../../core/services/upload';
import { DocumentType, DOCUMENT_TYPE_CONFIG } from '../../core/models/document';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './upload.html',
})
export class Upload {
  private uploadService = inject(UploadService);
  private router        = inject(Router);

  readonly documentTypes = Object.entries(DOCUMENT_TYPE_CONFIG) as [
    DocumentType,
    typeof DOCUMENT_TYPE_CONFIG[DocumentType]
  ][];

  selectedType  = signal<DocumentType | null>(null);
  selectedFile  = signal<File | null>(null);
  uploadState   = signal<UploadState>('idle');
  uploadPercent = signal<number>(0);
  errorMessage  = signal<string>('');
  isDragOver    = signal<boolean>(false);

  selectType(type: DocumentType): void {
    this.selectedType.set(type);
    this.errorMessage.set('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    const error = this.uploadService.validate(file);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.selectedFile.set(file);
    this.errorMessage.set('');
  }

  get canUpload(): boolean {
    return !!this.selectedType() &&
           !!this.selectedFile() &&
           this.uploadState() === 'idle';
  }

  upload(): void {
    const file = this.selectedFile();
    const type = this.selectedType();
    if (!file || !type) return;

    this.uploadState.set('uploading');
    this.uploadPercent.set(0);

    this.uploadService.upload(file, type).subscribe({
      next: progress => {
        this.uploadPercent.set(progress.percent);

        if (progress.percent === 100) {
          this.uploadState.set('success');
          setTimeout(() => this.router.navigate(['/history']), 1500);
        }
      },
      error: err => {
        this.uploadState.set('error');
        this.errorMessage.set(err?.message ?? 'Upload failed. Please try again.');
      },
    });
  }

  reset(): void {
    this.selectedFile.set(null);
    this.selectedType.set(null);
    this.uploadState.set('idle');
    this.uploadPercent.set(0);
    this.errorMessage.set('');
  }
}