import { fireEvent, render, screen } from '@testing-library/react';
import { Badge, Button, LoadingSpinner } from './ui';

describe('shared UI', () => {
  it('supports disabled and accessible button states', () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces loading status to assistive technology', () => {
    render(<LoadingSpinner label="Loading projects" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
  });

  it('gives project statuses a semantic tone while keeping the status text', () => {
    render(<><Badge>ACTIVE</Badge><Badge>ON_HOLD</Badge><Badge>CANCELLED</Badge></>);
    expect(screen.getByText('ACTIVE')).toHaveClass('badge-success');
    expect(screen.getByText('ON_HOLD')).toHaveClass('badge-warning');
    expect(screen.getByText('CANCELLED')).toHaveClass('badge-error');
  });
});
