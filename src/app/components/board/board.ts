import { AfterViewInit, Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as Y from 'yjs';
import { RemoteCursor, RoomUser, SignalrService } from '../../services/signalr';
import { RoomService } from '../../services/room';

interface Segment { x1: number; y1: number; x2: number; y2: number; color: string; size?: number; }

const BOARD_WIDTH = 900;
const BOARD_HEIGHT = 600;

@Component({
  selector: 'app-board',
  standalone: true,
  templateUrl: './board.html'
})
export class BoardComponent implements OnInit, AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  roomId = '';
  userName = '';
  copied = false;
  joined = false;
  drawing = false;
  leaving = false;
  penColor = '#1e293b';
  penSize = 4;
  toolsOpen = false;
  participantsOpen = false;
  resetConfirmOpen = false;
  darkMode = localStorage.getItem('collab-draw-theme') === 'dark';
  activeUsers: RoomUser[] = [];
  visibleParticipantCount = 25;
  remoteCursors: RemoteCursor[] = [];
  lastPoint: { x: number; y: number } | null = null;

  private yDoc = new Y.Doc();
  private ySegments = this.yDoc.getArray<Segment>('segments');
  private undoManager = new Y.UndoManager(this.ySegments, {
    trackedOrigins: new Set([null])
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private signalr: SignalrService,
    private roomService: RoomService
  ) {}

  ngOnInit() {
    this.roomId = this.route.snapshot.queryParamMap.get('id') ?? '';
    this.userName = this.roomService.userName;

    // Local edits -> broadcast. 'origin' distinguishes local vs remote changes
    // so we don't re-broadcast updates we just received.
    this.yDoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') {
        this.signalr.sendUpdate(this.roomId, update);
      }
    });

    this.signalr.onUpdateReceived((update) => {
      Y.applyUpdate(this.yDoc, update, 'remote');
    });

    this.signalr.onRoomReset(() => {
      this.yDoc.transact(() => {
        if (this.ySegments.length > 0) {
          this.ySegments.delete(0, this.ySegments.length);
        }
      }, 'remote');
    });

    this.signalr.onCursorReceived((cursor) => {
      if (!cursor.isDrawing) {
        this.remoteCursors = this.remoteCursors.filter(
          (item) => item.connectionId !== cursor.connectionId
        );
        return;
      }

      this.remoteCursors = [
        ...this.remoteCursors.filter((item) => item.connectionId !== cursor.connectionId),
        cursor
      ];
    });

    this.signalr.onPresenceUpdate((users) => {
      this.activeUsers = users;
      this.visibleParticipantCount = Math.min(
        this.visibleParticipantCount,
        Math.max(25, users.length)
      );
      this.remoteCursors = this.remoteCursors.filter((cursor) =>
        users.some((user) => user.connectionId === cursor.connectionId)
      );
    });

    this.ySegments.observe(() => this.renderCanvas());

    this.signalr.joinRoom(this.roomId, this.userName)
      .then(() => this.joined = true)
      .catch((error) => console.error('Failed to join room:', error));
  }

  ngAfterViewInit() {
    this.configureCanvasResolution();
    this.renderCanvas();
  }

  copyRoomId() {
    navigator.clipboard.writeText(this.roomId);
    this.copied = true;
    setTimeout(() => this.copied = false, 1500);
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('collab-draw-theme', this.darkMode ? 'dark' : 'light');
  }

  get visibleParticipants() {
    return this.activeUsers.slice(0, this.visibleParticipantCount);
  }

  loadMoreParticipants(event: Event) {
    const element = event.target as HTMLElement;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;

    if (isNearBottom && this.visibleParticipantCount < this.activeUsers.length) {
      this.visibleParticipantCount = Math.min(
        this.visibleParticipantCount + 25,
        this.activeUsers.length
      );
    }
  }

  onMouseDown(e: MouseEvent) {
    if (!this.joined) return;
    this.drawing = true;
    this.lastPoint = this.getCanvasPoint(e);
    this.sendCursor(this.lastPoint, true);
  }

  onMouseMove(e: MouseEvent) {
    const point = this.getCanvasPoint(e);
    if (!this.drawing || !this.lastPoint) return;

    this.ySegments.push([{
      x1: this.lastPoint.x, y1: this.lastPoint.y,
      x2: point.x, y2: point.y,
      color: this.penColor,
      size: this.penSize
    }]);

    this.lastPoint = point;
    this.sendCursor(point, true);
  }

  stopDrawing() {
    if (this.drawing && this.lastPoint) {
      this.sendCursor(this.lastPoint, false);
    }
    this.drawing = false;
    this.lastPoint = null;
  }

  undo() {
    this.undoManager.undo();
  }

  redo() {
    this.undoManager.redo();
  }

  resetBoard() {
    this.resetConfirmOpen = true;
  }

  cancelReset() {
    this.resetConfirmOpen = false;
  }

  async confirmReset() {
    try {
      await this.signalr.resetRoom(this.roomId);
      this.resetConfirmOpen = false;
    } catch (error) {
      console.error('Failed to reset room:', error);
    }
  }

  get canUndo() {
    return this.undoManager.undoStack.length > 0;
  }

  get canRedo() {
    return this.undoManager.redoStack.length > 0;
  }

  async leaveRoom() {
    if (this.leaving) return;
    this.leaving = true;
    try {
      await this.signalr.leaveRoom(this.roomId);
    } finally {
      this.router.navigate(['/']);
    }
  }

  private getCanvasPoint(e: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (BOARD_WIDTH / rect.width),
      y: (e.clientY - rect.top) * (BOARD_HEIGHT / rect.height)
    };
  }

  private renderCanvas() {
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    let path: Segment[] = [];

    const flushPath = () => {
      if (path.length === 0) return;

      const first = path[0];
      ctx.strokeStyle = first.color;
      ctx.lineWidth = first.size ?? 2;
      ctx.beginPath();
      ctx.moveTo(first.x1, first.y1);
      for (const segment of path) {
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.stroke();
      path = [];
    };

    for (const segment of this.ySegments.toArray()) {
      const previous = path[path.length - 1];
      const continuesPath = previous &&
        previous.x2 === segment.x1 &&
        previous.y2 === segment.y1 &&
        previous.color === segment.color &&
        (previous.size ?? 2) === (segment.size ?? 2);

      if (path.length === 0 || continuesPath) {
        path.push(segment);
      } else {
        flushPath();
        path.push(segment);
      }
    }
    flushPath();
  }

  private configureCanvasResolution() {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));

    const ctx = canvas.getContext('2d');
    ctx?.scale(canvas.width / BOARD_WIDTH, canvas.height / BOARD_HEIGHT);
  }

  private sendCursor(point: { x: number; y: number }, isDrawing: boolean) {
    this.signalr.sendCursor(this.roomId, point.x, point.y, isDrawing)
      .catch((error) => console.error('Failed to send cursor:', error));
  }

  cursorLeft(x: number) {
    if (!this.canvasRef) return 0;
    const canvas = this.canvasRef.nativeElement;
    return canvas.offsetLeft + x * canvas.getBoundingClientRect().width / BOARD_WIDTH;
  }

  cursorTop(y: number) {
    if (!this.canvasRef) return 0;
    const canvas = this.canvasRef.nativeElement;
    return canvas.offsetTop + y * canvas.getBoundingClientRect().height / BOARD_HEIGHT;
  }

}