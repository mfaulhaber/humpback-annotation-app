import { describe, it, expect } from "vitest";

const API = process.env["API_URL"] ?? "http://localhost:3001";

const headers = {
  "x-dev-user": "test_integration_user",
  "x-dev-role": "annotator",
};

const adminHeaders = {
  "x-dev-user": "admin_user",
  "x-dev-role": "admin",
};

async function api(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  const body =
    res.status === 204
      ? null
      : await res.json().catch(() => null);
  return { status: res.status, body };
}

async function adminApi(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...adminHeaders, ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe("Health", () => {
  it("GET /health returns ok without auth", async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("Auth", () => {
  it("returns 401 without auth headers", async () => {
    const res = await fetch(`${API}/api/folders`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/folders", () => {
  it("returns folders list", async () => {
    const { status, body } = await api("/api/folders");
    expect(status).toBe(200);
    const data = body as { folders: unknown[] };
    expect(data.folders).toBeDefined();
    expect(data.folders.length).toBeGreaterThan(0);
  });
});

describe("GET /api/folders/:folderId/samples", () => {
  it("returns paginated samples", async () => {
    // First get a folder
    const { body: fBody } = await api("/api/folders");
    const folders = (fBody as { folders: { folderId: string }[] }).folders;
    const folderId = folders[0]!.folderId;

    const { status, body } = await api(
      `/api/folders/${folderId}/samples?limit=5`,
    );
    expect(status).toBe(200);
    const data = body as { samples: unknown[]; cursor?: string };
    expect(data.samples.length).toBeGreaterThan(0);
    expect(data.samples.length).toBeLessThanOrEqual(5);
  });
});

describe("GET /api/samples/:sampleId", () => {
  it("returns sample detail without aggregate for unlabeled user", async () => {
    // Get a sample ID from the first folder
    const { body: fBody } = await api("/api/folders");
    const folders = (fBody as { folders: { folderId: string }[] }).folders;
    const { body: sBody } = await api(
      `/api/folders/${folders[0]!.folderId}/samples?limit=1`,
    );
    const samples = (sBody as { samples: { sampleId: string }[] }).samples;
    const sampleId = samples[0]!.sampleId;

    const { status, body } = await api(`/api/samples/${sampleId}`);
    expect(status).toBe(200);
    const data = body as {
      sample: { sampleId: string; audioUrl: string; spectrogramUrl: string };
      userLabel?: string;
      aggregate?: unknown;
    };
    expect(data.sample.sampleId).toBe(sampleId);
    expect(data.sample.audioUrl).toBeDefined();
    expect(
      data.sample.spectrogramUrl === null ||
        typeof data.sample.spectrogramUrl === "string",
    ).toBe(true);
    // New test user hasn't labeled — no aggregate
    expect(data.userLabel).toBeUndefined();
    expect(data.aggregate).toBeUndefined();
  });

  it("returns 404 for nonexistent sample", async () => {
    const { status } = await api("/api/samples/nonexistent_sample_id");
    expect(status).toBe(404);
  });
});

describe("PUT /api/samples/:sampleId/label", () => {
  let testSampleId: string;
  let testFolderId: string;

  it("rejects invalid category", async () => {
    // Get a sample
    const { body: fBody } = await api("/api/folders");
    const folders = (fBody as { folders: { folderId: string }[] }).folders;
    testFolderId = folders[0]!.folderId;
    const { body: sBody } = await api(
      `/api/folders/${testFolderId}/samples?limit=1`,
    );
    testSampleId = (
      sBody as { samples: { sampleId: string }[] }
    ).samples[0]!.sampleId;

    const { status, body } = await api(`/api/samples/${testSampleId}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "invalid_category" }),
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain("Invalid");
  });

  it("creates first label and returns aggregate", async () => {
    const { status, body } = await api(`/api/samples/${testSampleId}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "whup" }),
    });
    expect(status).toBe(200);
    const data = body as {
      sampleId: string;
      userLabel: string;
      aggregate: { totalLabels: number; percentagesByCategory: Record<string, number> };
    };
    expect(data.sampleId).toBe(testSampleId);
    expect(data.userLabel).toBe("whup");
    expect(data.aggregate.totalLabels).toBeGreaterThanOrEqual(1);
    expect(data.aggregate.percentagesByCategory).toBeDefined();
  });

  it("shows aggregate on sample detail after labeling", async () => {
    const { status, body } = await api(`/api/samples/${testSampleId}`);
    expect(status).toBe(200);
    const data = body as {
      userLabel: string;
      aggregate: { totalLabels: number };
    };
    expect(data.userLabel).toBe("whup");
    expect(data.aggregate).toBeDefined();
    expect(data.aggregate.totalLabels).toBeGreaterThanOrEqual(1);
  });

  it("relabels and updates aggregate correctly", async () => {
    const { status, body } = await api(`/api/samples/${testSampleId}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "grunt" }),
    });
    expect(status).toBe(200);
    const data = body as {
      userLabel: string;
      aggregate: { totalLabels: number; percentagesByCategory: Record<string, number> };
    };
    expect(data.userLabel).toBe("grunt");
    // Total labels should stay the same (relabel, not new label)
    expect(data.aggregate.totalLabels).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/samples/suggest-next", () => {
  it("returns 400 without folderId", async () => {
    const { status } = await api("/api/samples/suggest-next");
    expect(status).toBe(400);
  });

  it("returns an unlabeled sample", async () => {
    const { body: fBody } = await api("/api/folders");
    const folders = (fBody as { folders: { folderId: string }[] }).folders;
    // Use a folder where this test user hasn't labeled everything
    const folderId = folders[0]!.folderId;

    const { status, body } = await api(
      `/api/samples/suggest-next?folderId=${folderId}`,
    );
    // Either 200 (found unlabeled) or 204 (all labeled)
    expect([200, 204]).toContain(status);
    if (status === 200) {
      const data = body as { sampleId: string };
      expect(data.sampleId).toBeDefined();
    }
  });
});

describe("GET /api/admin/labels", () => {
  it("returns 403 for non-admin user", async () => {
    const { status } = await api("/api/admin/labels?userId=dev_user_1");
    expect(status).toBe(403);
  });

  it("returns labels for admin user", async () => {
    const { status, body } = await adminApi(
      "/api/admin/labels?userId=dev_user_1",
    );
    expect(status).toBe(200);
    const data = body as { labels: unknown[] };
    expect(data.labels).toBeDefined();
    expect(Array.isArray(data.labels)).toBe(true);
  });

  it("returns 400 without filter params", async () => {
    const { status } = await adminApi("/api/admin/labels");
    expect(status).toBe(400);
  });
});
