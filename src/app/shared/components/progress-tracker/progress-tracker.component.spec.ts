import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressTrackerComponent } from './progress-tracker.component';

describe('ProgressTrackerComponent', () => {
  let fixture: ComponentFixture<ProgressTrackerComponent>;

  const renderizar = async (completados: number, total: number): Promise<HTMLElement> => {
    fixture.componentRef.setInput('completados', completados);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProgressTrackerComponent] });
    fixture = TestBed.createComponent(ProgressTrackerComponent);
  });

  it('shows 0% and no success message when nobody has joined', async () => {
    const elemento = await renderizar(0, 0);

    expect(fixture.componentInstance.porcentaje).toBe(0);
    expect(elemento.querySelector('.progress-hint.success')).toBeNull();
  });

  it('rounds the percentage and keeps waiting while tasters are pending', async () => {
    const elemento = await renderizar(1, 3);

    expect(fixture.componentInstance.porcentaje).toBe(33);
    expect((elemento.querySelector('.progress-bar-fill') as HTMLElement).style.width).toBe('33%');
    expect(elemento.textContent).toContain('1 de 3');
    expect(elemento.textContent).toContain('Esperando a que los demás terminen');
  });

  it('celebrates when every taster has finished', async () => {
    const elemento = await renderizar(4, 4);

    expect(fixture.componentInstance.porcentaje).toBe(100);
    expect(elemento.querySelector('.progress-hint.success')?.textContent).toContain('¡Todos han terminado!');
  });
});
