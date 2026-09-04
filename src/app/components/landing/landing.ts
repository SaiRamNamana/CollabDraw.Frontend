import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../services/room';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './landing.html'
})
export class LandingComponent {
  name = '';
  roomId = '';
  mode: 'create' | 'join' = 'create';
  error = '';
  nameError = '';
  roomError = '';

  
  selectMode(mode: 'create' | 'join') {
    this.mode = mode;
    this.error = '';
    this.nameError = '';
    this.roomError = '';
  }
  constructor(private router: Router, private roomService: RoomService) {}

  submit() {
    this.nameError = this.name.trim() ? '' : 'Name is required';
    this.roomError = this.mode === 'join' && !this.roomId.trim() ? 'Room ID is required' : '';
    this.error = '';
    if (this.nameError || this.roomError) return;

    const finalRoomId = this.mode === 'create'
      ? crypto.randomUUID().slice(0, 8)
      : this.roomId.trim();

    this.roomService.userName = this.name.trim();
    this.router.navigate(['/room'], { queryParams: { id: finalRoomId } });
  }

  clearNameError() {
    this.nameError = '';
  }

  clearRoomError() {
    this.roomError = '';
  }
}