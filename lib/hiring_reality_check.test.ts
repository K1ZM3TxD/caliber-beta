// lib/hiring_reality_check.test.ts
import { computeHiringRealityCheck, _testing } from './hiring_reality_check';

const { extractRequirements, stripBenefitsSection, isInsuranceBenefitsOnly } = _testing;

// ── stripBenefitsSection ────────────────────────────────────────────────────

describe('stripBenefitsSection', () => {
  it('truncates at "Benefits:" header', () => {
    const text = 'Must be 21+\nAvailable evenings\n\nBenefits:\n- Health insurance\n- 401k';
    expect(stripBenefitsSection(text)).toBe('Must be 21+\nAvailable evenings');
  });

  it('truncates at "What We Offer" header', () => {
    const text = 'Requirements:\n- 2+ years\n\nWhat We Offer\n- Dental insurance';
    expect(stripBenefitsSection(text)).toBe('Requirements:\n- 2+ years');
  });

  it('truncates at "Compensation and Benefits" header', () => {
    const text = 'Qualifications:\n- Detail oriented\n\nCompensation and Benefits:\n- Health insurance';
    expect(stripBenefitsSection(text)).toBe('Qualifications:\n- Detail oriented');
  });

  it('truncates at "Employee Benefits" header', () => {
    const text = 'Skills required:\n- Teamwork\n\nEmployee Benefits:\n- Medical insurance';
    expect(stripBenefitsSection(text)).toBe('Skills required:\n- Teamwork');
  });

  it('returns full text when no benefits section found', () => {
    const text = 'Requirements:\n- 5+ years experience\n- AWS knowledge';
    expect(stripBenefitsSection(text)).toBe(text);
  });

  it('picks earliest benefits marker when multiple exist', () => {
    const text = 'Reqs here\n\nBenefits:\n- PTO\n\nWe Offer:\n- More stuff';
    expect(stripBenefitsSection(text)).toBe('Reqs here');
  });
});

// ── isInsuranceBenefitsOnly ─────────────────────────────────────────────────

describe('isInsuranceBenefitsOnly', () => {
  it('returns true when insurance only appears as "health insurance"', () => {
    expect(isInsuranceBenefitsOnly('We offer health insurance and PTO')).toBe(true);
  });

  it('returns true for multiple benefits-context phrases', () => {
    expect(isInsuranceBenefitsOnly('health insurance, dental insurance, vision insurance')).toBe(true);
  });

  it('returns true for "insurance benefits" phrasing', () => {
    expect(isInsuranceBenefitsOnly('Competitive pay and insurance benefits')).toBe(true);
  });

  it('returns true for "insurance coverage" phrasing', () => {
    expect(isInsuranceBenefitsOnly('Full insurance coverage provided')).toBe(true);
  });

  it('returns false when insurance appears as domain term', () => {
    expect(isInsuranceBenefitsOnly('3+ years insurance industry experience required')).toBe(false);
  });

  it('returns false when domain and benefits insurance both appear', () => {
    const text = 'Insurance underwriting experience required. We also offer health insurance.';
    expect(isInsuranceBenefitsOnly(text)).toBe(false);
  });

  it('returns false for "insurance operations" context', () => {
    expect(isInsuranceBenefitsOnly('Experience in insurance operations and claims')).toBe(false);
  });
});

// ── extractRequirements: domain filtering ───────────────────────────────────

describe('extractRequirements: benefits filtering', () => {
  it('does NOT extract insurance domain from bartender job with benefits', () => {
    const jobText = [
      'Bartender',
      'We are looking for an experienced bartender to join our team.',
      '',
      'Requirements:',
      '- Must be 21 years of age',
      '- 1+ years bartending experience',
      '- Ability to stand for extended periods',
      '',
      'Benefits:',
      '- Health insurance',
      '- Dental insurance',
      '- 401(k)',
      '- Paid time off',
    ].join('\n');

    const reqs = extractRequirements(jobText);
    expect(reqs.domainRequirements).not.toContain('insurance');
  });

  it('does NOT extract insurance domain from inline benefits mention', () => {
    const jobText = 'Bartender needed. Must be 21+. We offer health insurance, dental, and PTO.';
    const reqs = extractRequirements(jobText);
    expect(reqs.domainRequirements).not.toContain('insurance');
  });

  it('DOES extract insurance domain from real insurance industry job', () => {
    const jobText = [
      'Insurance Claims Adjuster',
      '',
      'Requirements:',
      '- 3+ years insurance industry experience',
      '- Property and casualty insurance knowledge',
      '- Strong analytical skills',
      '',
      'Benefits:',
      '- Health insurance',
      '- 401(k)',
    ].join('\n');

    const reqs = extractRequirements(jobText);
    expect(reqs.domainRequirements).toContain('insurance');
  });

  it('DOES extract insurance domain when context is insurance operations', () => {
    const jobText = [
      'Underwriting Analyst',
      '',
      'Qualifications:',
      '- Experience in insurance underwriting',
      '- Knowledge of insurance products and operations',
    ].join('\n');

    const reqs = extractRequirements(jobText);
    expect(reqs.domainRequirements).toContain('insurance');
  });
});

// ── computeHiringRealityCheck: end-to-end ───────────────────────────────────

describe('computeHiringRealityCheck: benefits vs domain', () => {
  const softwareResumeText = [
    'Software Engineer with 5 years experience.',
    'Skills: TypeScript, React, Node.js, AWS.',
    'B.S. Computer Science, University of Michigan, 2019.',
  ].join('\n');

  it('bartender job with insurance benefits → no insurance domain penalty', () => {
    const jobText = [
      'Bartender',
      '',
      'Requirements:',
      '- Must be 21+',
      '- Weekend availability',
      '',
      'Benefits:',
      '- Health insurance',
      '- Dental insurance',
    ].join('\n');

    const result = computeHiringRealityCheck(jobText, softwareResumeText);
    expect(result.reason).not.toContain('insurance domain');
  });

  it('insurance industry job → insurance domain penalty applies', () => {
    const jobText = [
      'Claims Adjuster',
      '',
      'Requirements:',
      '- 3+ years insurance claims experience',
      '- Insurance licensing required',
    ].join('\n');

    const result = computeHiringRealityCheck(jobText, softwareResumeText);
    expect(result.reason).toContain('insurance domain');
    expect(result.band).toBe('Unlikely');
  });
});
