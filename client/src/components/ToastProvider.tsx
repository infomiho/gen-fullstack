/**
 * ToastProvider - Toast notifications using Radix UI
 *
 * Provides toast notifications throughout the app
 * Redesigned with minimal color approach inspired by shadcn/ui Sonner
 */

import * as Toast from '@radix-ui/react-toast';
import { CircleCheck, Info, OctagonX, TriangleAlert, X } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { focus, radius, transitions, typography } from '../lib/design-tokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

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

/**
 * Get icon and color for toast type
 * Uses subtle, icon-based differentiation rather than bright backgrounds
 */
function getToastIcon(type: ToastType): { icon: React.ReactNode; iconColor: string } {
  switch (type) {
    case 'success':
      return {
        icon: <CircleCheck className="h-4 w-4" />,
        iconColor: 'text-green-600',
      };
    case 'error':
      return {
        icon: <OctagonX className="h-4 w-4" />,
        iconColor: 'text-red-600',
      };
    case 'warning':
      return {
        icon: <TriangleAlert className="h-4 w-4" />,
        iconColor: 'text-amber-600',
      };
    case 'info':
      return {
        icon: <Info className="h-4 w-4" />,
        iconColor: 'text-blue-600',
      };
  }
}

/**
 * Individual toast item component
 * Uses minimal color with icon-based state differentiation
 */
function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const { icon, iconColor } = getToastIcon(toast.type);

  return (
    <Toast.Root
      key={toast.id}
      className={`
        ${radius.md} border border-gray-200 bg-white p-4 shadow-lg
        data-[state=open]:animate-in data-[state=closed]:animate-out
        data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
        data-[swipe=cancel]:translate-x-0
        data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
        data-[state=open]:slide-in-from-top-full data-[state=closed]:fade-out-80
        ${transitions.all}
      `}
      onOpenChange={(open) => !open && onRemove(toast.id)}
    >
      <div className="flex items-start gap-3">
        {/* Icon with subtle color */}
        <div className={`flex-shrink-0 ${iconColor}`}>{icon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Toast.Title className={`${typography.label} font-medium text-gray-900`}>
            {toast.title}
          </Toast.Title>
          {toast.description && (
            <Toast.Description className={`mt-1 ${typography.caption} text-gray-600`}>
              {toast.description}
            </Toast.Description>
          )}
        </div>

        {/* Close button */}
        <Toast.Close
          className={`
            ${focus.ring} ${radius.sm} ${transitions.colors}
            flex-shrink-0 p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-700
          `}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Toast.Close>
      </div>
    </Toast.Root>
  );
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
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
        <Toast.Viewport className="fixed top-0 right-0 flex flex-col gap-2 w-96 max-w-full m-0 p-6 list-none z-50 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
