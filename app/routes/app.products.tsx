import { useEffect, useState } from 'react';

import {
  IndexTable,
  useIndexResourceState,
  useSetIndexFiltersMode,
  Text,
  Link,
  Thumbnail,
  TabProps,
  Badge,
  IndexFilters,
} from '@shopify/polaris';

import {
  useSearchParams,
} from '@remix-run/react'

import ProductReview from './app.products.review'
import { useProductsSubscription } from "~/socket/products";

import {
  Product,
  ProductWithAIAnnotation,
  strippedEqual
} from "../shopify.types"

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

type ProductRowProps = {
  product: ProductWithAIAnnotation;
  selected: boolean;
  index: number;
}

type ProductStatusBadgeProps = {
  description?: string;
  aiDescription?: string;
}

function ProductStatusBadge({ description, aiDescription }: ProductStatusBadgeProps) {
  if (aiDescription && !strippedEqual(description || '', aiDescription || '')) {
    return <Badge tone='info' progress='partiallyComplete'>Pending AI description</Badge>
  }

  if (!description && !aiDescription) {
    return <Badge progress='incomplete'>No Description</Badge>
  }

  if (description && !aiDescription) {
    return <Badge tone='warning' progress='partiallyComplete' >No AI Description</Badge>
  }

  return <Badge tone='success' progress='complete'>AI Description</Badge>
}

function ProductRow({
  product: {
    id,
    title,
    featuredImage,
    description,
    aiDescription,
  },
  selected,
  index
}: ProductRowProps) {
  return (
    <IndexTable.Row
      id={id}
      key={id}
      selected={selected}
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
        <ProductStatusBadge description={description} aiDescription={aiDescription} />
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}

function ProductsTable() {
  const {
    submit,
    load,
    isLoading,
    products,
  } = useProductsSubscription()

  const [queryValue, setQueryValue] = useState('')
  const [debounceTimeoutID, setDebounceTimeoutID] = useState(0)
  const [selectedTab, setSelectedTab] = useState(0)
  const { mode, setMode } = useSetIndexFiltersMode();
  const [urlParams, setURLParameters] = useSearchParams()

  // Debounce the product search.
  useEffect(() => {
    clearTimeout(debounceTimeoutID)

    const timeoutID = setTimeout(async () => load({
      q: queryValue
    }), 500)

    setDebounceTimeoutID((timeoutID as unknown) as number)
  }, [queryValue])


  const resourceName = {
    singular: 'product',
    plural: 'products',
  };

  const { selectedResources, handleSelectionChange, clearSelection } =
    useIndexResourceState(products?.nodes);

  const wipeTable = () => {
    setQueryValue('')
    clearSelection()
    setSelectedTab(0)
    load({})
  }

  const allProductsSelected =
    selectedTab === 0
    && selectedResources?.length === products?.nodes?.length

  const productMap = products?.nodes?.reduce((m: any, p: Product) => ({
    ...m,
    [p.id]: p,
  }), {})

  const productPendingAIDescription =
    ({ description, aiDescription }: ProductWithAIAnnotation) =>
      aiDescription
      && !strippedEqual(description, aiDescription)

  const selectedProducts: Product[] = selectedResources
    .map((id: string): ProductWithAIAnnotation => productMap[id])

  const productsPendingAIDescription = selectedProducts
    .filter((p: ProductWithAIAnnotation | undefined) => p)
    .filter(productPendingAIDescription)


  const beginReview = () => {
    setURLParameters((urlParams: URLSearchParams) => {
      urlParams.set('review', 'true')
      productsPendingAIDescription.forEach(
        ({ id }: ProductWithAIAnnotation) => urlParams.append('product', id))
      return urlParams
    })
    wipeTable()
  }


  let promotedBulkActions = [
    {
      content: 'Generate AI Descriptions',
      onAction: () => {
        submit({
          products: selectedProducts,
          action: 'generate',
          ...(allProductsSelected ? { allProductsSelected } : null)
        })
      },
    },
  ];

  if (productsPendingAIDescription?.length > 0) {
    promotedBulkActions.push({
      content: 'Review AI Descriptions',
      onAction: beginReview,
    }, {
      content: 'Approve All AI Descriptions',
      onAction: () =>
        submit({
          products: productsPendingAIDescription,
          action: 'approve',
        })
    })
  }

  const tabs: TabProps[] = tabFilters.map(({ id, title }, index) => ({
    content: title,
    index,
    onAction: () => load({ filter: id }),
    id: `${id}_${index}`,
    selected: selectedTab === index,
  }));

  return (
    <>
      <IndexFilters
        hideFilters
        loading={isLoading}
        disabled={isLoading}
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
        canCreateNewView={false}
        cancelAction={{
          onAction: wipeTable,
          disabled: false,
        }}
      />
      {
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
            onNext: () => {
              load({ after: products.pageInfo.endCursor })
              clearSelection()
            },
            hasPrevious: products?.pageInfo?.hasPreviousPage,
            onPrevious: () => {
              load({ before: products.pageInfo.startCursor })
              clearSelection()
            },
          }}
        >
          {
            products?.nodes?.map((product: ProductWithAIAnnotation, index: number) => (
              <ProductRow
                key={product.id}
                product={product}
                index={index}
                selected={selectedResources.includes(product.id)
                }
              />
            ))
          }
        </IndexTable >
      }
    </>
  )
}

export default function ProductsPage() {
  const [urlParams] = useSearchParams()
  const reviewInProgress = urlParams.get('review') === "true"

  return (
    <>
      {
        reviewInProgress ?
          (<ProductReview />) :
          (<ProductsTable />)
      }
    </>
  )
}
