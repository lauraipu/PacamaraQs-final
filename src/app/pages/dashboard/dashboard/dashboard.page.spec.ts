import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { EstadoSesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
import { SupabaseService } from '../../../core/services/supabase';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;
  const getUser = vi.fn();
  const obtenerMisSesiones = vi.fn();
  const createToast = vi.fn();
  const from = vi.fn();
  const selectProfile = vi.fn();
  const filterProfile = vi.fn();
  const maybeSingle = vi.fn();
  const unirseASesion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createToast.mockResolvedValue({ present: vi.fn() });
    from.mockReturnValue({ select: selectProfile });
    selectProfile.mockReturnValue({ eq: filterProfile });
    filterProfile.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { nombre: 'Catherine Quimbaya' }, error: null });
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getUser } },
        { provide: SesionService, useValue: { obtenerMisSesiones, unirseASesion } },
        { provide: SupabaseService, useValue: { client: { from } } },
        { provide: ToastController, useValue: { create: createToast } }
      ]
    });
    getUser.mockResolvedValue({
      user: { id: 'user-id', is_anonymous: false, user_metadata: {} }
    });
    obtenerMisSesiones.mockResolvedValue([]);
    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads and maps sessions owned by the authenticated user', async () => {
    obtenerMisSesiones.mockResolvedValue([{
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cosecha',
      formato: 'combinado',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.EN_ESPERA,
      creadaEn: '2026-10-20T00:00:00.000Z'
    }]);

    await component.cargarSesionesReales();

    expect(obtenerMisSesiones).toHaveBeenCalledWith('user-id');
    expect(component.sesiones).toHaveLength(1);
    expect(component.sesiones[0]).toMatchObject({
      id: 'session-id',
      titulo: 'Cosecha',
      tipo: 'Combinado',
      estado: 'En espera',
      rol: 'Organizador',
      cantMuestras: 6,
      cantCatadores: 5
    });
    expect(component.cargando).toBe(false);
  });

  it('loads the registered profile name and uses it to join a session', async () => {
    await vi.waitFor(() => expect(component.nombreUsuario).toBe('Catherine Quimbaya'));
    expect(from).toHaveBeenCalledWith('usuarios');

    const sesion = {
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cosecha',
      notas: '',
      formato: 'combinado',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.EN_ESPERA
    };
    unirseASesion.mockResolvedValue({ sesion, participante: {} });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.codigoInput = 'AB12-3C4';

    await component.unirseSesion();

    expect(unirseASesion).toHaveBeenCalledWith('AB12-3C4', 'Catherine Quimbaya');
    expect(navigate).toHaveBeenCalledWith(['/session/waiting', 'session-id']);
  });

  it('uses the guest label for anonymous users', async () => {
    getUser.mockResolvedValue({ user: { id: 'guest-id', is_anonymous: true } });
    fixture.destroy();
    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    await vi.waitFor(() => expect(component.nombreUsuario).toBe('Catador Invitado'));
  });
});
