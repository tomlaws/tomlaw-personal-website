import { fullpageApi } from '@fullpage/react-fullpage';
import React, { useContext, useState } from 'react'

const FullPageContext = React.createContext<{ api: fullpageApi }>({ api: null } as any);

export function FullPageProvider({ api, children }: { api: fullpageApi, children: React.ReactNode }) {
  return (
    <FullPageContext.Provider value={{ api }}>
      {children}
    </FullPageContext.Provider>
  )
}

export const useFullPage = () => {
  const fullpage = useContext(FullPageContext);
  return fullpage;
};