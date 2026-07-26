import { useState, useEffect } from 'react';
import { fetchCompanyTimezone } from '../services/reports';

// The yard's legal timezone (company_settings.timezone) for "today"/day-boundary
// math on screens that summarize a business day (Dashboard, Close Day). Returns
// '' until loaded; the timezone helpers treat '' as "fall back to device zone",
// so a screen renders with local time first, then corrects once this resolves.
export function useCompanyTimezone(): string {
  const [tz, setTz] = useState('');
  useEffect(() => {
    let active = true;
    fetchCompanyTimezone()
      .then((t) => {
        if (active) setTz(t);
      })
      .catch(() => {
        /* keep '' → device-zone fallback */
      });
    return () => {
      active = false;
    };
  }, []);
  return tz;
}
