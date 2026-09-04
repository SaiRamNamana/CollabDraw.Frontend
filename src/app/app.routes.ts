import { Routes } from '@angular/router';
import { LandingComponent } from '../app/components/landing/landing';
import { BoardComponent } from '../app/components/board/board';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'room', component: BoardComponent },
];