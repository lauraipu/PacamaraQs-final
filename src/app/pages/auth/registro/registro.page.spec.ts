import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth';
import { RegistroPage } from './registro.page';

describe('RegistroPage', () => {
  let component: RegistroPage;
  let fixture: ComponentFixture<RegistroPage>;
  const registro = vi.fn();
  const present = vi.fn();
  const createToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createToast.mockResolvedValue({ present });
    TestBed.configureTestingModule({
      imports: [RegistroPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { registro } },
        { provide: ToastController, useValue: { create: createToast } }
      ]
    });
    fixture = TestBed.createComponent(RegistroPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects mismatched passwords before calling the auth service', async () => {
    component.nombre = 'Ana';
    component.email = 'ana@example.com';
    component.password = 'secret1';
    component.confirmPassword = 'secret2';
    component.politicaAceptada = true;

    await component.registro();

    expect(registro).not.toHaveBeenCalled();
    expect(createToast).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Las contraseñas no coinciden.'
    }));
    expect(present).toHaveBeenCalled();
  });
});
