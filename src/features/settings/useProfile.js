import { createContext, useContext } from 'react'
import { DEFAULT_CURRENCY } from '../../domain/trades/vocabulary'

export const ProfileContext = createContext({ currency: DEFAULT_CURRENCY, startingBalance: null, loading: false, update: async () => {} })
/** Account currency and starting balance for formatting and analytics. */
export const useProfile = () => useContext(ProfileContext)
