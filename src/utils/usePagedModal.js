import { useState, useEffect } from 'react';

// Shared multi-page state + debounced auto-save for the IP/ESS generator
// modals (IPGeneratorModal, PDFGeneratorModal). Both modals paginate an array
// of form pages, load a saved draft once per project, and auto-save 1s after
// the last edit — this hook is the infrastructure they have in common; the
// page content/shape itself stays modal-specific via `createDefaultPage`.
/**
 * Firebase RTDB no tiene forma de guardar un array vacio: escribir `[]` BORRA
 * la clave. Una pagina generada sin cajones ni barrales se guarda como
 * `{ drawers: [], rods: [] }` y vuelve como `{}` — sin esas dos claves. Despues
 * `drawers.map(...)` en PDFPrintLayout revienta con "Cannot read properties of
 * undefined (reading 'map')" y se cae la vista entera.
 *
 * Se restauran como array VACIO, nunca desde createDefaultPage(): esas
 * plantillas traen filas de ejemplo (ver DEFAULT_DRAWERS en PDFGeneratorModal),
 * y rellenar con ellas resucitaria filas que el usuario borro a proposito —
 * indistinguible, desde el lado de Firebase, de una pagina que nunca las tuvo.
 *
 * Es el mismo tipo de compensacion que ya hacia el `Object.values` de abajo:
 * RTDB tampoco conserva un array como array cuando las claves no son
 * correlativas.
 *
 * @param {string[]} arrayFields - claves de la pagina que deben ser arrays.
 */
export const restoreEmptyArrays = (page, arrayFields = []) => {
  if (!page || arrayFields.length === 0) return page;
  let patched = page;
  for (const field of arrayFields) {
    if (!Array.isArray(patched[field])) {
      if (patched === page) patched = { ...page };
      patched[field] = [];
    }
  }
  return patched;
};

export function usePagedModal({ so, createDefaultPage, loadData, saveData, transformLoaded, arrayFields = [] }) {
  const [pages, setPages] = useState([createDefaultPage()]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load Initial Data — load-once-per-project effect. Deliberately keyed only
  // on `so` (not on createDefaultPage/loadData/transformLoaded) so a later
  // change to those inputs doesn't trigger an unwanted refetch.
  useEffect(() => {
    let isMounted = true;
    // Si loadData rechaza, isLoading tiene que apagarse igual: antes el
    // setIsLoading(false) vivia despues del await, asi que un rechazo dejaba
    // el modal clavado en "Loading..." sin error ni salida posible.
    const fetch = async () => {
      try {
        const data = await loadData(so);
        if (isMounted && data) {
          const parsed = Array.isArray(data) ? data : Object.values(data);
          const sanitized = parsed
            .filter(Boolean)
            .map(page => restoreEmptyArrays(page, arrayFields));
          if (sanitized.length > 0) {
            setPages(transformLoaded ? transformLoaded(sanitized) : sanitized);
          }
        }
      } catch (error) {
        console.error(`Failed to load saved draft for ${so}, starting from a blank page:`, error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetch();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [so]);

  // Auto-Save — debounced to avoid excessive Firebase writes
  useEffect(() => {
    if (isLoading) return; // Don't save on initial load

    const handler = setTimeout(() => {
      saveData(so, pages);
    }, 1000);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, so, isLoading]);

  const addPage = () => {
    setPages(prev => [...prev, createDefaultPage()]);
    setCurrentPageIndex(pages.length);
  };

  const removePage = (indexToRemove) => {
    if (pages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== indexToRemove);
    setPages(newPages);
    if (currentPageIndex >= newPages.length) {
      setCurrentPageIndex(newPages.length - 1);
    }
  };

  const updateCurrentPage = (updater) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      newPages[currentPageIndex] = updater(newPages[currentPageIndex]);
      return newPages;
    });
  };

  return {
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    isLoading,
    addPage,
    removePage,
    updateCurrentPage,
  };
}
