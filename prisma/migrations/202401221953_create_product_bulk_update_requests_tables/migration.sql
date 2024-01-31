-- CreateTable
CREATE TABLE IF NOT EXISTS ShopProductCatalogBulkUpdateRequests (
    product_catalog_bulk_update_request_id varchar(255) not null,
    shop_id varchar(255) not null,
    start_time datetime not null,
    end_time datetime,
    error boolean default false,
    PRIMARY KEY (product_catalog_bulk_update_request_id),
    INDEX sort_by_start_time (start_time)
);

CREATE TABLE IF NOT EXISTS ShopProductDescriptionUpdates (
    product_description_update_id varchar(255) not null,
    product_id varchar(255) not null,
    shop_id varchar(255) not null,
    old_description text not null,
    new_description text not null,
    created_at datetime not null,
    PRIMARY KEY (product_description_update_id),
    INDEX sort_cols (shop_id, product_id, created_at)
);

-- A join table to link product image description updates to their
-- corresponding bulk update request initiated by the user.
CREATE TABLE IF NOT EXISTS ShopBulkUpdateRequestsDescriptionUpdates (
    product_catalog_bulk_update_request_id varchar(255) not null,
    product_description_update_id varchar(255) not null,
    created_at datetime not null,
    FOREIGN KEY ( product_catalog_bulk_update_request_id ) REFERENCES ShopProductCatalogBulkUpdateRequests( product_catalog_bulk_update_request_id ),
    FOREIGN KEY ( product_description_update_id ) REFERENCES ShopProductDescriptionUpdates( product_description_update_id ),
    INDEX sort_by_created_at (created_at)
);

