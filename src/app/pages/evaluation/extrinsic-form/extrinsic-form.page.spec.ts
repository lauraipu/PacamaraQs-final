import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SesionService } from '../../../core/services/sesion';
import { ExtrinsicFormPage } from './extrinsic-form.page';

describe('ExtrinsicFormPage', () => {
  let component: ExtrinsicFormPage;
  let fixture: ComponentFixture<ExtrinsicFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: SesionService, useValue: { obtenerSesionPorId: vi.fn() } },
        { provide: ToastController, useValue: { create: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(ExtrinsicFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides extrinsic coffee data fields without a CVA score', () => {
    expect(component.formulario.farming.country).toBe('');
    expect(component.formulario.processing.processType).toBe('');
    expect(component.formulario.certifications.organic).toBe(false);
    expect(component).not.toHaveProperty('puntaje');
  });
});
