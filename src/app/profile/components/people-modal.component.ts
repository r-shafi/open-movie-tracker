import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TmdbService } from '../../services/tmdb.service';
import { UserDataService } from '../../services/user-data.service';

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
export class PeopleModalComponent implements OnInit {
  @Input() title = 'People';
  @Input() people: PersonItem[] = [];
  @Input() userAverageRating: number | null = null;
  @Input() role: 'director' | 'actor' = 'director';

  imageFailedMap = new Set<string | number>();

  constructor(
    private modalCtrl: ModalController,
    private tmdb: TmdbService,
    private userData: UserDataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.people || !this.people.length) return;
    this.people.slice(0, 30).forEach((person) => {
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
