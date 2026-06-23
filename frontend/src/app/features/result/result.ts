import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api-service';
import { ExtractionResult, ExtractedField, DOCUMENT_TYPE_CONFIG } from '../../core/models/document';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './result.html',
})
export class Result implements OnInit {
  private apiService = inject(ApiService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);

  result        = signal<ExtractionResult | null>(null);
  similarDocs   = signal<ExtractionResult[]>([]);
  isLoading     = signal<boolean>(true);
  isFindingSimilar = signal<boolean>(false);
  showRawJson   = signal<boolean>(false);
  errorMessage  = signal<string>('');

  readonly config = DOCUMENT_TYPE_CONFIG;
  readonly Object = Object;

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.router.navigate(['/history']);
      return;
    }

    this.apiService.getResultById(id).subscribe({
      next: (data) => {
        this.result.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Result not found or failed to load.');
        this.isLoading.set(false);
      },
    });
  }

  findSimilar(): void {
    const id = this.result()?.id;
    if (!id) return;

    this.isFindingSimilar.set(true);
    this.similarDocs.set([]);

    this.apiService.findSimilar(id).subscribe({
      next: (docs) => {
        this.similarDocs.set(docs);
        this.isFindingSimilar.set(false);
      },
      error: () => {
        this.isFindingSimilar.set(false);
      },
    });
  }

  viewSimilar(id: string): void {
    this.router.navigate(['/result', id]);
    this.similarDocs.set([]);
  }

  getSimilarityPercent(score: number | undefined): number {
    if (score === undefined) return 0;
    return Math.min(100, Math.round((1 - score / 2) * 100));
  }

  getConfidenceClass(confidence: number): string {
    const score = Math.round(confidence * 100);
    if (score >= 80) return 'confidence-high';
    if (score >= 50) return 'confidence-medium';
    return 'confidence-low';
  }

  getConfidenceLabel(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  getFields(result: ExtractionResult): [string, ExtractedField][] {
    return Object.entries(result.fields).sort((a, b) =>
      b[1].confidence - a[1].confidence
    );
  }

  get rawJson(): string {
    const { embedding, ...rest } = this.result() as any;
    return JSON.stringify(rest, null, 2);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}