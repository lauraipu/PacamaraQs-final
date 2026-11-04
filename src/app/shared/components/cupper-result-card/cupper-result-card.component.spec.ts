import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CupperResultSummary } from '../../../core/models/session-results.model';
import { CupperResultCardComponent } from './cupper-result-card.component';

const catadorBase = (cambios: Partial<CupperResultSummary> = {}): CupperResultSummary => ({
  cupperId: 'u1',
  nombre: 'ana',
  esOrganizador: false,
  muestrasEvaluadas: 3,
  muestrasAsignadas: 4,
  estado: 'pendiente',
  submittedAt: null,
  puntajePromedio: 84.256,
  desviacionRespectoPanel: 0,
  puntajesPorMuestra: [],
  ...cambios
});

describe('CupperResultCardComponent', () => {
  let fixture: ComponentFixture<CupperResultCardComponent>;

  const renderizar = async (catador: CupperResultSummary): Promise<HTMLElement> => {
    fixture.componentRef.setInput('catador', catador);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CupperResultCardComponent] });
    fixture = TestBed.createComponent(CupperResultCardComponent);
  });

  it('renders the taster summary with a formatted average', async () => {
    const elemento = await renderizar(catadorBase());

    expect(elemento.querySelector('.avatar')?.textContent?.trim()).toBe('A');
    expect(elemento.querySelector('.cupper-role')?.textContent).toContain('Catador');
    expect(elemento.querySelector('.score-value')?.textContent).toContain('84.26');
    expect(elemento.textContent).toContain('3 / 4');
    expect(elemento.textContent).toContain('Pendiente');
  });

  it('flags a generous taster with a rounded deviation', async () => {
    const elemento = await renderizar(catadorBase({ desviacionRespectoPanel: 0.6666 }));
    const badge = elemento.querySelector('.calibration-badge') as HTMLElement;

    expect(badge.classList).toContain('generoso');
    expect(badge.textContent).toContain('+0.67 (Generoso)');
  });

  it('flags a strict taster', async () => {
    const elemento = await renderizar(catadorBase({ desviacionRespectoPanel: -1.2 }));
    const badge = elemento.querySelector('.calibration-badge') as HTMLElement;

    expect(badge.classList).toContain('estricto');
    expect(badge.textContent).toContain('-1.20 (Estricto)');
  });

  it('marks a taster within ±0.5 as calibrated and shows the submitted state', async () => {
    const elemento = await renderizar(catadorBase({ desviacionRespectoPanel: 0.5, estado: 'enviado', esOrganizador: true }));
    const badge = elemento.querySelector('.calibration-badge') as HTMLElement;

    expect(badge.classList).toContain('calibrado');
    expect(badge.classList).not.toContain('generoso');
    expect(elemento.textContent).toContain('Enviado');
    expect(elemento.querySelector('.cupper-role')?.textContent).toContain('Organizador');
  });
});
