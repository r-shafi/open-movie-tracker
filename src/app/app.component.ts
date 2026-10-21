import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';
import { UpdateService } from './services/update.service';
import { UserDataService } from './services/user-data.service';

export function applyPrimaryColor(color: 'green' | 'red'): void {
  const root = document.documentElement;
  if (color === 'red') {
    root.style.setProperty('--ion-color-primary', '#d90429');
    root.style.setProperty('--ion-color-primary-rgb', '217,4,41');
    root.style.setProperty('--ion-color-primary-contrast', '#ced4da');
    root.style.setProperty('--ion-color-primary-contrast-rgb', '206,212,218');
    root.style.setProperty('--ion-color-primary-shade', '#bf0324');
    root.style.setProperty('--ion-color-primary-tint', '#dd1e3e');
  } else {
    root.style.setProperty('--ion-color-primary', '#76c893');
    root.style.setProperty('--ion-color-primary-rgb', '118,200,147');
    root.style.setProperty('--ion-color-primary-contrast', '#212529');
    root.style.setProperty('--ion-color-primary-contrast-rgb', '33,37,41');
    root.style.setProperty('--ion-color-primary-shade', '#68b382');
    root.style.setProperty('--ion-color-primary-tint', '#84ce9e');
  }
}

export function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const isLight =
    theme === 'light' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.toggle('light', isLight);
  document.body.classList.toggle('light', isLight);
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private routeSub = Subscription.EMPTY;

  constructor(
    private userData: UserDataService,
    private router: Router,
    private alertCtrl: AlertController,
    private updateService: UpdateService,
  ) {
    const settings = this.userData.getSettings();
    applyPrimaryColor(settings.primaryColor);
    applyTheme(settings.theme);
  }

  ngOnInit(): void {
    this.routeSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        requestAnimationFrame(() => {
          const content = document.querySelector('ion-content') as any;
          if (content?.scrollToTop) {
            content.scrollToTop(0);
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
      });

    this.checkForUpdates();
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  private checkForUpdates(): void {
    if (!this.userData.getSettings().autoCheckUpdates) {
      return;
    }
    this.updateService.checkForUpdate().subscribe({
      next: async (update) => {
        if (!update) {
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
        // Silently ignore update check errors on boot to prevent console noise/crashes
      },
    });
  }
}
