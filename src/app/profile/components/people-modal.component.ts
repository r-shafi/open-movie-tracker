import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

export interface PersonItem {
  id?: number;
  name: string;
  count: number;
  avgRating: number | null;
  profilePath?: string | null;
}

@Component({
  selector: 'app-people-modal',
  templateUrl: './people-modal.component.html',
  styleUrls: ['./people-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeopleModalComponent {
  @Input() title = 'People';
  @Input() people: PersonItem[] = [];
  @Input() userAverageRating: number | null = null;
  @Input() role: 'director' | 'actor' = 'director';

  constructor(private modalCtrl: ModalController) {}

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  getPhotoUrl(profilePath?: string | null): string | null {
    return profilePath ? `https://image.tmdb.org/t/p/w185${profilePath}` : null;
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getRatingClass(avgRating: number | null): string {
    if (avgRating === null || this.userAverageRating === null) return '';
    if (avgRating >= this.userAverageRating + 0.3) return 'rating-chip--high';
    if (avgRating <= this.userAverageRating - 0.3) return 'rating-chip--low';
    return 'rating-chip--mid';
  }
}
