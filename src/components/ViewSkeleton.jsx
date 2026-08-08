import React from 'react';
import SkeletonLoader from './SkeletonLoader';

/**
 * Placeholder a nivel de pagina. Reemplaza al spinner centrado de una linea
 * ("Loading application...") que no daba ninguna pista de que estaba por
 * aparecer: la pagina saltaba de un renglon de texto al layout completo.
 * Mismo lenguaje visual que el skeleton que DashboardView ya usaba cuando
 * todavia no tiene `data`.
 *
 * Se usa en dos lugares: mientras se resuelve el fetch/auth inicial y como
 * fallback del <Suspense> que envuelve a las vistas cargadas con React.lazy.
 */
export default function ViewSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true">
      <header className="view-header">
        <SkeletonLoader type="text" width="250px" height="32px" />
        <SkeletonLoader type="text" width="180px" height="20px" className="mt-sm" />
      </header>
      <SkeletonLoader type="card" count={6} />
    </div>
  );
}
