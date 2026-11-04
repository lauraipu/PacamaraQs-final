import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService, RolGlobal } from '../../../core/services/auth';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let router: Router;
  const login = vi.fn();
  const obtenerRutaInicio = vi.fn();
  const toastCreate = vi.fn();
  let queryParams: Record<string, string> = {};

  const rutaInicioPorRol = (rol: RolGlobal | null) =>
    rol === 'administrador' ? '/admin-dashboard' : rol === 'catador' ? '/dashboard' : '/login';

  const crear = async () => {
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams = {};
    obtenerRutaInicio.mockResolvedValue(null);
    toastCreate.mockResolvedValue({ present: vi.fn() });
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login, obtenerRutaInicio, rutaInicioPorRol } },
        { provide: ToastController, useValue: { create: toastCreate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { get queryParamMap() { return convertToParamMap(queryParams); } } }
        }
      ]
    });
  });

  it('shows the form when there is no active session', async () => {
    await crear();
    expect(component.verificandoSesion()).toBe(false);
  });

  it('routes administrators to the admin dashboard after login', async () => {
    await crear();
    component.email = 'admin@example.com';
    component.password = 'password';
    login.mockResolvedValue('administrador');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.login();

    expect(login).toHaveBeenCalledWith('admin@example.com', 'password');
    expect(navigateByUrl).toHaveBeenCalledWith('/admin-dashboard', { replaceUrl: true });
  });

  it('routes tasters to the standard dashboard', async () => {
    await crear();
    component.email = 'taster@example.com';
    component.password = 'password';
    login.mockResolvedValue('catador');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.login();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard', { replaceUrl: true });
  });

  it('honours an internal returnUrl for tasters but never for administrators', async () => {
    queryParams = { returnUrl: '/session/waiting/abc' };
    await crear();
    component.email = 'a@example.com';
    component.password = 'password';
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    login.mockResolvedValue('catador');
    await component.login();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/session/waiting/abc', { replaceUrl: true });

    login.mockResolvedValue('administrador');
    await component.login();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/admin-dashboard', { replaceUrl: true });
  });

  it('ignores external returnUrl values (open redirect)', async () => {
    queryParams = { returnUrl: '//evil.example.com' };
    await crear();
    component.email = 'a@example.com';
    component.password = 'password';
    login.mockResolvedValue('catador');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.login();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard', { replaceUrl: true });
  });

  it('redirects an already authenticated user away from the login', async () => {
    obtenerRutaInicio.mockResolvedValue('/admin-dashboard');
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await crear();

    expect(navigateByUrl).toHaveBeenCalledWith('/admin-dashboard', { replaceUrl: true });
  });

  it('translates invalid credentials into a friendly message', async () => {
    await crear();
    component.email = 'a@example.com';
    component.password = 'bad';
    login.mockRejectedValue(new Error('Invalid login credentials'));

    await component.login();

    expect(toastCreate).toHaveBeenCalledWith(expect.objectContaining({ message: 'Correo o contraseña incorrectos.' }));
    expect(component.isLoading()).toBe(false);
  });
});
