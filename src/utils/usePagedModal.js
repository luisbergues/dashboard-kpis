import { useState, useEffect } from 'react';

// Shared multi-page state + debounced auto-save for the IP/ESS generator
// modals (IPGeneratorModal, PDFGeneratorModal). Both modals paginate an array
// of form pages, load a saved draft once per project, and auto-save 1s after
// the last edit — this hook is the infrastructure they have in common; the
// page content/shape itself stays modal-specific via `createDefaultPage`.
export function usePagedModal({ so, createDefaultPage, loadData, saveData, transformLoaded }) {
  const [pages, setPages] = useState([createDefaultPage()]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load Initial Data — load-once-per-project effect. Deliberately keyed only
  // on `so` (not on createDefaultPage/loadData/transformLoaded) so a later
  // change to those inputs doesn't trigger an unwanted refetch.
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      const data = await loadData(so);
      if (isMounted) {
        if (data) {
          const parsed = Array.isArray(data) ? data : Object.values(data);
          const sanitized = parsed.filter(Boolean);
          if (sanitized.length > 0) {
            setPages(transformLoaded ? transformLoaded(sanitized) : sanitized);
          }
        }
        setIsLoading(false);
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
