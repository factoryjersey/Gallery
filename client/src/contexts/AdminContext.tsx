import { createContext, useCallback, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface AdminContextType {
  isAdmin: boolean;
  configured: boolean;       // server has ADMIN_PASSWORD + ADMIN_COOKIE_SECRET set
  isLoading: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Kept for backwards-compat with one or two callers that toggled isAdmin
  // directly. Flipping admin "off" means signing out; "on" goes through the
  // login form, so this is effectively a logout shortcut.
  toggleAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

interface MePayload { isAdmin: boolean; configured: boolean }

export function AdminProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<MePayload>({
    queryKey: ['/api/admin/me'],
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest('POST', '/api/admin/login', { password });
      return (await res.json()) as { isAdmin: boolean };
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/admin/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/admin/me'], { isAdmin: false, configured: data?.configured ?? true });
    },
  });

  const login = useCallback(async (password: string) => {
    try {
      await loginMutation.mutateAsync(password);
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/me'] });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { ok: false, error: message };
    }
  }, [loginMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: ['/api/admin/me'] });
  }, [logoutMutation]);

  const toggleAdmin = useCallback(() => {
    if (data?.isAdmin) {
      void logout();
    }
    // Turning admin "on" requires the password — handled by the login form.
  }, [data?.isAdmin, logout]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin: !!data?.isAdmin,
        configured: data?.configured ?? false,
        isLoading,
        login,
        logout,
        toggleAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
