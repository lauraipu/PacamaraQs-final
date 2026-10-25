import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExtrinsicFormPage } from './extrinsic-form.page';

describe('ExtrinsicFormPage', () => {
  let component: ExtrinsicFormPage;
  let fixture: ComponentFixture<ExtrinsicFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ExtrinsicFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
