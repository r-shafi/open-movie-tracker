import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';
import { SharedModuleModule } from '../shared-module/shared-module.module';

import { ProfilePage } from './profile.page';
import { EditProfileComponent } from './edit-profile/edit-profile.component';
import { AddFavoriteModalComponent } from './add-favorite-modal/add-favorite-modal.component';
import { SetCoverModalComponent } from './set-cover-modal/set-cover-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    SharedModuleModule,
  ],
  declarations: [
    ProfilePage,
    EditProfileComponent,
    AddFavoriteModalComponent,
    SetCoverModalComponent,
  ],
})
export class ProfilePageModule {}
