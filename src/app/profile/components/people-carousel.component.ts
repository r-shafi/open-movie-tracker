import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PersonItem, PeopleModalComponent } from './people-modal.component';

@Component({
  selector: 'app-people-carousel',
  templateUrl: './people-carousel.component.html',
  styleUrls: ['./people-carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeopleCarouselComponent {
  @Input() title = 'People';
  @Input() people: PersonItem[] = [];
  @Input() userAverageRating: number | null = null;
  @Input() coveragePercent = 100;
  @Input() coveredCount = 0;
  @Input() totalWatched = 0;
  @Input() role: 'director' | 'actor' = 'director';

  constructor(private modalCtrl: ModalController) {}

  get isProvisional(): boolean {
    return this.coveragePercent < 100;
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

  async openSeeAll(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PeopleModalComponent,
      componentProps: {
        title: this.title,
        people: this.people,
        userAverageRating: this.userAverageRating,
        role: this.role,
      },
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
    });
    await modal.present();
  }
}
