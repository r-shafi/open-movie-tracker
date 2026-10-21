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
import { RatingsHistogramComponent } from './components/ratings-histogram.component';
import { WatchVelocityComponent } from './components/watch-velocity.component';
import { DivergingCrowdComponent } from './components/diverging-crowd.component';
import { ActivityCalendarComponent } from './components/activity-calendar.component';
import { PeopleCarouselComponent } from './components/people-carousel.component';
import { PeopleModalComponent } from './components/people-modal.component';
import { TasteInsightsComponent } from './components/taste-insights.component';
import { EnrichmentBarComponent } from './components/enrichment-bar.component';
import { WorldMapComponent } from './components/world-map.component';

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
    RatingsHistogramComponent,
    WatchVelocityComponent,
    DivergingCrowdComponent,
    ActivityCalendarComponent,
    PeopleCarouselComponent,
    PeopleModalComponent,
    TasteInsightsComponent,
    EnrichmentBarComponent,
    WorldMapComponent,
  ],
})
export class ProfilePageModule {}
