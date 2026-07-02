-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "fullAudioUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "waveform" TEXT NOT NULL,
    "startingPriceCents" INTEGER NOT NULL,
    "currentPriceCents" INTEGER NOT NULL,
    "buyNowPriceCents" INTEGER,
    "minIncrementCents" INTEGER NOT NULL DEFAULT 100,
    "antiSnipeSeconds" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'live',
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerId" TEXT NOT NULL,
    "winnerId" TEXT,
    CONSTRAINT "Sample_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sample_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sample" ("antiSnipeSeconds", "bpm", "buyNowPriceCents", "createdAt", "currentPriceCents", "description", "endTime", "fullAudioUrl", "genre", "id", "imageUrl", "key", "minIncrementCents", "previewUrl", "sellerId", "startTime", "startingPriceCents", "status", "title", "waveform", "winnerId") SELECT "antiSnipeSeconds", "bpm", "buyNowPriceCents", "createdAt", "currentPriceCents", "description", "endTime", "fullAudioUrl", "genre", "id", "imageUrl", "key", "minIncrementCents", "previewUrl", "sellerId", "startTime", "startingPriceCents", "status", "title", "waveform", "winnerId" FROM "Sample";
DROP TABLE "Sample";
ALTER TABLE "new_Sample" RENAME TO "Sample";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill existing rows still on the old $5.00 flat increment to the new $1.00 default.
UPDATE "Sample" SET "minIncrementCents" = 100 WHERE "minIncrementCents" = 500;
