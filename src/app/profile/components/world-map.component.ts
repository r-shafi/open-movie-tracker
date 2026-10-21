import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

export interface CountryStat {
  country: string; // ISO 3166-1 alpha-2 code e.g. "US"
  count: number;
}

export interface ActiveCountryInfo {
  code: string;
  name: string;
  count: number;
  percent: string;
}

@Component({
  selector: 'app-world-map',
  templateUrl: './world-map.component.html',
  styleUrls: ['./world-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WorldMapComponent implements AfterViewInit, OnChanges {
  @Input() countries: CountryStat[] = [];
  @Input() totalWatched = 0;
  @Input() coveragePercent = 100;

  @ViewChild('svgWrapper', { static: false }) svgWrapper?: ElementRef<HTMLDivElement>;

  activeCountry: ActiveCountryInfo | null = null;
  private regionNames: Intl.DisplayNames | null = null;

  constructor(private cdr: ChangeDetectorRef) {
    try {
      this.regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      this.regionNames = null;
    }
  }

  ngAfterViewInit(): void {
    this.updateMapColors();
    this.setDefaultActiveCountry();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.countries || changes.totalWatched) {
      this.updateMapColors();
      this.setDefaultActiveCountry();
    }
  }

  getCountryDisplayName(code: string): string {
    const upper = code.toUpperCase();
    if (upper === 'US') return 'United States';
    if (upper === 'GB') return 'United Kingdom';
    if (upper === 'KR') return 'South Korea';
    if (upper === 'CN') return 'China';
    if (upper === 'JP') return 'Japan';
    if (upper === 'FR') return 'France';
    if (upper === 'DE') return 'Germany';
    if (upper === 'IT') return 'Italy';
    if (upper === 'ES') return 'Spain';
    if (upper === 'CA') return 'Canada';
    if (upper === 'AU') return 'Australia';
    try {
      return this.regionNames?.of(upper) || upper;
    } catch {
      return upper;
    }
  }

  get topCountries(): Array<{ code: string; name: string; count: number; percent: string }> {
    const list = this.countries || [];
    return list.slice(0, 6).map((c) => ({
      code: c.country,
      name: this.getCountryDisplayName(c.country),
      count: c.count,
      percent: this.totalWatched > 0 ? ((c.count / this.totalWatched) * 100).toFixed(1) : '0',
    }));
  }

  get coveredCountriesCount(): number {
    return (this.countries || []).filter((c) => c.count > 0).length;
  }

  selectCountry(code: string): void {
    const stat = (this.countries || []).find((c) => c.country.toUpperCase() === code.toUpperCase());
    const count = stat ? stat.count : 0;
    this.activeCountry = {
      code: code.toUpperCase(),
      name: this.getCountryDisplayName(code),
      count,
      percent: this.totalWatched > 0 ? ((count / this.totalWatched) * 100).toFixed(1) : '0',
    };
    this.highlightCountry(code);
    this.cdr.markForCheck();
  }

  onMapClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target) return;

    let el: Element | null = target;
    let code: string | null = null;
    while (el && el !== this.svgWrapper?.nativeElement) {
      const id = el.getAttribute('id');
      if (id && id.length === 2 && !id.startsWith('_') && id !== 'world-map') {
        code = id.toUpperCase();
        break;
      }
      el = el.parentElement;
    }

    if (code) {
      this.selectCountry(code);
    }
  }

  private setDefaultActiveCountry(): void {
    if (this.countries && this.countries.length > 0) {
      const top = this.countries[0];
      this.activeCountry = {
        code: top.country,
        name: this.getCountryDisplayName(top.country),
        count: top.count,
        percent: this.totalWatched > 0 ? ((top.count / this.totalWatched) * 100).toFixed(1) : '0',
      };
      this.highlightCountry(top.country);
      this.cdr.markForCheck();
    }
  }

  private highlightCountry(code: string): void {
    if (!this.svgWrapper?.nativeElement) return;
    const svgEl = this.svgWrapper.nativeElement.querySelector('svg');
    if (!svgEl) return;

    // Remove previous active highlight
    svgEl.querySelectorAll('.active-country-path').forEach((p) => {
      p.classList.remove('active-country-path');
    });

    const activeEl = svgEl.querySelector('#' + code.toLowerCase());
    if (activeEl) {
      activeEl.classList.add('active-country-path');
      activeEl.querySelectorAll('path').forEach((p) => p.classList.add('active-country-path'));
    }
  }

  private updateMapColors(): void {
    if (!this.svgWrapper?.nativeElement) return;
    const svgEl = this.svgWrapper.nativeElement.querySelector('svg');
    if (!svgEl) return;

    const countMap = new Map<string, number>();
    (this.countries || []).forEach((c) => {
      countMap.set(c.country.toLowerCase(), c.count);
    });

    const maxCount = Math.max(...(this.countries || []).map((c) => c.count), 1);

    const countryElements = svgEl.querySelectorAll('path[id], g[id]');
    countryElements.forEach((node) => {
      const id = node.getAttribute('id');
      if (!id || id.length !== 2 || id.startsWith('_')) return;

      const count = countMap.get(id.toLowerCase()) || 0;
      let fill = '#262a2e';

      if (count > 0) {
        if (count >= 10 || count >= maxCount * 0.5) {
          fill = '#10b981';
        } else if (count >= 3) {
          fill = 'rgba(16, 185, 129, 0.7)';
        } else {
          fill = 'rgba(16, 185, 129, 0.4)';
        }
      }

      if (node.tagName.toLowerCase() === 'path') {
        node.setAttribute('fill', fill);
      } else {
        node.querySelectorAll('path').forEach((p) => p.setAttribute('fill', fill));
      }
    });
  }
}
