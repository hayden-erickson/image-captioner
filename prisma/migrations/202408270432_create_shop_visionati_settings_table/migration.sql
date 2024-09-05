CREATE TABLE IF NOT EXISTS ShopVisionatiSettings (
  shop_id varchar(255) primary key,
  backend varchar(255),
  role varchar(255),
  custom_prompt varchar(2047),
  credits int
);

DROP TABLE IF EXISTS ShopVisionatiApiKeys;
