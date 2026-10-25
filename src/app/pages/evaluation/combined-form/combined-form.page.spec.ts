import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombinedFormPage } from './combined-form.page';

describe('CombinedFormPage', () => {
  let component: CombinedFormPage;
  let fixture: ComponentFixture<CombinedFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CombinedFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
