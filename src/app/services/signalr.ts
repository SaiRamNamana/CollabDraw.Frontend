import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';

export interface RemoteCursor {
    connectionId: string;
    x: number;
    y: number;
    userName: string;
    isDrawing: boolean;
}

export interface RoomUser {
    connectionId: string;
    userName: string;
}

@Injectable({ providedIn: 'root' })
export class SignalrService {
    private connection: signalR.HubConnection;
    private startPromise: Promise<void>;
    private activeRoom: { roomId: string; userName: string } | null = null;

    constructor() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(environment.signalRUrl)
            .withAutomaticReconnect()
            .build();

        this.connection.onreconnected(() => {
            if (this.activeRoom) {
                void this.connection.invoke(
                    'JoinRoom',
                    this.activeRoom.roomId,
                    this.activeRoom.userName
                );
            }
        });

        this.startPromise = this.connection.start().catch(err => {
            console.error('SignalR connection failed:', err);
            throw err;
        });
    }

    async joinRoom(roomId: string, userName: string) {
        await this.startPromise;
        const result = await this.connection.invoke('JoinRoom', roomId, userName);
        this.activeRoom = { roomId, userName };
        return result;
    }

    async leaveRoom(roomId: string) {
        await this.startPromise;
        const result = await this.connection.invoke('LeaveRoom', roomId);
        this.activeRoom = null;
        return result;
    }

    async resetRoom(roomId: string) {
        await this.startPromise;
        return this.connection.invoke('ResetRoom', roomId);
    }

    async sendUpdate(roomId: string, update: Uint8Array) {
        await this.startPromise;
        let binary = '';
        for (const byte of update) {
            binary += String.fromCharCode(byte);
        }
        const base64 = btoa(binary);
        return this.connection.invoke('SendUpdate', roomId, base64);
    }

    onUpdateReceived(callback: (update: Uint8Array) => void) {
        this.connection.on('ReceiveUpdate', (base64: string) => {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            callback(bytes);
        });
    }

    onRoomReset(callback: () => void) {
        this.connection.on('RoomReset', callback);
    }

    onPresenceUpdate(callback: (users: RoomUser[]) => void) {
        this.connection.on('PresenceUpdate', (users: RoomUser[]) => callback(users));
    }

    onCursorReceived(callback: (cursor: RemoteCursor) => void) {
        this.connection.on('ReceiveCursor', (cursor: RemoteCursor) => callback(cursor));
    }

    async sendCursor(roomId: string, x: number, y: number, isDrawing: boolean) {
        await this.startPromise;
        return this.connection.send('SendCursor', roomId, x, y, isDrawing);
    }
}