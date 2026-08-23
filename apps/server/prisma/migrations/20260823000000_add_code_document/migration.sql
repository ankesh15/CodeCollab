-- CreateTable
CREATE TABLE "code_documents" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'cpp',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_documents_roomId_key" ON "code_documents"("roomId");

-- CreateIndex
CREATE INDEX "code_documents_roomId_idx" ON "code_documents"("roomId");

-- AddForeignKey
ALTER TABLE "code_documents" ADD CONSTRAINT "code_documents_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
