import type { Folder, Sample, SampleAggregate, SampleRef } from "./entities.js";
import type { LabelCategory } from "./labels.js";

// --- Catalog ---

export interface ListFoldersResponse {
  folders: Folder[];
  cursor?: string;
}

export interface ListSamplesResponse {
  samples: (SampleRef & { isLabeledByUser?: boolean })[];
  cursor?: string;
}

export interface GetSampleResponse {
  sample: Sample & {
    audioUrl: string;
    spectrogramUrl: string;
  };
  userLabel?: LabelCategory;
  aggregate?: {
    totalLabels: number;
    percentagesByCategory: Record<string, number>;
  };
}

// --- Annotation ---

export interface SubmitLabelRequest {
  category: LabelCategory;
}

export interface SubmitLabelResponse {
  sampleId: string;
  userLabel: LabelCategory;
  aggregate: {
    totalLabels: number;
    percentagesByCategory: Record<string, number>;
  };
}

// --- Suggestion ---

export interface SuggestNextResponse {
  sampleId: string;
}

// --- Admin ---

export interface AdminLabelsResponse {
  labels: {
    userId: string;
    sampleId: string;
    folderId: string;
    labelCategory: LabelCategory;
    submittedAt: string;
    updatedAt: string;
  }[];
  cursor?: string;
}
