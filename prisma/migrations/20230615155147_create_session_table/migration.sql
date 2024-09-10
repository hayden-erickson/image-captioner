CREATE TABLE IF NOT EXISTS Session (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    shop VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    isOnline BOOLEAN NOT NULL DEFAULT false,
    scope VARCHAR(255),
    expires DATETIME,
    accessToken VARCHAR(255) NOT NULL,
    userId BIGINT,
    firstName VARCHAR(255),
    lastName VARCHAR(255),
    email VARCHAR(255),
    accountOwner BOOLEAN NOT NULL DEFAULT false,
    locale VARCHAR(255),
    collaborator BOOLEAN DEFAULT false,
    emailVerified BOOLEAN DEFAULT false
);

