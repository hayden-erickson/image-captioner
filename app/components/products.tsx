import { useEffect, useState } from 'react';

import {
  IndexTable,
  useIndexResourceState,
  useSetIndexFiltersMode,
  Text,
  Thumbnail,
  TabProps,
  Badge,
  IndexFilters,
} from '@shopify/polaris';

import {
  useFetcher,
  useSearchParams,
} from '@remix-run/react'


import {
  Product,
  ProductConnectionWithAIAnnotation,
  ProductWithAIAnnotation,
} from "../shopify.types"

import ProductReview from './products.review'

import { URLSearchParams } from 'url';

export type TabFilterKey =
  'all_products' |
  'products_no_ai_descriptions' |
  'products_pending_ai_descriptions' |
  'products_ai_descriptions'

type TabFilter = {
  id: TabFilterKey,
  title: string,
}

const tabFilters: TabFilter[] = [
  { id: 'all_products', title: 'All' },
  { id: 'products_no_ai_descriptions', title: 'No AI Descriptions' },
  { id: 'products_pending_ai_descriptions', title: 'Pending AI Descriptions' },
  { id: 'products_ai_descriptions', title: 'AI Descriptions' },
];

const strippedEqual = (a: string, b: string): boolean =>
  a.replace(/\s/g, '') === b.replace(/\s/g, '')

export default function Products() {
  const fetcher = useFetcher<ProductConnectionWithAIAnnotation>();
  const isLoading = fetcher.state !== "idle"
  const [products, setProducts] = useState({} as ProductConnectionWithAIAnnotation)
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const [queryValue, setQueryValue] = useState('')
  const [debounceTimeoutID, setDebounceTimeoutID] = useState(0)
  const [selectedTab, setSelectedTab] = useState(0)
  const { mode, setMode } = useSetIndexFiltersMode();
  const [urlParams, setURLParameters] = useSearchParams()
  const reviewInProgress = urlParams.get('review') === "true"

  useEffect(() => {
    if (isLoading) {
      return
    }

    // We're not loading.
    if (fetcher.data) {
      setProducts(fetcher?.data)
      return
    }

    // There is no fetcher data.
    if (fetcherAlreadyLoaded) {
      return
    }

    // The fetcher has not yet loaded.
    const loadData = async () => {
      fetcher.load("/settings/products")
      // Set loaded to true so that this effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher, isLoading, fetcherAlreadyLoaded]);

  // Debounce the product search.
  useEffect(() => {
    clearTimeout(debounceTimeoutID)

    const timeoutID = setTimeout(async () => {
      fetcher.load(`/settings/products?q=${queryValue}`)
    }, 500)

    setDebounceTimeoutID((timeoutID as unknown) as number)
  }, [queryValue])


  const resourceName = {
    singular: 'product',
    plural: 'products',
  };

  const { selectedResources, handleSelectionChange, clearSelection } =
    useIndexResourceState(products.nodes);

  const wipeTable = () => {
    setQueryValue('')
    clearSelection()
    setSelectedTab(0)
    fetcher.load('/settings/products')
  }

  const allProductsSelected = selectedTab === 0 && selectedResources?.length === products?.nodes?.length

  const productMap = products?.nodes?.reduce((m: any, p: Product) => ({
    ...m,
    [p.id]: p,
  }), {})

  const rowMarkup = products?.nodes?.map(
    ({
      id,
      title,
      featuredImage,
      description,
      aiDescription
    }: ProductWithAIAnnotation,
      index: number
    ) =>
    (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Thumbnail source={featuredImage?.url} alt={title} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {
            !description && !aiDescription ?
              <Badge progress='incomplete'>No Description</Badge>
              : !aiDescription ?
                <Badge tone='warning' progress='partiallyComplete' >No AI Description</Badge>
                : !strippedEqual(description, aiDescription) ?
                  <Badge tone='info' progress='partiallyComplete'>Pending AI description</Badge>
                  : <Badge tone='success' progress='complete'>AI Description</Badge>
          }
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const productPendingAIDescription =
    ({ description, aiDescription }: ProductWithAIAnnotation) => aiDescription && !strippedEqual(description, aiDescription)

  const selectedProducts: Product[] = selectedResources.map((id: string): ProductWithAIAnnotation => productMap[id])

  const productsPendingAIDescription = selectedProducts
    .filter((p: ProductWithAIAnnotation | undefined) => p)
    .filter(productPendingAIDescription)

  const setReviewInProgressWithURL = (inProgress: boolean) => {
    if (inProgress) {
      setURLParameters((urlParams: URLSearchParams) => {
        urlParams.set('review', 'true')
        productsPendingAIDescription.forEach(
          ({ id }: ProductWithAIAnnotation) => urlParams.append('product', id))
        return urlParams
      })
      return
    }
    setURLParameters((urlParams: URLSearchParams) => {
      urlParams.delete('review')
      urlParams.delete('product')
      return urlParams
    })
    wipeTable()
  }

  let promotedBulkActions = [
    {
      content: 'Generate AI Descriptions',
      onAction: () => {
        fetcher.submit({
          products: selectedProducts,
          action: 'generate',
          ...(allProductsSelected ? { allProductsSelected } : null)
        }, {
          method: "POST",
          action: "/settings/products",
          encType: "application/json",
        })
      },
    },
  ];

  if (productsPendingAIDescription?.length > 0) {
    promotedBulkActions.push({
      content: 'Review AI Descriptions',
      onAction: () => setReviewInProgressWithURL(true),
    }, {
      content: 'Approve All AI Descriptions',
      onAction: () =>
        fetcher.submit({
          products: productsPendingAIDescription,
          action: 'approve',
        }, {
          method: "POST",
          action: "/settings/products",
          encType: "application/json",
        })
    })
  }

  const tabs: TabProps[] = tabFilters.map(({ id, title }, index) => ({
    content: title,
    index,
    onAction: () => fetcher.load(`/settings/products?filter=${id}`),
    id: `${id}_${index}`,
    selected: selectedTab === index,
  }));

  return reviewInProgress ?
    (
      <ProductReview
        setReviewInProgress={setReviewInProgressWithURL} />
    ) : (
      <>
        <IndexFilters
          queryValue={queryValue}
          queryPlaceholder="Searching all products"
          onQueryChange={setQueryValue}
          onQueryClear={wipeTable}
          tabs={tabs}
          selected={selectedTab}
          onSelect={setSelectedTab}
          filters={[]}
          appliedFilters={[]}
          onClearAll={wipeTable}
          mode={mode}
          setMode={setMode}
          cancelAction={{
            onAction: wipeTable,
            disabled: false,
            loading: isLoading,
          }}
        />
        {!fetcherAlreadyLoaded ? null : (
          <IndexTable
            loading={isLoading}
            resourceName={resourceName}
            itemCount={products?.nodes?.length || 0}
            selectedItemsCount={
              allProductsSelected ? 'All' : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            headings={
              [
                { title: 'Product' },
                { title: 'Title' },
                { title: 'Status' },
              ]}
            promotedBulkActions={promotedBulkActions}
            pagination={{
              hasNext: products?.pageInfo?.hasNextPage,
              onNext: () => fetcher.load(`/settings/products?after=${products.pageInfo.endCursor}`),
              hasPrevious: products?.pageInfo?.hasPreviousPage,
              onPrevious: () => fetcher.load(`/settings/products?before=${products.pageInfo.startCursor}`),
            }}
          >
            {rowMarkup}
          </IndexTable >
        )}
      </>
    );
}
