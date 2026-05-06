import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyBackupHealth, type BackupComponent } from "./backup-health";

const localOk: BackupComponent = {
  ageMinutes: 4,
  lastUpdated: "2026-05-06T03:30:00.000Z",
  message: "Latest local backup updated 4 minutes ago.",
  status: "ok",
};

describe("backup health classification", () => {
  test("requires local and offsite success for an ok overall backup", () => {
    const health = classifyBackupHealth({
      events: [{
        createdAt: "2026-05-06T03:31:00.000Z",
        message: "offsite backup sync completed",
        metadata: { classification: "offsite_sync_ok", offsite_status: "ok" },
        severity: "info",
        status: "offsite_sync_ok",
      }],
      localBackup: localOk,
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "ok");
    assert.equal(health.localBackup.status, "ok");
    assert.equal(health.offsiteBackup.status, "ok");
    assert.equal(health.overallBackup, "ok");
    assert.equal(health.local_backup, "ok");
    assert.equal(health.offsite_backup, "ok");
    assert.equal(health.overall_backup, "ok");
  });

  test("reports partial when local backup is fresh but the latest offsite event failed", () => {
    const health = classifyBackupHealth({
      events: [
        {
          createdAt: "2026-05-06T03:31:00.000Z",
          message: "backup partial: offsite sync failed",
          metadata: { classification: "backup_partial", offsite_status: "offsite_sync_failed" },
          severity: "error",
          status: "backup_partial",
        },
        {
          createdAt: "2026-05-06T03:00:00.000Z",
          message: "offsite backup sync completed",
          metadata: { classification: "offsite_sync_ok", offsite_status: "ok" },
          severity: "info",
          status: "offsite_sync_ok",
        },
      ],
      localBackup: localOk,
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "warn");
    assert.equal(health.offsiteBackup.status, "failed");
    assert.equal(health.overallBackup, "partial");
    assert.match(health.message, /Backup partial/);
  });

  test("does not treat local-only success as full backup success", () => {
    const health = classifyBackupHealth({
      events: [],
      localBackup: localOk,
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "warn");
    assert.equal(health.offsiteBackup.status, "unknown");
    assert.equal(health.overallBackup, "partial");
  });

  test("recognizes R2 backup success events and exposes provider metadata", () => {
    const health = classifyBackupHealth({
      events: [{
        createdAt: "2026-05-06T03:31:00.000Z",
        message: "R2 backup sync completed",
        metadata: { classification: "backup_r2_success", offsite_provider: "r2", offsite_status: "ok", provider: "r2" },
        severity: "info",
        status: "backup_r2_success",
      }],
      localBackup: localOk,
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "ok");
    assert.equal(health.offsiteBackup.status, "ok");
    assert.equal(health.offsiteProvider, "r2");
    assert.equal(health.latestSuccessfulOffsiteProvider, "r2");
    assert.match(health.offsiteBackup.message, /R2 offsite backup/);
  });

  test("reports partial when latest R2 backup event failed after an older success", () => {
    const health = classifyBackupHealth({
      events: [
        {
          createdAt: "2026-05-06T03:31:00.000Z",
          message: "R2 backup sync failed; local backup remains available",
          metadata: { classification: "backup_r2_failure", offsite_provider: "r2", offsite_status: "offsite_sync_failed" },
          severity: "error",
          status: "backup_r2_failure",
        },
        {
          createdAt: "2026-05-06T03:00:00.000Z",
          message: "R2 backup sync completed",
          metadata: { classification: "backup_r2_success", offsite_provider: "r2", offsite_status: "ok" },
          severity: "info",
          status: "backup_r2_success",
        },
      ],
      localBackup: localOk,
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "warn");
    assert.equal(health.offsiteBackup.status, "failed");
    assert.equal(health.overallBackup, "partial");
    assert.equal(health.activeBackupProvider, "r2");
  });

  test("fails overall when local backup freshness fails", () => {
    const health = classifyBackupHealth({
      events: [{
        createdAt: "2026-05-06T03:31:00.000Z",
        message: "offsite backup sync completed",
        metadata: { offsite_status: "ok" },
        severity: "info",
        status: "offsite_sync_ok",
      }],
      localBackup: { ...localOk, message: "Local backup stale.", status: "failed" },
      nowMs: Date.parse("2026-05-06T03:32:00.000Z"),
    });
    assert.equal(health.status, "failed");
    assert.equal(health.overallBackup, "failed");
  });
});
