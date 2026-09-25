import React from 'react';

export type SystemStatusType =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILED'
  | 'REPAIRING'
  | 'VERIFYING'
  | 'OFFLINE'
  | 'UNHEALTHY'
  | 'ACTIVE'
  | 'ONLINE';

interface StatusDotProps {
  status: SystemStatusType | string;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  showLabel = true,
  size = 'md',
  className = ''
}) => {
  const normalized = status.toUpperCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case 'HEALTHY':
      case 'ONLINE':
      case 'ACTIVE':
        return {
          dotClass: 'bg-emerald-400',
          textClass: 'text-emerald-400',
          defaultLabel: 'Healthy'
        };
      case 'DEGRADED':
        return {
          dotClass: 'bg-amber-400',
          textClass: 'text-amber-400',
          defaultLabel: 'Degraded'
        };
      case 'FAILED':
      case 'CORRUPTED':
      case 'UNHEALTHY':
        return {
          dotClass: 'bg-rose-500',
          textClass: 'text-rose-400',
          defaultLabel: normalized === 'CORRUPTED' ? 'Corrupted' : 'Failed'
        };
      case 'REPAIRING':
      case 'SYNCING':
        return {
          dotClass: 'bg-cyan-400',
          textClass: 'text-cyan-400',
          defaultLabel: 'Repairing'
        };
      case 'VERIFYING':
        return {
          dotClass: 'bg-cyan-400',
          textClass: 'text-cyan-400',
          defaultLabel: 'Verifying'
        };
      case 'OFFLINE':
      case 'UNAVAILABLE':
      default:
        return {
          dotClass: 'bg-zinc-500',
          textClass: 'text-zinc-400',
          defaultLabel: 'Offline'
        };
    }
  };

  const { dotClass, textClass, defaultLabel } = getStatusConfig();
  const displayLabel = label || defaultLabel;

  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex items-center justify-center">
        <span
          className={`inline-block rounded-full ${sizeClasses[size]} ${dotClass}`}
        />
      </span>
      {showLabel && (
        <span className={`text-xs font-medium tracking-wide ${textClass}`}>
          {displayLabel}
        </span>
      )}
    </span>
  );
};
