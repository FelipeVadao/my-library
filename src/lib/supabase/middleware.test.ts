import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

import { updateSession } from './middleware';

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

describe('updateSession', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it('redirects unauthenticated users away from the dashboard ("/")', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/scan');
  });

  it('redirects unauthenticated users away from "/books"', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest('/books'));
    expect(res.headers.get('location')).toContain('/scan');
  });

  it('redirects unauthenticated users away from "/books/some-id" (prefix match)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest('/books/some-id'));
    expect(res.headers.get('location')).toContain('/scan');
  });

  it('lets unauthenticated users reach "/scan" (not protected)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest('/scan'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets authenticated users reach "/"', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const res = await updateSession(makeRequest('/'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets authenticated users reach "/books"', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const res = await updateSession(makeRequest('/books'));
    expect(res.headers.get('location')).toBeNull();
  });
});
