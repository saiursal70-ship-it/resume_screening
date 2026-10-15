type Size = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: Size;
  message?: string;
  fullScreen?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

export default function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-emerald-200 border-t-emerald-600 rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="text-sm font-medium text-gray-500 animate-pulse">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-xs">
        {spinner}
      </div>
    );
  }

  return spinner;
}