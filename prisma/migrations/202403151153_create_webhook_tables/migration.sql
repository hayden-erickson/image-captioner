-- CreateTable
CREATE TABLE IF NOT EXISTS ShopWebhookRequests (
    webhook_request_id varchar(255) not null,
    created_at datetime not null,
    error boolean default false,
    PRIMARY KEY (webhook_request_id),
    INDEX sort_by_created_at (created_at)
);

-- A join table to link product image description updates to their
-- corresponding webhook request initiated by shopify.
CREATE TABLE IF NOT EXISTS ShopWebhookRequestsDescriptionUpdates (
    webhook_request_id varchar(255) not null,
    product_description_update_id varchar(255) not null,
    created_at datetime not null,
    FOREIGN KEY ( webhook_request_id ) REFERENCES ShopWebhookRequests( webhook_request_id ),
    FOREIGN KEY ( product_description_update_id ) REFERENCES ShopProductDescriptionUpdates( product_description_update_id ),
    INDEX sort_by_created_at (created_at)
);

