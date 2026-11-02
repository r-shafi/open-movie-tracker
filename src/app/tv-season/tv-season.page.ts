import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TmdbService } from '../services/tmdb.service';
import { UserDataService } from '../services/user-data.service';

@Component({
  selector: 'app-tv-season',
  templateUrl: './tv-season.page.html',
  styleUrls: ['./tv-season.page.scss'],
  standalone: false,
})
export class TvSeasonPage implements OnInit {
  tvId = 0;
  season: any;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private tmdb: TmdbService,
    private userData: UserDataService,
  ) {}

  ngOnInit() {
    this.tvId = +this.route.snapshot.paramMap.get('id')!;
    const seasonNumber = +this.route.snapshot.paramMap.get('seasonNumber')!;
    this.tmdb.getTvSeason(this.tvId, seasonNumber).subscribe({
      next: (data: any) => {
        this.season = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  isEpisodeWatched(seasonNum: number, epNum: number): boolean {
    return this.userData.isEpisodeWatched(this.tvId, seasonNum, epNum);
  }

  toggleEpisode(ep: any) {
    this.userData.toggleEpisodeWatched(
      this.tvId,
      this.season.season_number,
      ep.episode_number,
    );
  }

  get watchedCount(): number {
    if (!this.season?.episodes) {
      return 0;
    }
    return this.season.episodes.filter((ep: any) =>
      this.isEpisodeWatched(this.season.season_number, ep.episode_number),
    ).length;
  }

  get isAllWatched(): boolean {
    if (!this.season?.episodes?.length) {
      return false;
    }
    return this.watchedCount === this.season.episodes.length;
  }

  toggleAllWatched() {
    if (!this.season?.episodes?.length) {
      return;
    }
    const epNums = this.season.episodes.map((ep: any) => ep.episode_number);
    if (this.isAllWatched) {
      this.userData.unmarkSeasonWatched(
        this.tvId,
        this.season.season_number,
        epNums,
      );
    } else {
      this.userData.markSeasonWatched(
        this.tvId,
        this.season.season_number,
        epNums,
      );
    }
  }
}
