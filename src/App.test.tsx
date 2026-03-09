import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { expect, vi, describe, it, beforeEach } from 'vitest';

// Mock the exchange rate API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: 'success',
        rates: { KRW: 9.0 }
      })
    });
  });

  it('calculates the duty-free price correctly when tax-included price is given', async () => {
    render(<App />);
    
    // Wait for the exchange rate to load
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('세금 포함 금액');
    
    // Clear initial value and set 11,000 JPY
    fireEvent.change(input, { target: { value: '11000' } });

    // 11,000 / 1.1 = 10,000 JPY (Duty-free)
    // 10,000 * 9.0 = 90,000 KRW
    expect(screen.getByText('¥ 10,000')).toBeInTheDocument();
    expect(screen.getByText('90,000')).toBeInTheDocument();
  });

  it('shows warning when the price is below 5,000 JPY', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('세금 포함 금액');
    
    // 4,400 JPY (Tax-included) -> 4,000 JPY (Pre-tax)
    fireEvent.change(input, { target: { value: '4400' } });

    // Below 5,000 JPY threshold
    expect(screen.getByText('¥ 5,000 미만 면세 불가')).toBeInTheDocument();
    
    // Final JPY should be the tax-included price (4,400)
    // 4,400 * 9.0 = 39,600 KRW
    expect(screen.getByText('¥ 4,400')).toBeInTheDocument();
    expect(screen.getByText('39,600')).toBeInTheDocument();
  });

  it('shows warning when the price is above 500,000 JPY', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('세금 포함 금액');
    
    // 550,001 JPY (Pre-tax) is too high
    // 605,001 / 1.1 = 550,000.9... -> 550,001
    fireEvent.change(input, { target: { value: '605001' } });

    expect(screen.getByText('¥ 500,000 초과 면세 불가')).toBeInTheDocument();
  });

  it('toggles between tax-included and pre-tax input', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const preTaxButton = screen.getByText('세전(면세가) 입력');
    fireEvent.click(preTaxButton);

    expect(screen.getByLabelText('세전 금액(면세가)')).toBeInTheDocument();

    const input = screen.getByLabelText('세전 금액(면세가)');
    fireEvent.change(input, { target: { value: '10000' } });

    // 10,000 JPY (Pre-tax) * 9.0 = 90,000 KRW
    expect(screen.getByText('¥ 10,000')).toBeInTheDocument();
    expect(screen.getByText('90,000')).toBeInTheDocument();
  });

  it('handles empty input gracefully', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('세금 포함 금액');
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByText('¥ 0')).toBeInTheDocument();
    expect(screen.getAllByText('₩').length).toBeGreaterThan(0); 
  });

  it('limits input to 7 digits', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/¥ 100 = ₩ 900.00/)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('세금 포함 금액') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567' } });
    expect(input.value).toBe('1,234,567');

    fireEvent.change(input, { target: { value: '12345678' } });
    // Should still be '1,234,567' because change was rejected or logic limits it
    expect(input.value).toBe('1,234,567');
  });
});
