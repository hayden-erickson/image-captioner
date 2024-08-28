import {
  useState,
  useEffect,
} from 'react'

import {
  BlockStack,
  TextField,
  Text,
  Button,
  Pagination,
  Thumbnail,
  Spinner,
  InlineStack,
  Icon,
} from "@shopify/polaris";

import {
  ArrowLeftIcon,
  MagicIcon,
} from '@shopify/polaris-icons';


import {
  useSearchParams,
  useFetcher,
} from '@remix-run/react'

import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  TypedResponse,
} from "@remix-run/node";

import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";

import {
  getProduct,
  ProductWithAIAnnotation,
  getAIProductDescriptions,
  updateProduct,
} from '../shopify'

export const action = async ({ request }: ActionFunctionArgs): Promise<TypedResponse<ProductWithAIAnnotation>> => {
  const { admin } = await authenticate.admin(request);
  const { product } = await request.json()

  await updateProduct(admin, product.id, product.aiDescription)

  return json(product)
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<TypedResponse<ProductWithAIAnnotation>> => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("product") || "";
  if (!productId) {
    return json({} as ProductWithAIAnnotation)
  }

  const product = await getProduct(admin, productId)
  const aiDescriptions = await getAIProductDescriptions(productId, 1)

  return json({
    ...product,
    aiDescription: aiDescriptions?.length > 0 ? aiDescriptions[0].new_description : '',
  })
}

type ProductReviewProps = {
  productId: string;
  onReviewComplete: () => void;
  onExitProductReview: () => void;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function ProductReview({
  productId,
  onReviewComplete,
  onExitProductReview,
}: ProductReviewProps) {
  const productReview = useFetcher<typeof loader>();
  const isLoading = productReview.state !== 'idle'

  const [product, setProduct] = useState({} as ProductWithAIAnnotation)
  const [userDescription, setUserDescription] = useState('')

  const loadData = async () => {
    const loadParams = new URLSearchParams()
    loadParams.set('product', productId)
    productReview.load(`/settings/products/review?${loadParams.toString()}`)
    setUserDescription('')
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (productReview.data && productReview.data.id !== product.id) {
      setProduct(productReview.data)
      return
    }

    if (productId === product.id) {
      return
    }

    loadData()
  }, [productReview.data, isLoading, productId]);

  const saveAIDescription = async () => {
    productReview.submit({ product }, {
      method: "POST",
      action: "/settings/products/review",
      encType: "application/json",
    })

    // This waits for the submit to complete so that if there's
    // only one product in the queue, the request gets a chance
    // to finish before the component is removed which will
    // cause the request to be canceled prematurely.
    let state = productReview.state
    while (state !== 'idle') {
      sleep(500)
      state = productReview.state
    }

    onReviewComplete()
  }

  return (
    <>
      <InlineStack wrap={false} gap="200" >
        <Button
          variant='tertiary'
          onClick={onExitProductReview}
          icon={ArrowLeftIcon} />
        <Text as="h1" variant="headingLg">
          {product.title}
        </Text>
      </InlineStack>

      {
        isLoading ? <Spinner /> : <Thumbnail
          source={product?.featuredImage?.url}
          size="large"
          alt={product.title} />
      }

      <TextField label="Description"
        multiline
        disabled={true}
        value={product.description}
        onChange={() => { }}
        autoComplete="off" />

      <TextField label={(
        <InlineStack>
          <Icon source={MagicIcon} />
          AI Description
        </InlineStack>
      )}
        multiline
        disabled={isLoading}
        value={userDescription || product.aiDescription}
        onChange={setUserDescription}
        autoComplete="off" />

      <InlineStack gap='200' align='start'>
        {
          userDescription && userDescription !== product.aiDescription ?
            <Button
              onClick={() =>
                setUserDescription(product.aiDescription || '')}>
              Undo
            </Button>
            : null
        }
        <Button
          variant='primary'
          onClick={saveAIDescription}>
          Save
        </Button>
      </InlineStack>
    </>
  )
}

export default function({
  setReviewInProgress,
}: { setReviewInProgress: (p: boolean) => void }) {
  const [selectedProduct, setSelectedProduct] = useState(0)
  const [urlParams, setUrlParams] = useSearchParams()

  const productIds = urlParams.getAll('product')
  const numProducts = productIds?.length
  const selectedProductId = productIds[selectedProduct]

  const removeProductFromQueue = () => {
    let newProductIds = productIds.slice(0, selectedProduct)

    if (selectedProduct < numProducts - 1) {
      newProductIds = newProductIds.concat(productIds.slice(selectedProduct + 1))
    }

    let newParams = new URLSearchParams()
    newParams.set('review', 'true')
    newProductIds.forEach((id: string) => newParams.append('product', id))

    setUrlParams(newParams)

    if (selectedProduct >= newProductIds?.length) {
      setSelectedProduct(0)
    }
  }

  return (
    <BlockStack gap="400" >
      {
        numProducts <= 0 ? (
          <InlineStack wrap={false} gap="200" >
            <Button
              variant='tertiary'
              onClick={() => setReviewInProgress(false)}
              icon={ArrowLeftIcon} />
            <Text as="h1" variant="headingLg">No products to review</Text>
          </InlineStack>
        ) : (
          <ProductReview
            productId={selectedProductId}
            onExitProductReview={() => setReviewInProgress(false)}
            onReviewComplete={removeProductFromQueue}
          />
        )
      }

      {numProducts <= 1 ? null :
        <Pagination
          onPrevious={() => {
            const newSelection = selectedProduct <= 0 ? 0 : selectedProduct - 1
            setSelectedProduct(newSelection)
          }}
          onNext={() => {
            const newSelection = selectedProduct >= numProducts ? numProducts - 1 : selectedProduct + 1
            setSelectedProduct(newSelection)
          }}
          hasNext={selectedProduct < numProducts - 1}
          hasPrevious={selectedProduct > 0}
          label={`${selectedProduct + 1} / ${numProducts} products`}
          type="table"
        />
      }

    </BlockStack>
  )
}
