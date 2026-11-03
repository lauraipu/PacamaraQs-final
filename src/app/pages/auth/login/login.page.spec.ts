import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  const login = vi.fn();
  const getUser = vi.fn();
  const obtenerRolGlobal = vi.fn();
  const toastCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login, getUser, obtenerRolGlobal } },
        { provide: ToastController, useValue: { create: toastCreate } }
      ]
    });
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('routes administrators to the admin dashboard after login', async () => {
    component.email = 'admin@example.com';
    component.password = 'password';
    login.mockResolvedValue({});
    getUser.mockResolvedValue({ user: { id: 'admin-id', is_anonymous: false } });
    obtenerRolGlobal.mockResolvedValue('administrador');
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.login();

    expect(obtenerRolGlobal).toHaveBeenCalledWith('admin-id');
    expect(navigateByUrl).toHaveBeenCalledWith('/admin-dashboard', { replaceUrl: true });
  });

  it('routes tasters and organizers to the standard dashboard', async () => {
    component.email = 'taster@example.com';
    component.password = 'password';
    login.mockResolvedValue({});
    getUser.mockResolvedValue({ user: { id: 'taster-id', is_anonymous: false } });
    obtenerRolGlobal.mockResolvedValue('organizador');
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.login();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard', { replaceUrl: true });
  });
});
