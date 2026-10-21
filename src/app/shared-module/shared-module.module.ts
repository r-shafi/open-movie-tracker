import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { HeroBannerComponent } from './hero-banner/hero-banner.component';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { ListCardComponent } from './list-card/list-card.component';
import { LogSheetComponent } from './log-sheet/log-sheet.component';
import { MediaCarouselComponent } from './media-carousel/media-carousel.component';
import { MovieCardComponent } from './movie-card/movie-card.component';
import { OfflineBannerComponent } from './offline-banner/offline-banner.component';
import { SafeUrlPipe } from './pipes/safe-url.pipe';
import { PosterCardComponent } from './poster-card/poster-card.component';
import { SkeletonCardComponent } from './skeleton-card/skeleton-card.component';
import { StarRatingComponent } from './star-rating/star-rating.component';

const COMPONENTS = [
  MovieCardComponent,
  HeroBannerComponent,
  PosterCardComponent,
  ListCardComponent,
  LogSheetComponent,
  StarRatingComponent,
  MediaCarouselComponent,
  SkeletonCardComponent,
  OfflineBannerComponent,
  SafeUrlPipe,
];

@NgModule({
  declarations: [...COMPONENTS, ImageViewerComponent],
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  exports: [...COMPONENTS, RouterModule],
})
export class SharedModuleModule {}

export { LogSheetService } from './log-sheet/log-sheet.service';
