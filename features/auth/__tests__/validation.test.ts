/// <reference types="jest" />

import {
  createForgotPasswordSchema,
  createRegisterSchema,
  createSignInSchema,
  requireOnline
} from '../validation';

const EMAIL = {
  enterValidEmail: 'enterValidEmail',
  emailRequired: 'emailRequired'
};

const SIGN_IN = {
  ...EMAIL,
  passwordRequired: 'passwordRequired'
};

const REGISTER = {
  ...SIGN_IN,
  passwordMinLength: 'passwordMinLength',
  usernameRequired: 'usernameRequired',
  passwordsNoMatch: 'passwordsNoMatch'
};

describe('requireOnline', () => {
  it('throws internetConnectionRequired when offline', () => {
    expect(() => requireOnline(false, 'internetConnectionRequired')).toThrow(
      'internetConnectionRequired'
    );
  });

  it('returns when online', () => {
    expect(() =>
      requireOnline(true, 'internetConnectionRequired')
    ).not.toThrow();
  });
});

describe('createSignInSchema', () => {
  const schema = createSignInSchema(SIGN_IN);

  it('accepts a mixed-case email and any non-empty password', () => {
    const parsed = schema.parse({
      email: 'User@LangQuest.ORG',
      password: 'x'
    });
    expect(parsed.email).toBe('user@langquest.org');
    expect(parsed.password).toBe('x');
  });

  it('rejects surrounding spaces before trim because email format runs first', () => {
    const result = schema.safeParse({
      email: '  user@langquest.org  ',
      password: 'secret'
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = schema.safeParse({ email: '', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = schema.safeParse({
      email: 'not-an-email',
      password: 'secret'
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = schema.safeParse({
      email: 'user@langquest.org',
      password: ''
    });
    expect(result.success).toBe(false);
  });
});

describe('createForgotPasswordSchema', () => {
  const schema = createForgotPasswordSchema(EMAIL);

  it('accepts a valid email', () => {
    expect(schema.parse({ email: 'user@langquest.org' }).email).toBe(
      'user@langquest.org'
    );
  });

  it('rejects an empty email', () => {
    expect(schema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('createRegisterSchema', () => {
  const schema = createRegisterSchema(REGISTER);
  const valid = {
    email: 'user@langquest.org',
    password: 'secret1',
    confirmPassword: 'secret1',
    username: 'carl'
  };

  it('accepts matching passwords and a username of at least 3 characters', () => {
    expect(schema.parse(valid).username).toBe('carl');
  });

  it('rejects a password shorter than 6 characters', () => {
    const result = schema.safeParse({ ...valid, password: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirmPassword', () => {
    const result = schema.safeParse({
      ...valid,
      confirmPassword: 'other12'
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = schema.safeParse({ ...valid, username: 'ab' });
    expect(result.success).toBe(false);
  });
});
