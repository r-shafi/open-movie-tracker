import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { QuickLogModalComponent } from './quick-log-modal.component';

@Injectable({ providedIn: 'root' })
export class QuickLogService {
  private activeModal?: HTMLIonModalElement;

  constructor(private modalCtrl: ModalController) {}

  async open(): Promise<void> {
    if (this.activeModal) {
      await this.activeModal.dismiss();
      this.activeModal = undefined;
    }

    this.activeModal = await this.modalCtrl.create({
      component: QuickLogModalComponent,
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
      handle: true,
      backdropBreakpoint: 0.2,
      cssClass: 'quick-log-modal-sheet',
    });

    this.activeModal.onDidDismiss().then(() => {
      this.activeModal = undefined;
    });

    await this.activeModal.present();
  }
}
