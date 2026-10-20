import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SettingsPageRoutingModule } from './settings-routing.module';
import { SettingsPage } from './settings.page';
import { LetterboxdImportModalComponent } from './letterboxd-import-modal/letterboxd-import-modal.component';

@NgModule({
  declarations: [SettingsPage, LetterboxdImportModalComponent],
  imports: [CommonModule, FormsModule, IonicModule, SettingsPageRoutingModule],
})
export class SettingsPageModule {}
