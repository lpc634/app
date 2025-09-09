import { createContext, useContext, useMemo, useState, useCallback } from "react";

const PageHeaderContext = createContext({
  title: "",
  action: null,
  setTitle: () => {},
  setAction: () => {},
});

export function PageHeaderProvider({ children }) {
  const [title, setTitle] = useState("");
  const [action, setAction] = useState(null);

  const value = useMemo(() => ({ title, action, setTitle, setAction }), [title, action]);
  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  const register = useCallback(({ title, action }) => {
    if (typeof title !== 'undefined') ctx.setTitle(title);
    if (typeof action !== 'undefined') ctx.setAction(action);
  }, [ctx]);
  return {
    title: ctx.title,
    action: ctx.action,
    setTitle: ctx.setTitle,
    setAction: ctx.setAction,
    register,
  };
}

export function usePageHeaderState() {
  // Internal hook for layout to read current header state (safe outside provider)
  const ctx = useContext(PageHeaderContext);
  return ctx;
}


