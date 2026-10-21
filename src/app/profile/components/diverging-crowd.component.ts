import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CrowdDeltaItem } from '../../services/user-data.service';

@Component({
  selector: 'app-diverging-crowd',
  templateUrl: './diverging-crowd.component.html',
  styleUrls: ['./diverging-crowd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class DivergingCrowdComponent {
  @Input() highestAboveCrowd: CrowdDeltaItem[] = [];
  @Input() highestBelowCrowd: CrowdDeltaItem[] = [];
  @Input() crowdDeltaAverage: number | null = null;
  @Input() contrarianScore: number | null = null;
  @Input() generosityScore: number | null = null;

  activeDirection: 'all' | 'above' | 'below' = 'all';

  get hasData(): boolean {
    return (this.highestAboveCrowd?.length || 0) > 0 || (this.highestBelowCrowd?.length || 0) > 0;
  }
}
