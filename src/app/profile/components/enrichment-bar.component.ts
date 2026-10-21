import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BackfillProgress, MetadataBackfillService } from '../../services/metadata-backfill.service';

@Component({
  selector: 'app-enrichment-bar',
  templateUrl: './enrichment-bar.component.html',
  styleUrls: ['./enrichment-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EnrichmentBarComponent implements OnInit, OnDestroy {
  progress: BackfillProgress | null = null;
  private sub?: Subscription;
  private startTime = Date.now();
  private startCompleted = 0;

  constructor(public metadataBackfill: MetadataBackfillService) {}

  ngOnInit(): void {
    this.sub = this.metadataBackfill.getProgress().subscribe((p) => {
      if (this.progress?.total !== p.total) {
        this.startTime = Date.now();
        this.startCompleted = p.completed;
      }
      this.progress = p;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get percent(): number {
    if (!this.progress || !this.progress.total) return 0;
    return Math.min(100, Math.round((this.progress.completed / this.progress.total) * 100));
  }

  get ratePerMinute(): number {
    if (!this.progress) return 0;
    const elapsedMinutes = (Date.now() - this.startTime) / (1000 * 60);
    const completedSinceStart = Math.max(0, this.progress.completed - this.startCompleted);
    if (elapsedMinutes < 0.1 || completedSinceStart === 0) return 0;
    return Math.round(completedSinceStart / elapsedMinutes);
  }

  get estimatedTimeRemaining(): string | null {
    if (!this.progress || !this.progress.isRunning || this.ratePerMinute <= 0) return null;
    const remaining = this.progress.total - this.progress.completed;
    if (remaining <= 0) return null;
    const minutesLeft = Math.ceil(remaining / this.ratePerMinute);
    if (minutesLeft < 1) return '< 1 min';
    if (minutesLeft === 1) return '1 min';
    return `${minutesLeft} mins`;
  }

  togglePause(): void {
    if (this.progress?.isPaused) {
      this.metadataBackfill.resume();
    } else {
      this.metadataBackfill.pause();
    }
  }
}
