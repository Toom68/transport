import { Plane } from 'lucide-react';

export function GuestControlNotice() {
  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Plane className="w-4 h-4 text-theme-muted" />
        <span className="text-sm font-medium text-theme-primary">Simulation</span>
      </div>
      <div className="surface-soft rounded-lg p-3 text-center">
        <p className="text-xs text-theme-secondary leading-relaxed">
          The host is in control.
          <br />
          Talk to the host about pausing or speeding up the simulation.
        </p>
      </div>
    </div>
  );
}
