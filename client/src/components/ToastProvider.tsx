/**
 * ToastProvider - Toast notifications using Radix UI
 *
 * Provides toast notifications throughout the app
 * Bolt.new uses similar pattern for user feedback
 */

import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { focus, radius, transitions, typography } from '../lib/design-tokens';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, description?: string, type: ToastType = 'info') => {
    const id = uuidv4();
    setToasts((prev) => [...prev, { id, title, description, type }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            className={`
              ${radius.md} border p-4 shadow-lg
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
              data-[swipe=cancel]:translate-x-0
              data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
              data-[state=open]:slide-in-from-top-full data-[state=closed]:fade-out-80
              ${transitions.all}
              ${
                toast.type === 'success'
                  ? 'bg-green-50 border-green-200'
                  : toast.type === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
              }
            `}
            onOpenChange={(open) => !open && removeToast(toast.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Toast.Title
                  className={`
                    ${typography.label} font-medium
                    ${toast.type === 'success' ? 'text-green-900' : toast.type === 'error' ? 'text-red-900' : 'text-blue-900'}
                  `}
                >
                  {toast.title}
                </Toast.Title>
                {toast.description && (
                  <Toast.Description
                    className={`
                      mt-1 ${typography.caption}
                      ${toast.type === 'success' ? 'text-green-700' : toast.type === 'error' ? 'text-red-700' : 'text-blue-700'}
                    `}
                  >
                    {toast.description}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                className={`
                  ${focus.ring} ${radius.sm} ${transitions.colors}
                  p-1 hover:bg-black/10
                  ${toast.type === 'success' ? 'text-green-700' : toast.type === 'error' ? 'text-red-700' : 'text-blue-700'}
                `}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Toast.Close>
            </div>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed top-0 right-0 flex flex-col gap-2 w-96 max-w-full m-0 p-6 list-none z-50 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
