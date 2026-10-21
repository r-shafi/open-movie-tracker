import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-list-card',
  templateUrl: './list-card.component.html',
  styleUrls: ['./list-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ListCardComponent {
  @Input() title = '';
  @Input() count = 0;
  @Input() subtitle?: string;
  @Input() posters: string[] = [];
  @Input() showBookmark = false;
  @Input() isBookmarked = false;
  @Input() routerLink?: any[] | string;

  @Output() bookmarkClick = new EventEmitter<Event>();
  @Output() cardClick = new EventEmitter<void>();

  get displayPosters(): string[] {
    return (this.posters || []).slice(0, 4);
  }

  get placeholderSlots(): number[] {
    const remaining = 4 - this.displayPosters.length;
    return remaining > 0 ? Array(remaining).fill(0) : [];
  }

  onBookmark(event: Event): void {
    event.stopPropagation();
    this.bookmarkClick.emit(event);
  }

  onClick(): void {
    this.cardClick.emit();
  }
}
