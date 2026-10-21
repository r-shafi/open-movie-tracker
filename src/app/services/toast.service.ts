import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  constructor(private toastController: ToastController) {}

  async showToast(message: string, duration = 2000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'dark',
      buttons: [
        {
          icon: 'close',
          role: 'cancel',
        },
      ],
    });
    toast.present();
  }

  async showActionToast(
    message: string,
    actionText: string,
    onAction: () => void | Promise<void>,
    duration = 4500,
  ): Promise<HTMLIonToastElement> {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'dark',
      buttons: [
        {
          text: actionText,
          role: 'action',
          handler: () => {
            try {
              const res = onAction();
              if (res instanceof Promise) {
                res.catch(() => {});
              }
            } catch {}
          },
        },
        {
          icon: 'close',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
    return toast;
  }
}
