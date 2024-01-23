-- CreateTable
CREATE TABLE Session (
    id varchar(255) not null,
    shop text not null,
    state text not null,
    isOnline boolean not null default false,
    scope text,
    expires datetime,
    accessToken text not null,
    userId bigint,
    PRIMARY KEY (id)
);
