import { Component } from '@angular/core';
import { QuickLogService } from '../shared-module/quick-log-modal/quick-log.service';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(private quickLog: QuickLogService) {}

  async openQuickLog(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    await this.quickLog.open();
  }
}
