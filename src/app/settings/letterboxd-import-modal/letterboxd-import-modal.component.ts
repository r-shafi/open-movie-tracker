import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  ImportOptions,
  ImportPlan,
  ImportProgress,
  LetterboxdImportService,
} from '../../services/letterboxd-import.service';
import { LetterboxdExportService } from '../../services/letterboxd-export.service';
import { MatchResult, TmdbMatchCandidate } from '../../services/tmdb-matcher';
import { ToastService } from '../../services/toast.service';

export type ImportStep = 'configure' | 'matching' | 'resolve' | 'summary' | 'committing' | 'done';

@Component({
  selector: 'app-letterboxd-import-modal',
  templateUrl: './letterboxd-import-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LetterboxdImportModalComponent implements OnInit, OnDestroy {
  @Input() files!: Record<string, string>;

  step: ImportStep = 'configure';

  // Session resumption
  canResume = false;
  savedSession: { step: string; plan: ImportPlan; timestamp: string } | null = null;
  private backButtonSub?: Subscription;

  // Options
  options: ImportOptions = {
    importProfile: false,
    importWatchlist: true,
    importCustomLists: true,
    importFavorites: true,
    skipDuplicates: false,
  };

  // Detected files summary
  detected = {
    diary: false,
    reviews: false,
    ratings: false,
    watched: false,
    watchlist: false,
    likes: false,
    listsCount: 0,
    profile: false,
  };

  // Progress
  progressCurrent = 0;
  progressTotal = 0;
  progressMessage = 'Preparing import...';
  progressPercent = 0;

  // Staged Plan
  plan: ImportPlan | null = null;
  ambiguousIndex = 0;
  currentAmbiguous: MatchResult | null = null;
  ambiguousResolutions = new Map<string, TmdbMatchCandidate | null>();

  // Result
  commitStats: { importedCount: number; watchlistCount: number; listsCount: number } | null = null;

  constructor(
    private modalCtrl: ModalController,
    private importService: LetterboxdImportService,
    private exportService: LetterboxdExportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private platform: Platform,
  ) {}

  ngOnInit(): void {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(100, () => {
      this.dismiss();
    });

    // Check for saved session from previous run
    const session = this.importService.loadSession();
    if (session && session.plan) {
      this.savedSession = session;
      this.canResume = true;
    }

    if (!this.files) {
      return;
    }
    const keys = Object.keys(this.files);
    this.detected = {
      diary: keys.includes('diary.csv'),
      reviews: keys.includes('reviews.csv'),
      ratings: keys.includes('ratings.csv'),
      watched: keys.includes('watched.csv'),
      watchlist: keys.includes('watchlist.csv'),
      likes: keys.includes('likes/films.csv'),
      listsCount: keys.filter((k) => k.startsWith('lists/') && k.endsWith('.csv')).length,
      profile: keys.includes('profile.csv'),
    };
  }

  ngOnDestroy(): void {
    this.backButtonSub?.unsubscribe();
  }

  resumeSession(): void {
    if (!this.savedSession) return;
    this.plan = this.savedSession.plan;
    if (this.savedSession.step === 'resolve' && this.plan.ambiguousMatches.length > 0) {
      this.step = 'resolve';
      this.ambiguousIndex = 0;
      this.currentAmbiguous = this.plan.ambiguousMatches[0];
    } else {
      this.step = 'summary';
    }
    this.canResume = false;
    this.toast.showToast('Resumed previous import session.');
    this.cdr.markForCheck();
  }

  discardSession(): void {
    this.importService.clearSession();
    this.savedSession = null;
    this.canResume = false;
    this.cdr.markForCheck();
  }

  dismiss(data?: any): void {
    this.modalCtrl.dismiss(data);
  }

  async startMatching(): Promise<void> {
    this.step = 'matching';
    this.cdr.markForCheck();

    try {
      this.plan = await this.importService.prepareImport(
        this.files,
        this.options,
        (p: ImportProgress) => {
          this.progressCurrent = p.current;
          this.progressTotal = p.total;
          this.progressMessage = p.message;
          this.progressPercent = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
          this.cdr.markForCheck();
        },
      );

      if (this.plan.ambiguousMatches.length > 0) {
        this.step = 'resolve';
        this.ambiguousIndex = 0;
        this.currentAmbiguous = this.plan.ambiguousMatches[0];
      } else {
        this.step = 'summary';
      }
      this.importService.saveSession(this.step, this.plan);
      this.cdr.markForCheck();
    } catch (err: any) {
      this.toast.showToast(`Import preparation failed: ${err?.message || 'Unknown error'}`);
      this.step = 'configure';
      this.cdr.markForCheck();
    }
  }

  selectAmbiguousCandidate(candidate: TmdbMatchCandidate): void {
    if (!this.currentAmbiguous) return;
    const key = `${this.currentAmbiguous.sourceTitle.toLowerCase()}|${this.currentAmbiguous.sourceYear || ''}`;
    this.ambiguousResolutions.set(key, candidate);
    this.nextAmbiguous();
  }

  skipAmbiguousCurrent(): void {
    if (!this.currentAmbiguous) return;
    const key = `${this.currentAmbiguous.sourceTitle.toLowerCase()}|${this.currentAmbiguous.sourceYear || ''}`;
    this.ambiguousResolutions.set(key, null);
    this.nextAmbiguous();
  }

  acceptAllAmbiguousTop(): void {
    if (!this.plan) return;
    for (let i = this.ambiguousIndex; i < this.plan.ambiguousMatches.length; i++) {
      const match = this.plan.ambiguousMatches[i];
      const key = `${match.sourceTitle.toLowerCase()}|${match.sourceYear || ''}`;
      if (match.candidates.length > 0) {
        this.ambiguousResolutions.set(key, match.candidates[0]);
      }
    }
    this.currentAmbiguous = null;
    this.step = 'summary';
    this.importService.saveSession(this.step, this.plan);
    this.toast.showToast('Accepted all top matching candidates.');
    this.cdr.markForCheck();
  }

  skipAllAmbiguous(): void {
    if (!this.plan) return;
    for (let i = this.ambiguousIndex; i < this.plan.ambiguousMatches.length; i++) {
      const match = this.plan.ambiguousMatches[i];
      const key = `${match.sourceTitle.toLowerCase()}|${match.sourceYear || ''}`;
      this.ambiguousResolutions.set(key, null);
    }
    this.currentAmbiguous = null;
    this.step = 'summary';
    this.importService.saveSession(this.step, this.plan);
    this.toast.showToast('Skipped all ambiguous titles.');
    this.cdr.markForCheck();
  }

  private nextAmbiguous(): void {
    if (!this.plan) return;
    this.ambiguousIndex++;
    if (this.ambiguousIndex < this.plan.ambiguousMatches.length) {
      this.currentAmbiguous = this.plan.ambiguousMatches[this.ambiguousIndex];
    } else {
      this.currentAmbiguous = null;
      this.step = 'summary';
    }
    this.cdr.markForCheck();
  }

  async commit(): Promise<void> {
    if (!this.plan) return;
    this.step = 'committing';
    this.cdr.markForCheck();

    try {
      this.commitStats = await this.importService.commitImport(
        this.plan,
        this.ambiguousResolutions,
        (p: ImportProgress) => {
          this.progressMessage = p.message;
          this.cdr.markForCheck();
        },
      );
      this.step = 'done';
      this.toast.showToast('Letterboxd import committed successfully!');
      this.cdr.markForCheck();
    } catch (err: any) {
      this.toast.showToast(`Import failed: ${err?.message || 'Storage error'}`);
      this.step = 'summary';
      this.cdr.markForCheck();
    }
  }

  downloadUnmatchedReport(): void {
    if (!this.plan || !this.plan.unmatchedItems.length) return;
    const csv = this.importService.generateUnmatchedReport(this.plan.unmatchedItems);
    this.exportService.downloadBlob(csv, 'unmatched-letterboxd-titles.csv', 'text/csv;charset=utf-8;');
  }
}
