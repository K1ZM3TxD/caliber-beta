-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "surfaceKey" TEXT,
    "jobId" TEXT,
    "jobTitle" TEXT,
    "company" TEXT,
    "jobUrl" TEXT,
    "score" REAL,
    "source" TEXT,
    "meta" TEXT
);

-- CreateIndex
CREATE INDEX "TelemetryEvent_sessionId_idx" ON "TelemetryEvent"("sessionId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_event_idx" ON "TelemetryEvent"("event");

-- CreateIndex
CREATE INDEX "TelemetryEvent_sessionId_event_idx" ON "TelemetryEvent"("sessionId", "event");
