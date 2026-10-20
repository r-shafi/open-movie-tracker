import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
    name: 'safeUrl',
    standalone: false
})
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    if (!url || typeof url !== 'string') {
      return '';
    }
    // Only trust valid YouTube embed URLs
    const ytMatch = /^https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\?.*)?$/.test(url);
    if (ytMatch) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return '';
  }
}
