// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Navbar from '../Navbar';
import { LanguageProvider } from '../../utils/LanguageContext';
import { ThemeProvider } from '../../utils/ThemeContext';
import { DESIGNER_PERFORMANCE_ENABLED } from '../../utils/featureFlags';

// Designer Performance esta en pausa (ver featureFlags.js): ningun rol lo ve.
describe.skipIf(DESIGNER_PERFORMANCE_ENABLED)('Navbar — Designer Performance en pausa', () => {
  it.each(['designer', 'engineer', 'administrative', 'engineer-admin'])('no muestra la pestaña al rol %s', (role) => {
    render(
      <LanguageProvider>
        <ThemeProvider>
          <Navbar activeTab="dashboard" setActiveTab={() => {}} userProfile={{ role, designerName: 'X' }} isSuperAdmin={role === 'engineer-admin'} pendingUsersCount={0} />
        </ThemeProvider>
      </LanguageProvider>
    );
    expect(screen.queryByText(/designer perf/i)).toBeNull();
    expect(screen.getAllByText(/calendar|calendario/i).length).toBeGreaterThan(0);
    cleanup();
  });
});
