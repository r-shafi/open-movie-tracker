import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PersonItem, PeopleModalComponent } from './people-modal.component';
import { TmdbService } from '../../services/tmdb.service';
import { UserDataService } from '../../services/user-data.service';

@Component({
  selector: 'app-people-carousel',
  templateUrl: './people-carousel.component.html',
  styleUrls: ['./people-carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PeopleCarouselComponent implements OnInit, OnChanges {
  @Input() title = 'People';
  @Input() people: PersonItem[] = [];
  @Input() userAverageRating: number | null = null;
  @Input() coveragePercent = 100;
  @Input() coveredCount = 0;
  @Input() totalWatched = 0;
  @Input() role: 'director' | 'actor' = 'director';

  imageFailedMap = new Set<string | number>();

  constructor(
    private modalCtrl: ModalController,
    private tmdb: TmdbService,
    private userData: UserDataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.resolveMissingPhotos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.people) {
      this.resolveMissingPhotos();
    }
  }

  private resolveMissingPhotos(): void {
    if (!this.people || !this.people.length) return;
    this.people.slice(0, 10).forEach((person) => {
      if (!person.profilePath && person.id) {
        const cached = this.userData.getPersonPhoto(person.id);
        if (cached) {
          person.profilePath = cached;
          this.cdr.markForCheck();
          return;
        }

        this.tmdb
          .getPersonDetails(person.id)
          .pipe(catchError(() => of(null)))
          .subscribe((res: any) => {
            if (res && res.profile_path) {
              person.profilePath = res.profile_path;
              this.userData.savePersonPhoto(person.id!, res.profile_path);
              this.cdr.markForCheck();
            }
          });
      }
    });
  }

  onImageError(person: PersonItem): void {
    const key = person.id || person.name;
    this.imageFailedMap.add(key);
  }

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
