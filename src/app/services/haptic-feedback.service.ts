import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { UserDataService } from './user-data.service';

@Injectable({ providedIn: 'root' })
export class HapticFeedbackService {
  constructor(private userData: UserDataService) {}

  async lightImpact(): Promise<void> {
    const settings = this.userData.getSettings();
    if (settings.hapticsEnabled === false) {
      return;
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {}
      }
    }
  }

  async mediumImpact(): Promise<void> {
    const settings = this.userData.getSettings();
    if (settings.hapticsEnabled === false) {
      return;
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(18);
        } catch {}
      }
    }
  }
}
