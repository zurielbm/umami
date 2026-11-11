import { expect, test, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { LinkDomainField } from './LinkDomainField';

const domains = [
  { id: 'd1', hostname: 'go.brand.com', userId: 'user-1', teamId: null, createdAt: '' },
  { id: 'd2', hostname: 'links.other.com', userId: 'user-1', teamId: null, createdAt: '' },
];

test('renders nothing until a domain exists, so the link form is unchanged by default', () => {
  render(<LinkDomainField domains={[]} onChange={vi.fn()} />);

  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText('Domain')).not.toBeInTheDocument();
});

test('shows Default when the link has no domain', () => {
  render(<LinkDomainField domains={domains} value={null} onChange={vi.fn()} />);

  expect(screen.getByRole('combobox')).toHaveTextContent('Default');
});

test('shows the hostname of the link’s domain', () => {
  render(<LinkDomainField domains={domains} value="d2" onChange={vi.fn()} />);

  expect(screen.getByRole('combobox')).toHaveTextContent('links.other.com');
});
