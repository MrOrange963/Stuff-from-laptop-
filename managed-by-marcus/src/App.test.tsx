import { render, screen } from '@testing-library/react';
import App from './App';

describe('Managed by Marcus', () => {
  it('renders the main title and meeting counter', () => {
    render(<App />);
    expect(screen.getByText(/Managed by Marcus/i)).toBeInTheDocument();
    expect(screen.getByText(/Marcus’s Calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 25/i)).toBeInTheDocument();
  });

  it('shows the first problem prompt', () => {
    render(<App />);
    expect(screen.getByText(/The schedule is slipping/i)).toBeInTheDocument();
  });
});
