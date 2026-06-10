import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExtractionResult } from '../models/document';

export interface SignalRConnectionState {
  connected: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private http       = inject(HttpClient);
  private connection?: signalR.HubConnection;

  private documentProcessed$ = new Subject<ExtractionResult>();
  readonly onDocumentProcessed = this.documentProcessed$.asObservable();

  private connectionState$ = new Subject<SignalRConnectionState>();
  readonly onConnectionState = this.connectionState$.asObservable();

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()

      .withUrl(environment.apiBase, {
        skipNegotiation: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(
        environment.production
          ? signalR.LogLevel.Warning
          : signalR.LogLevel.Information
      )
      .build();

    this.connection.on('documentProcessed', (result: ExtractionResult) => {
      this.documentProcessed$.next(result);
    });

    this.connection.onreconnecting(() => {
      this.connectionState$.next({ connected: false });
    });

    this.connection.onreconnected(() => {
      this.connectionState$.next({ connected: true });
    });

    this.connection.onclose((error) => {
      this.connectionState$.next({
        connected: false,
        error: error?.message,
      });
    });

    try {
      await this.connection.start();
      this.connectionState$.next({ connected: true });
      console.log('SignalR connected');
    } catch (err: any) {
      this.connectionState$.next({
        connected: false,
        error: err?.message ?? 'Connection failed',
      });
      console.error('SignalR connection failed:', err);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = undefined;
    }
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.documentProcessed$.complete();
    this.connectionState$.complete();
  }
}