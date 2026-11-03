import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { SesionService } from '../../../core/services/sesion';
import { DescriptiveFormPage } from './descriptive-form.page';

describe('DescriptiveFormPage', () => {
  let component: DescriptiveFormPage;
  let fixture: ComponentFixture<DescriptiveFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: SesionService, useValue: { obtenerSesionPorId: vi.fn() } },
        { provide: AlertController, useValue: { create: vi.fn() } },
        { provide: ToastController, useValue: { create: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(DescriptiveFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts intensity scales at zero and has no hedonic score', () => {
    expect(component.formulario.fragancia.intensidad).toBe(0);
    expect(component.formulario.acidez.intensidad).toBe(0);
    expect(component.formulario.fragancia.extra).toBe('');
    expect(component).not.toHaveProperty('puntaje');
  });

  it('toggles flavor descriptors and mouthfeel textures', () => {
    component.toggleDescriptor('fragancia', 'Jazmín');
    expect(component.isDescriptorSelected('fragancia', 'Jazmín')).toBe(true);
    component.toggleDescriptor('fragancia', 'Jazmín');
    expect(component.isDescriptorSelected('fragancia', 'Jazmín')).toBe(false);

    component.toggleTextura('Aceitoso');
    expect(component.formulario.sensacionEnBoca.textura).toContain('Aceitoso');
  });
});
