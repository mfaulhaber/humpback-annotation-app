import type { LabelCategory } from "./labels.js";

export interface Folder {
  folderId: string;
  name: string;
  description: string;
  sampleCount: number;
  createdAt: string;
}

export interface SampleRef {
  sampleId: string;
  folderId: string;
  capturedAt: string;
  audioKey: string;
  spectrogramKey: string;
  durationSec: number;
  isActive: boolean;
}

export interface Sample extends SampleRef {
  sourceRecordingId: string;
}

export interface UserSampleLabel {
  userId: string;
  sampleId: string;
  folderId: string;
  labelCategory: LabelCategory;
  submittedAt: string;
  updatedAt: string;
}

export interface SampleAggregate {
  sampleId: string;
  totalLabels: number;
  countsByCategory: Partial<Record<LabelCategory, number>>;
  updatedAt: string;
}
