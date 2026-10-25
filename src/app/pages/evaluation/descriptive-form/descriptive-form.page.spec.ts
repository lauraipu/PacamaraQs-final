import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DescriptiveFormPage } from './descriptive-form.page';

describe('DescriptiveFormPage', () => {
  let component: DescriptiveFormPage;
  let fixture: ComponentFixture<DescriptiveFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DescriptiveFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
