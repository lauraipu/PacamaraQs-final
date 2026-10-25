import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from './auth';
import { SupabaseService } from './supabase';

describe('AuthService', () => {
  let service: AuthService;
  const signInWithPassword = vi.fn();
  const signInAnonymously = vi.fn();
  const signUp = vi.fn();
  const signOut = vi.fn();
  const getSession = vi.fn();
  const getUser = vi.fn();
  const insert = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: { signInWithPassword, signInAnonymously, signUp, signOut, getSession, getUser },
              from
            }
          }
        }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('normalizes email for password login and returns auth data', async () => {
    const result = { user: { id: 'user-id' } };
    signInWithPassword.mockResolvedValue({ data: result, error: null });

    await expect(service.login(' user@example.com ', 'secret')).resolves.toEqual(result);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret'
    });
  });

  it('stores a profile after successful registration', async () => {
    const result = {
      user: { id: 'user-id' },
      session: { access_token: 'token' }
    };
    signUp.mockResolvedValue({ data: result, error: null });
    insert.mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await expect(service.registro(' user@example.com ', 'secret', ' Ana ')).resolves.toEqual(result);
    expect(signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
      options: { data: { nombre: 'Ana' } }
    });
    expect(from).toHaveBeenCalledWith('Usuarios');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'user-id',
        email: 'user@example.com',
        nombre: 'Ana',
        rol_global: 'catador',
        version_politica_aceptada: '1.0'
      })
    ]);
  });

  it('does not start registration when required fields are blank', async () => {
    await expect(service.registro(' ', 'secret', 'Ana')).rejects.toThrow(
      'El nombre, el correo y la contraseña son obligatorios.'
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('returns the authenticated user from Supabase', async () => {
    const user = { id: 'user-id', email: 'user@example.com' };
    getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(service.getUser()).resolves.toEqual({ user });
  });
});
