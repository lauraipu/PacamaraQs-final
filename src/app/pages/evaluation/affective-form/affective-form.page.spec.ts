import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AffectiveFormPage } from './affective-form.page';

describe('AffectiveFormPage', () => {
  let component: AffectiveFormPage;
  let fixture: ComponentFixture<AffectiveFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AffectiveFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
