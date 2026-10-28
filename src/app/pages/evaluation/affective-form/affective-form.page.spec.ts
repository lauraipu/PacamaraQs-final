import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SesionService } from '../../../core/services/sesion';
import { AffectiveFormPage } from './affective-form.page';

describe('AffectiveFormPage', () => {
  let component: AffectiveFormPage;
  let fixture: ComponentFixture<AffectiveFormPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: SesionService, useValue: { obtenerSesionPorId: vi.fn() } },
        { provide: ToastController, useValue: { create: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(AffectiveFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts at the neutral hedonic value and calculates the base CVA score', () => {
    expect(component.formulario.fragancia).toBe(5);
    expect(component.puntaje).toBe(79);
  });

  it('updates the score for hedonic ratings and defect penalties', () => {
    component.formulario.fragancia = 6;
    expect(component.puntaje).toBe(79.75);

    component.formulario.defectos.tazasDefectuosas = 1;
    expect(component.puntaje).toBe(75.75);
  });
});
