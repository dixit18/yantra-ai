'use client';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

export interface PilotFormValues {
  name: string;
  email: string;
  company: string;
  message: string;
}

export type PilotFormErrors = Partial<Record<keyof PilotFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePilotForm(values: PilotFormValues): PilotFormErrors {
  const errors: PilotFormErrors = {};
  if (!values.name.trim()) {
    errors.name = 'Please tell us your name.';
  }
  if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = 'Please enter a valid work email.';
  }
  if (!values.company.trim()) {
    errors.company = 'Please tell us your company.';
  }
  if (values.message.trim().length < 20) {
    errors.message = 'Please describe your service challenge in at least 20 characters.';
  }
  return errors;
}

const EMPTY: PilotFormValues = { name: '', email: '', company: '', message: '' };

export function PilotForm() {
  const [values, setValues] = useState<PilotFormValues>(EMPTY);
  const [errors, setErrors] = useState<PilotFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set =
    (key: keyof PilotFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = validatePilotForm(values);
    setErrors(next);
    setSubmitted(Object.keys(next).length === 0);
  };

  if (submitted) {
    return (
      <div role="status" data-testid="pilot-notice">
        <h2>Details look good.</h2>
        <p>
          This demo form validates input only and sends nothing anywhere — pilot intake opens with
          the first design partner. Your entries stayed in this browser.
        </p>
      </div>
    );
  }

  const describedBy = (key: keyof PilotFormValues): string | undefined =>
    errors[key] ? `pilot-error-${key}` : undefined;

  const field = (key: keyof PilotFormValues, label: string, input: ReactNode) => (
    <div className="form-field">
      <label htmlFor={`pilot-${key}`}>{label}</label>
      {input}
      {errors[key] ? (
        <p role="alert" className="form-error" data-testid={`pilot-error-${key}`}>
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate data-testid="pilot-form">
      {field(
        'name',
        'Your name',
        <input
          id="pilot-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={!!errors.name}
          aria-describedby={describedBy('name')}
          value={values.name}
          onChange={set('name')}
        />,
      )}
      {field(
        'email',
        'Work email',
        <input
          id="pilot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!errors.email}
          aria-describedby={describedBy('email')}
          value={values.email}
          onChange={set('email')}
        />,
      )}
      {field(
        'company',
        'Company',
        <input
          id="pilot-company"
          name="company"
          type="text"
          autoComplete="organization"
          required
          aria-invalid={!!errors.company}
          aria-describedby={describedBy('company')}
          value={values.company}
          onChange={set('company')}
        />,
      )}
      {field(
        'message',
        'Service challenge',
        <textarea
          id="pilot-message"
          name="message"
          rows={5}
          required
          aria-invalid={!!errors.message}
          aria-describedby={describedBy('message')}
          value={values.message}
          onChange={set('message')}
        />,
      )}
      <button type="submit" className="y-btn y-btn-primary">
        Validate details
      </button>
    </form>
  );
}
