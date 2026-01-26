/// <reference path="../../src/react-test-shim.d.ts" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const supabaseMocks = vi.hoisted(() => {
  const setCurrentOwnerIdMock = vi.fn();
  const setCurrentUserEmailMock = vi.fn();
  const getSessionMock = vi.fn(async () => ({
    data: { session: { user: { id: 'U1', email: 'u1@test.local' } } },
    error: null
  }));
  const onAuthStateChangeMock = vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } }
  }));
  const signOutMock = vi.fn(async () => ({ error: null }));
  const orderMock = vi.fn(async () => ({ data: [], error: null }));
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return {
    setCurrentOwnerIdMock,
    setCurrentUserEmailMock,
    getSessionMock,
    onAuthStateChangeMock,
    signOutMock,
    fromMock
  };
});

vi.mock('@services/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: supabaseMocks.getSessionMock,
        onAuthStateChange: supabaseMocks.onAuthStateChangeMock,
        signOut: supabaseMocks.signOutMock
      },
      from: supabaseMocks.fromMock
    },
    setCurrentOwnerId: supabaseMocks.setCurrentOwnerIdMock,
    setCurrentUserEmail: supabaseMocks.setCurrentUserEmailMock
  };
});

import { SessionProvider } from '@/contexts/SessionProvider';
import { useSession } from '@/contexts/useSession';

function Consumer() {
  const { userId, logout } = useSession();
  return (
    <div>
      <div data-testid="userId">{String(userId ?? '')}</div>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('SessionProvider owner_id wiring (integration)', () => {
  it('should setCurrentOwnerId on boot session and clear on logout', async () => {
    render(
      <SessionProvider>
        <Consumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(supabaseMocks.setCurrentOwnerIdMock).toHaveBeenCalledWith('U1');
    });

    expect(screen.getByTestId('userId').textContent).toBe('U1');

    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => {
      expect(supabaseMocks.setCurrentOwnerIdMock).toHaveBeenCalledWith(null);
    });
  });
});
