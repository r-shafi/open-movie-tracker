import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { IonicModule, ModalController } from '@ionic/angular';
import { PeopleCarouselComponent } from './people-carousel.component';
import { PeopleModalComponent } from './people-modal.component';

describe('PeopleCarouselComponent & Routing', () => {
  let component: PeopleCarouselComponent;
  let fixture: ComponentFixture<PeopleCarouselComponent>;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;

  const mockPeople = [
    {
      id: 1032,
      name: 'Martin Scorsese',
      count: 14,
      avgRating: 4.4,
      profilePath: '/scorsese.jpg',
    },
    {
      id: 7467,
      name: 'David Fincher',
      count: 11,
      avgRating: 4.2,
      profilePath: null, // Test fallback initials
    },
  ];

  beforeEach(async () => {
    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);

    await TestBed.configureTestingModule({
      declarations: [PeopleCarouselComponent, PeopleModalComponent],
      imports: [IonicModule.forRoot(), RouterTestingModule],
      providers: [{ provide: ModalController, useValue: modalCtrlSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(PeopleCarouselComponent);
    component = fixture.componentInstance;
    component.title = 'Top Directors';
    component.people = mockPeople;
    component.userAverageRating = 3.5;
    component.coveragePercent = 45;
    component.coveredCount = 450;
    component.totalWatched = 1000;
    fixture.detectChanges();
  });

  it('should render correct number of person slides', () => {
    const slides = fixture.debugElement.queryAll(By.css('.person-slide'));
    expect(slides.length).toBe(2);
  });

  it('should link each person slide to [/person, id] using exact numeric TMDb person id', () => {
    const slides = fixture.debugElement.queryAll(By.directive(RouterLink));
    expect(slides.length).toBe(2);

    expect(slides[0].nativeElement.getAttribute('href')).toBe('/person/1032');
    expect(slides[1].nativeElement.getAttribute('href')).toBe('/person/7467');
  });

  it('should display rank badges (#1, #2) and name', () => {
    const rankBadges = fixture.debugElement.queryAll(By.css('.rank-badge'));
    expect(rankBadges[0].nativeElement.textContent.trim()).toBe('#1');
    expect(rankBadges[1].nativeElement.textContent.trim()).toBe('#2');

    const names = fixture.debugElement.queryAll(By.css('.person-name'));
    expect(names[0].nativeElement.textContent.trim()).toBe('Martin Scorsese');
    expect(names[1].nativeElement.textContent.trim()).toBe('David Fincher');
  });

  it('should display TMDb image when profilePath exists and initials fallback when null', () => {
    const img = fixture.debugElement.query(By.css('.portrait-img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toContain('/scorsese.jpg');

    const fallback = fixture.debugElement.query(By.css('.portrait-fallback'));
    expect(fallback).toBeTruthy();
    expect(fallback.nativeElement.textContent.trim()).toBe('DF');
  });

  it('should display provisional coverage chip when coverage < 100%', () => {
    expect(component.isProvisional).toBeTrue();
    const chip = fixture.debugElement.query(By.css('.provisional-chip'));
    expect(chip).toBeTruthy();
    expect(chip.nativeElement.textContent).toContain('450/1000');
  });

  it('should open see-all modal with full people array when clicked', async () => {
    const modalSpy = { present: jasmine.createSpy('present') };
    modalCtrlSpy.create.and.returnValue(Promise.resolve(modalSpy as any));

    await component.openSeeAll();

    expect(modalCtrlSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        component: PeopleModalComponent,
        componentProps: jasmine.objectContaining({
          title: 'Top Directors',
          people: mockPeople,
        }),
      })
    );
  });
});
