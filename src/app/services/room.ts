import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly userNameKey = 'collab-draw-user-name';

  get userName() {
    return localStorage.getItem(this.userNameKey) ?? '';
  }

  set userName(value: string) {
    localStorage.setItem(this.userNameKey, value);
  }
}