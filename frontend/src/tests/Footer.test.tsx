import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer';

// Mock the config lib
import * as config from '../lib/config';
vi.mock('../lib/config', () => ({
  GITHUB_REPO: 'https://github.com/test/repo',
  EXPLORER_URL: 'https://explorer.test',
  NETWORK: 'TESTNET',
  CONTRACTS: {
    TOKEN_A: 'CAAA',
    TOKEN_B: 'CBBB',
    POOL: 'CCCC',
  },
}));

describe('Footer Component', () => {
  it('renders protocol information', () => {
    render(<Footer />);
    const elements = screen.getAllByText(/SoroSwap/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Constant product/i)).toBeDefined();
  });

  it('contains explorer links', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    const hasExplorer = links.some(link => link.getAttribute('href')?.includes('explorer.test'));
    expect(hasExplorer).toBe(true);
  });
});
