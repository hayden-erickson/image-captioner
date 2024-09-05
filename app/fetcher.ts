import {
  useEffect,
  useState,
} from 'react'

import {
  useFetcher,
} from '@remix-run/react'
import { URLSearchParams } from 'url';

type RoutedFetcher<T> = {
  submit: (body: any, method: any) => void;
  load: (params?: URLSearchParams) => void;
  isLoading: boolean;
  data: T;
}

export function useRoutedFetcher<T>(route: string): RoutedFetcher<T> {
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const [data, setData] = useState(null as T)
  const fetcher = useFetcher<T>();
  const isLoading = fetcher.state !== 'idle'

  useEffect(() => {
    if (isLoading) {
      return
    }

    // We're not loading.
    if (fetcher.data) {
      setData(fetcher?.data as T)
      return
    }

    // There is no fetcher data.
    // This is only needed if the fetcher loads, but returns nothing
    // (ie. fetcher.data is falsey).
    if (fetcherAlreadyLoaded) {
      return
    }

    // The fetcher has not yet loaded.
    const loadData = async () => {
      fetcher.load(route)
      // Set loaded to true so that this effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher.state]);

  const submit = (body: any, method: any = "POST") => fetcher.submit(body, {
    method,
    action: route,
    encType: "application/json",
  })

  const load = (params?: URLSearchParams) =>
    fetcher.load(`${route}?${params?.toString()}`)

  return { submit, load, data, isLoading }
}
