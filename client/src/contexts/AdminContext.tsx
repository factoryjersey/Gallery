import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  toggleAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('admin_mode') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('admin_mode', String(isAdmin));
  }, [isAdmin]);

  const toggleAdmin = () => setIsAdmin(prev => !prev);

  return (
    <AdminContext.Provider value={{ isAdmin, toggleAdmin }}>
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
