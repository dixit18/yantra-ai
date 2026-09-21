import { describe, expect, it } from 'vitest';
import { validatePilotForm } from '../app/contact/form.js';

describe('validatePilotForm', () => {
  const good = {
    name: 'Asha Rao',
    email: 'asha@oem.example',
    company: 'Acme Packaging',
    message: 'Our technicians wait days for senior answers on fault codes.',
  };

  it('accepts a complete enquiry', () => {
    expect(validatePilotForm(good)).toEqual({});
  });

  it('flags every invalid field at once', () => {
    const errors = validatePilotForm({
      name: '',
      email: 'not-an-email',
      company: '',
      message: 'short',
    });
    expect(Object.keys(errors).sort()).toEqual(['company', 'email', 'message', 'name']);
  });
});
