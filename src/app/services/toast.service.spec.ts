import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let toastControllerSpy: jasmine.SpyObj<ToastController>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ToastController', ['create']);
    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: ToastController, useValue: spy },
      ],
    });
    service = TestBed.inject(ToastService);
    toastControllerSpy = TestBed.inject(ToastController) as jasmine.SpyObj<ToastController>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create and present a toast', async () => {
    const presentSpy = jasmine.createSpy('present');
    toastControllerSpy.create.and.returnValue(Promise.resolve({ present: presentSpy } as any));

    await service.showToast('Test message');

    expect(toastControllerSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: 'Test message' })
    );
    expect(presentSpy).toHaveBeenCalled();
  });
});
