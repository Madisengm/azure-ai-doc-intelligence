import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'upload',
    pathMatch: 'full'
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./features/upload/upload')
        .then(m => m.Upload)
  },
  {
    path: 'result/:id',
    loadComponent: () =>
      import('./features/result/result')
        .then(m => m.Result)
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history')
        .then(m => m.History)
  },
];