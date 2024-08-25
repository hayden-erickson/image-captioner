import { LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
import type { Message } from "@google-cloud/pubsub";
import db from "./db.server";
import { getVisionatiImageDescriptions } from "./visionati";

type ShopifyProduct = {
  id: string;
  description: string;
  variants: {
    nodes: {
      id: string;
    }[];
  };
  featuredImage: {
    url: string;
  };
};

type UpdateProductInput = {
  id: string;
  descriptionHtml: string;
  // Including only the product variant ID prevents the
  // variant from being deleted on product update
  //variantNodes: { id: string }[];
};

export class ShopifyClient {
  shopDomain: string;
  accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`;
    this.accessToken = accessToken;
  }

  async graphql(query: string, variables: unknown) {
    const resp = await fetch(this.shopDomain, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!resp.ok) {
      throw new Error(resp.statusText)
    }

    return resp
  }

  async getProduct(productId: string): Promise<ShopifyProduct> {
    const resp = await this.graphql(
      `query GetProductFeaturedImage($productId: ID!) {
        product(id: $productId) {
          id
          description
          variants(first:10){
            nodes{
              id
            }
          }
          featuredImage {
            url
          }
        }
      }`,
      { productId },
    );

    const {
      data: { product },
    } = await resp.json();

    return product;
  }

  async updateProduct(input: UpdateProductInput) {
    await this.graphql(
      `mutation UpdateProduct($input:ProductInput!){
          productUpdate(input:$input) {
            userErrors{
              field
            }
            product{
              id
              title
              description
            }
          }
        }`,
      { input },
    );
  }
}

export function webhookMessageHandler(message: Message) {
  switch (message?.attributes["X-Shopify-Topic"]) {
    case "products/create":
      productCreateHandler(message)
        .then(() => message.ack())
        .catch((e) => {
          console.error(e);
          message.nack();
        });
      break;
    default:
      console.log(
        `Webhook topic ${message.attributes["X-Shopify-Topic"]} not handled.`,
      );
  }
}

export async function productCreateHandler(message: Message) {
  const data = JSON.parse(message.data.toString());

  if (!data?.admin_graphql_api_id) {
    return;
  }

  const webhookRequest = await db.shopWebhookRequests.findUnique({
    where: {
      webhook_request_id: message.id,
    },
  });

  // 1. Check if we've already handled this webhook b/c shopify can send duplicates
  //    - If yes, ack, message and terminate
  if (webhookRequest) {
    return;
  }

  // When a shop installs the app the user goes through the OAUTH flow. The app
  // frontend will receive a session token from app bridge and send it to the
  // backend. The backend will verify the JWT session token using the app's
  // client secret and the HS256 signiature. Once verified the app uses the
  // session token (shopify token exchange) to get an offline API access token
  // to use for authenticated requests to the shopify admin API. The access
  // token is valid for accessing shop data as long as the app is installed so
  // we can continue to use it here.
  const shop = message.attributes["X-Shopify-Shop-Domain"];
  const session = await db.session.findFirst({ where: { shop } });

  if (!session) {
    throw new Error(
      `Shop ${shop} has no session. Therefore, we cannot make requests to the shopify API`,
    );
  }

  const shopifyClient = new ShopifyClient(shop, session.accessToken);

  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique({
    where: {
      shop_id: session.shop,
    },
  });

  if (!shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key) {
    throw new Error(`Shop ${shop} has no visionati api key.`);
  }

  const visionatiApiKey = shopVisionatiApiKey?.visionati_api_key;
  const product = await shopifyClient.getProduct(data?.admin_graphql_api_id);

  if (!product?.featuredImage?.url) {
    return;
  }

  // Request image description from visionati
  //    - If fail, notify pubsub of failure for retry
  //    - Mark webhook request as failure
  //    - log error
  const descriptions = await getVisionatiImageDescriptions(visionatiApiKey, [
    product.featuredImage.url,
  ]);

  if (!descriptions || Object.keys(descriptions).length === 0) {
    return;
  }

  await shopifyClient.updateProduct({
    id: product.id,
    descriptionHtml: descriptions[product.featuredImage.url],
    //variantNodes: product.variants.nodes,
  });

  // === Everything is complete now log in the DB what happened. ===

  // Add webhook request to DB
  await db.shopWebhookRequests.create({
    data: {
      webhook_request_id: message.id,
      created_at: new Date(),
    },
  });

  const productDescUpdateId = crypto.randomUUID();

  // Create log in DB to track updated description
  await db.shopProductDescriptionUpdates.create({
    data: {
      shop_id: shop,
      created_at: new Date(),
      product_description_update_id: productDescUpdateId,
      product_id: product.id,
      new_description: descriptions[product.featuredImage.url],
      old_description: product.description,
    },
  });

  await db.shopWebhookRequestsDescriptionUpdates.create({
    data: {
      product_description_update_id: productDescUpdateId,
      created_at: new Date(),
      webhook_request_id: message.id,
    },
  });
}

/*
======= SHOPIFY WEBHOOK MESSAGE EXAMPLE ==========

{
  "admin_graphql_api_id":"gid:\/\/shopify\/Product\/7105568243777",
  "body_html":"checking with all the tuna pub subs",
  "created_at":"2024-03-15T11:28:40-04:00",
  "handle":"tuna-sub",
  "id":7105568243777,
  "product_type":"",
  "published_at":"2024-03-15T11:28:40-04:00",
  "template_suffix":"",
  "title":"tuna sub",
  "updated_at":"2024-03-15T11:28:43-04:00",
  "vendor":"Image Captioner Testing",
  "status":"active",
  "published_scope":"global",
  "tags":"",
  "variants":[
    {
      "admin_graphql_api_id":"gid:\/\/shopify\/ProductVariant\/40891137556545",
      "barcode":"",
      "compare_at_price":null,
      "created_at":"2024-03-15T11:28:41-04:00",
      "fulfillme
      nt_service":"manual",
      "id":40891137556545,
      "inventory_management":"shopify",
      "inventory_policy":"deny",
      "position":2,
      "price":"0.00",
      "product_id":7105568243777,
      "sku":"",
      "taxable":true,
      "title":"Default Title",
      "updated_at":"2024-03-15T11:28:41-04:00",
      "option1":"Default Title",
      "option2":null,
      "option3":null,
      "grams":0,
      "image_id":null,
      "weight":0.0,
      "weight_unit":"lb",
      "inventory_item_id":4298
      6360766529,
      "inventory_quantity":0,
      "old_inventory_quantity":0,
      "requires_shipping":true
    }
  ],
  "options":[
    {
      "name":"Title",
      "id" :9093361172545,
      "product_id":7105568243777,
      "position":1,
      "values":["Default Title"]
    }
  ],
  "images":[
    {
      "id":31992427151425,
      "product_id":7105568243777,
      "position":1,
      "created_at":"2024-03-15T11:28:40-04:00",
      "updated_at":"2024-03-15T11:28:43-04:00",
      "alt":null,
      "width":3024,
      "height":4032,
      "src":"https:\/\/cdn.shopify.com\/s\/files\/1\/0582\/6592\/7745\/files\/IMG_5894.heic?v=1710516523",
      "variant_ids":[],
      "admin_graphql_api_id":"gid:\/\/shopify\/ProductImage\/31992427151425"
    }
  ],
  "image":{
    "id":31992427151425,
    "product_id":7105568243777,
    "position":1,
    "created_at":"2024-03-15T11:28:40-04:00",
    "updated_at":"2024-03-15T11:28:43-04:00",
    "alt":null,
    "width":3024,
    "height":4032,
    "src":"https:\/\/cdn.shopify.com\/s\/files\/1\/0582\/6592\/7745\/files\/IMG_5894.heic?v=1710516523",
    "variant_ids":[],
    "admin_graphql_api_id":"gid:\/\/shopify\/ProductImage\/31992427151425"
  },
  "variant_ids":[{"id":40891137556545}]
}

*/