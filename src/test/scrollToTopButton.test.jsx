import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ScrollToTopButton from '../components/ScrollToTopButton.jsx';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    window.scrollY = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a button with aria-label', () => {
    render(<ScrollToTopButton />);
    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument();
  });

  it('is hidden when scrolled above threshold', () => {
    render(<ScrollToTopButton />);
    const btn = screen.getByRole('button');
    expect(btn).not.toHaveClass('visible');
  });

  it('becomes visible when scrolled past threshold', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 400;
    fireEvent.scroll(window);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('visible');
  });

  it('scrolls to top on click', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 400;
    fireEvent.scroll(window);
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    fireEvent.click(screen.getByRole('button'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
