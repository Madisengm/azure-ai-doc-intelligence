import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api-service'; 
import { SignalRService } from '../../core/services/signalr';
import { ExtractionResult, DOCUMENT_TYPE_CONFIG } from '../../core/models/document';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './history.html',
})
export class History implements OnInit, OnDestroy {
  private apiService    = inject(ApiService);
  private signalRService = inject(SignalRService);
  private router        = inject(Router);

  results       = signal<ExtractionResult[]>([]);
  isLoading     = signal<boolean>(true);
  errorMessage  = signal<string>('');
  isConnected   = signal<boolean>(false);
  searchQuery    = signal<string>('');
  searchResults  = signal<ExtractionResult[]>([]);
  isSearching    = signal<boolean>(false);
  searchError    = signal<string>('');
  hasSearched    = signal<boolean>(false);

  readonly Object = Object;
  readonly config = DOCUMENT_TYPE_CONFIG;

  private signalRSub?: Subscription;
  private stateSub?:   Subscription;

  async ngOnInit(): Promise<void> {
    this.loadResults();

    await this.signalRService.connect();

    this.stateSub = this.signalRService.onConnectionState.subscribe(state => {
      this.isConnected.set(state.connected);
    });

    this.signalRSub = this.signalRService.onDocumentProcessed.subscribe(result => {
      this.upsertResult(result);
    });

    this.isConnected.set(this.signalRService.isConnected);
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
    this.stateSub?.unsubscribe();
    this.signalRService.disconnect();
  }

  loadResults(): void {
    this.apiService.getAllResults().subscribe({
      next: (data) => {
        this.results.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to load results. Is the API running?');
        this.isLoading.set(false);
        console.error('getAllResults error:', err);
      },
    });
  }

  private upsertResult(incoming: ExtractionResult): void {
    const current = this.results();
    const index   = current.findIndex(r => r.id === incoming.id);

    if (index !== -1) {
      const updated = [...current];
      updated[index] = incoming;
      this.results.set(updated);
    } else {
      this.results.set([incoming, ...current]);
    }
  }

  viewResult(id: string): void {
    this.router.navigate(['/result', id]);
  }

  getConfidenceAverage(result: ExtractionResult): number {
    const fields = Object.values(result.fields);
    if (!fields.length) return 0;
    const total = fields.reduce((sum, f) => sum + f.confidence, 0);
    return Math.round((total / fields.length) * 100);
  }

  getConfidenceClass(score: number): string {
    if (score >= 80) return 'confidence-high';
    if (score >= 50) return 'confidence-medium';
    return 'confidence-low';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      completed:  'bg-green-100 text-green-700',
      processing: 'bg-yellow-100 text-yellow-700 animate-pulse',
      failed:     'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }
  
  getSimilarityPercent(score: number | undefined): number {
    if (score === undefined) return 0;
    return Math.min(100, Math.round((1 - score / 2) * 100));
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  search(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.isSearching.set(true);
    this.searchError.set('');
    this.hasSearched.set(true);

    this.apiService.searchDocuments(query).subscribe({
      next: (docs) => {
        this.searchResults.set(docs);
        this.isSearching.set(false);
      },
      error: () => {
        this.searchError.set('Search failed. Please try again.');
        this.isSearching.set(false);
      },
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.hasSearched.set(false);
    this.searchError.set('');
  }
}