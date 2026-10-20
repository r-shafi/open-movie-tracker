import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { finalize } from 'rxjs';
import packageJson from '../../../package.json';
import { applyPrimaryColor } from '../app.component';
import { ToastService } from '../services/toast.service';
import { UpdateService } from '../services/update.service';
import { AppSettings, UserDataService } from '../services/user-data.service';
import { LetterboxdImportService } from '../services/letterboxd-import.service';
import { LetterboxdExportService } from '../services/letterboxd-export.service';
import { MetadataBackfillService } from '../services/metadata-backfill.service';
import { LetterboxdArchive } from '../services/letterboxd-archive';
import { LetterboxdImportModalComponent } from './letterboxd-import-modal/letterboxd-import-modal.component';

interface LanguageOption {
  code: string;
  label: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'aa', label: 'Afar' },
  { code: 'ab', label: 'Abkhazian' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'ak', label: 'Akan' },
  { code: 'am', label: 'Amharic' },
  { code: 'ar', label: 'Arabic' },
  { code: 'as', label: 'Assamese' },
  { code: 'ay', label: 'Aymara' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'ba', label: 'Bashkir' },
  { code: 'be', label: 'Belarusian' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'bi', label: 'Bislama' },
  { code: 'bm', label: 'Bambara' },
  { code: 'bn', label: 'Bengali' },
  { code: 'bo', label: 'Tibetan' },
  { code: 'br', label: 'Breton' },
  { code: 'bs', label: 'Bosnian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'co', label: 'Corsican' },
  { code: 'cs', label: 'Czech' },
  { code: 'cy', label: 'Welsh' },
  { code: 'da', label: 'Danish' },
  { code: 'de', label: 'German' },
  { code: 'dv', label: 'Divehi' },
  { code: 'dz', label: 'Dzongkha' },
  { code: 'el', label: 'Greek' },
  { code: 'en', label: 'English' },
  { code: 'eo', label: 'Esperanto' },
  { code: 'es', label: 'Spanish' },
  { code: 'et', label: 'Estonian' },
  { code: 'eu', label: 'Basque' },
  { code: 'fa', label: 'Persian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fj', label: 'Fijian' },
  { code: 'fo', label: 'Faroese' },
  { code: 'fr', label: 'French' },
  { code: 'fy', label: 'Western Frisian' },
  { code: 'ga', label: 'Irish' },
  { code: 'gd', label: 'Scottish Gaelic' },
  { code: 'gl', label: 'Galician' },
  { code: 'gn', label: 'Guarani' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ha', label: 'Hausa' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hr', label: 'Croatian' },
  { code: 'ht', label: 'Haitian Creole' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'hy', label: 'Armenian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ig', label: 'Igbo' },
  { code: 'is', label: 'Icelandic' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'jv', label: 'Javanese' },
  { code: 'ka', label: 'Georgian' },
  { code: 'kk', label: 'Kazakh' },
  { code: 'km', label: 'Khmer' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ko', label: 'Korean' },
  { code: 'ks', label: 'Kashmiri' },
  { code: 'ku', label: 'Kurdish' },
  { code: 'ky', label: 'Kyrgyz' },
  { code: 'la', label: 'Latin' },
  { code: 'lb', label: 'Luxembourgish' },
  { code: 'lg', label: 'Ganda' },
  { code: 'ln', label: 'Lingala' },
  { code: 'lo', label: 'Lao' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'lv', label: 'Latvian' },
  { code: 'mg', label: 'Malagasy' },
  { code: 'mi', label: 'Maori' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mn', label: 'Mongolian' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ms', label: 'Malay' },
  { code: 'mt', label: 'Maltese' },
  { code: 'my', label: 'Burmese' },
  { code: 'ne', label: 'Nepali' },
  { code: 'nl', label: 'Dutch' },
  { code: 'no', label: 'Norwegian' },
  { code: 'ny', label: 'Nyanja' },
  { code: 'oc', label: 'Occitan' },
  { code: 'om', label: 'Oromo' },
  { code: 'or', label: 'Odia' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'pl', label: 'Polish' },
  { code: 'ps', label: 'Pashto' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'qu', label: 'Quechua' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'sd', label: 'Sindhi' },
  { code: 'si', label: 'Sinhala' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'sm', label: 'Samoan' },
  { code: 'sn', label: 'Shona' },
  { code: 'so', label: 'Somali' },
  { code: 'sq', label: 'Albanian' },
  { code: 'sr', label: 'Serbian' },
  { code: 'st', label: 'Southern Sotho' },
  { code: 'su', label: 'Sundanese' },
  { code: 'sv', label: 'Swedish' },
  { code: 'sw', label: 'Swahili' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'tg', label: 'Tajik' },
  { code: 'th', label: 'Thai' },
  { code: 'ti', label: 'Tigrinya' },
  { code: 'tk', label: 'Turkmen' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'tn', label: 'Tswana' },
  { code: 'to', label: 'Tonga' },
  { code: 'tr', label: 'Turkish' },
  { code: 'tt', label: 'Tatar' },
  { code: 'ug', label: 'Uyghur' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'uz', label: 'Uzbek' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'wo', label: 'Wolof' },
  { code: 'xh', label: 'Xhosa' },
  { code: 'yi', label: 'Yiddish' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'za', label: 'Zhuang' },
  { code: 'zh', label: 'Chinese' },
  { code: 'zu', label: 'Zulu' },
].sort((a, b) => a.label.localeCompare(b.label));

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SettingsPage {
  readonly appVersion = packageJson?.version ?? '0.0.1';
  readonly githubRepoUrl = 'https://github.com/r-shafi/open-movie-tracker';
  readonly languageOptions = LANGUAGE_OPTIONS;

  languageSearchQuery = '';
  isLanguageComboboxOpen = false;
  isCheckingForUpdate = false;

  constructor(
    public userData: UserDataService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private toast: ToastService,
    private updateService: UpdateService,
    private letterboxdImport: LetterboxdImportService,
    private letterboxdExport: LetterboxdExportService,
    private metadataBackfill: MetadataBackfillService,
    private cdr: ChangeDetectorRef,
  ) {}

  get settings(): AppSettings {
    return this.userData.getSettings();
  }

  get safeSearch(): boolean {
    return !this.settings.includeAdult;
  }

  get filteredLanguageOptions(): LanguageOption[] {
    const q = this.languageSearchQuery.trim().toLowerCase();
    const blocked = new Set(
      this.settings.excludeLanguages.map((c) => c.toLowerCase()),
    );
    const available = this.languageOptions.filter(
      (lang) => !blocked.has(lang.code),
    );
    if (!q) {
      return available.slice(0, 16);
    }
    return available.filter(
      (lang) =>
        lang.label.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q),
    );
  }

  get blockedLanguageItems(): Array<{ code: string; label: string }> {
    return this.settings.excludeLanguages
      .map((code) => {
        const normalized = code.toLowerCase();
        const known = this.languageOptions.find(
          (lang) => lang.code === normalized,
        );
        return {
          code: normalized,
          label: known ? known.label : normalized.toUpperCase(),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  setFadeWatched(value: boolean) {
    this.userData.saveSetting('fadeWatched', value);
  }

  setDefaultMediaTab(value: 'movies' | 'tv') {
    this.userData.saveSetting('defaultMediaTab', value);
  }

  setSafeSearch(value: boolean) {
    this.userData.saveSetting('includeAdult', !value);
  }

  setPrimaryColor(color: 'green' | 'red') {
    this.userData.saveSetting('primaryColor', color);
    applyPrimaryColor(color);
  }

  async editTmdbApiKey() {
    const currentKey = this.settings.tmdbApiKey || '';
    const alert = await this.alertCtrl.create({
      header: 'TMDb API Key',
      message:
        'Enter your personal TMDb API key (v3 auth), or leave empty to use the bundled default key.',
      inputs: [
        {
          name: 'apiKey',
          type: 'text',
          placeholder: 'Personal API key (optional)',
          value: currentKey,
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset to Default',
          handler: () => {
            this.userData.saveSetting('tmdbApiKey', '');
            this.toast.showToast('Reset to default TMDb API key.');
            this.cdr.markForCheck();
          },
        },
        {
          text: 'Save',
          handler: (data) => {
            const key = (data.apiKey || '').trim();
            this.userData.saveSetting('tmdbApiKey', key);
            this.toast.showToast(
              key ? 'Custom API key saved.' : 'Using default API key.',
            );
            this.cdr.markForCheck();
          },
        },
      ],
    });
    await alert.present();
  }

  isLanguageBlocked(code: string): boolean {
    return this.settings.excludeLanguages.includes(code.toLowerCase());
  }

  toggleLanguageBlock(code: string, enabled: boolean) {
    const normalized = code.toLowerCase();
    const current = this.settings.excludeLanguages.map((c) => c.toLowerCase());
    const next = enabled
      ? Array.from(new Set([...current, normalized]))
      : current.filter((c) => c !== normalized);
    this.userData.saveSetting('excludeLanguages', next);
  }

  removeLanguageBlock(code: string) {
    this.toggleLanguageBlock(code, false);
  }

  openLanguageCombobox() {
    this.isLanguageComboboxOpen = true;
  }

  onLanguageComboboxBlur() {
    setTimeout(() => {
      this.isLanguageComboboxOpen = false;
    }, 120);
  }

  selectLanguageToBlock(lang: LanguageOption) {
    this.toggleLanguageBlock(lang.code, true);
    this.languageSearchQuery = '';
    this.isLanguageComboboxOpen = false;
  }

  checkForUpdates() {
    if (this.isCheckingForUpdate) {
      return;
    }
    this.isCheckingForUpdate = true;
    this.cdr.markForCheck();
    this.updateService
      .checkForUpdate()
      .pipe(
        finalize(() => {
          this.isCheckingForUpdate = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: async (update) => {
          if (!update) {
            this.toast.showToast('You are on the latest version.');
            return;
          }
          const alert = await this.alertCtrl.create({
            header: 'Update available',
            message: `Version ${update.latestVersion} is available. You're on ${update.currentVersion}.`,
            buttons: [
              { text: 'Later', role: 'cancel' },
              {
                text: 'Update now',
                handler: () => {
                  window.open(update.releaseUrl, '_blank');
                },
              },
            ],
          });
          await alert.present();
        },
        error: () => {
          this.toast.showToast('Unable to check for updates right now.');
        },
      });
  }

  exportData() {
    const backupJson = this.userData.exportBackup();
    const blob = new Blob([backupJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `open-movie-tracker-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.showToast('Data exported successfully.');
  }

  async importData() {
    const alert = await this.alertCtrl.create({
      header: 'Import Backup',
      message: 'Choose how to import your backup data:',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Merge with existing',
          handler: () => this.triggerFileInput('merge'),
        },
        {
          text: 'Replace all data',
          role: 'destructive',
          handler: () => this.triggerFileInput('replace'),
        },
      ],
    });
    await alert.present();
  }

  private triggerFileInput(mode: 'merge' | 'replace') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event: any) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const result = this.userData.importBackup(e.target.result, mode);
        if (result.success) {
          const counts = result.importedCounts;
          const msg = counts
            ? `Imported ${counts.watched} logs, ${counts.watchlist} watchlist items.`
            : 'Data imported successfully.';
          this.toast.showToast(msg);
          this.cdr.markForCheck();
        } else {
          this.toast.showToast(result.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  get hasLetterboxdBackup(): boolean {
    return this.letterboxdImport.hasBackup();
  }

  get missingMetadataCount(): number {
    return this.userData.getMissingSnapshotTitles().length;
  }

  get backfillProgress$() {
    return this.metadataBackfill.getProgress();
  }

  startMetadataBackfill(): void {
    this.metadataBackfill.start();
  }

  importLetterboxd(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.csv';
    input.multiple = true;
    input.onchange = async (event: any) => {
      const files: FileList | null = event.target.files;
      if (!files || !files.length) return;

      try {
        let extractedFiles: Record<string, string> = {};
        if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
          const buffer = await files[0].arrayBuffer();
          const unzipped = LetterboxdArchive.unzip(new Uint8Array(buffer));
          extractedFiles = unzipped.files;
        } else {
          extractedFiles = await LetterboxdArchive.readFiles(files);
        }

        if (!Object.keys(extractedFiles).length) {
          this.toast.showToast('No valid Letterboxd CSV files found.');
          return;
        }

        const modal = await this.modalCtrl.create({
          component: LetterboxdImportModalComponent,
          componentProps: {
            files: extractedFiles,
          },
        });

        await modal.present();
        const { data } = await modal.onWillDismiss();
        if (data?.success) {
          this.cdr.markForCheck();
        }
      } catch (err: any) {
        this.toast.showToast(`Error reading export: ${err?.message || 'Invalid format'}`);
      }
    };
    input.click();
  }

  async undoLetterboxdImport(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Undo Letterboxd Import',
      message: 'This will revert your watched entries, watchlist, and lists back to the exact backup state captured right before your last Letterboxd import. Are you sure?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Undo Import',
          role: 'destructive',
          handler: () => {
            const success = this.letterboxdImport.undoImport();
            if (success) {
              this.toast.showToast('Letterboxd import successfully reverted.');
              this.cdr.markForCheck();
            } else {
              this.toast.showToast('Unable to revert import: no backup found.');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  exportLetterboxdZip(): void {
    const zip = this.letterboxdExport.exportZip();
    const dateStr = new Date().toISOString().split('T')[0];
    this.letterboxdExport.downloadBlob(zip, `letterboxd-export-${dateStr}.zip`, 'application/zip');
    this.toast.showToast('Letterboxd export archive downloaded.');
  }

  exportLetterboxdDiaryCsv(): void {
    const csv = this.letterboxdExport.exportDiaryCsv();
    const dateStr = new Date().toISOString().split('T')[0];
    this.letterboxdExport.downloadBlob(csv, `diary-${dateStr}.csv`, 'text/csv;charset=utf-8;');
    this.toast.showToast('Letterboxd diary.csv downloaded.');
  }

  async clearWatchLog() {
    const alert = await this.alertCtrl.create({
      header: 'Clear watch log?',
      message: 'This will remove all watched entries. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          role: 'destructive',
          handler: () => {
            localStorage.removeItem('mva_watched');
            this.toast.showToast('Watch log cleared.');
          },
        },
      ],
    });
    await alert.present();
  }

  async clearAllData() {
    const alert = await this.alertCtrl.create({
      header: 'Clear all data?',
      message:
        'This will remove all your profile, watched, watchlist, favorites, lists, and settings. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear everything',
          role: 'destructive',
          handler: async () => {
            const confirm = await this.alertCtrl.create({
              header: 'Are you sure?',
              message: 'All local data will be permanently deleted.',
              buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                  text: 'Delete all',
                  role: 'destructive',
                  handler: () => {
                    [
                      'mva_profile',
                      'mva_watched',
                      'mva_watchlist',
                      'mva_favorites',
                      'mva_lists',
                      'mva_settings',
                    ].forEach((k) => localStorage.removeItem(k));
                    this.toast.showToast('All data cleared. Reload to reset.');
                  },
                },
              ],
            });
            await confirm.present();
          },
        },
      ],
    });
    await alert.present();
  }
}
