import type { LabelCategory } from "./labels.js";

// --- Catalog table items ---

export interface FolderItem {
  pk: string; // FOLDER#{folder_id}
  sk: "META";
  gsi1pk: "Folder";
  gsi1sk: string; // FOLDER#{folder_id}
  entity: "Folder";
  folder_id: string;
  name: string;
  description: string;
  sample_count: number;
  created_at: string;
}

export interface SampleRefItem {
  pk: string; // FOLDER#{folder_id}
  sk: string; // SAMPLE#{timestamp}#{sample_id}
  entity: "SampleRef";
  sample_id: string;
  captured_at: string;
  audio_key: string;
  spectrogram_key: string | null;
  duration_sec: number;
  is_active: boolean;
}

export interface SampleDetailItem {
  pk: string; // SAMPLE#{sample_id}
  sk: "META";
  entity: "Sample";
  sample_id: string;
  folder_id: string;
  source_recording_id: string;
  captured_at: string;
  audio_key: string;
  spectrogram_key: string | null;
  duration_sec: number;
  is_active: boolean;
}

// --- Labels table items ---

export interface UserSampleLabelItem {
  pk: string; // USER#{user_id}
  sk: string; // LABEL#{sample_id}
  gsi1pk: string; // SAMPLE#{sample_id}
  gsi1sk: string; // USER#{user_id}
  gsi2pk: string; // FOLDER#{folder_id}
  gsi2sk: string; // {updated_at}#USER#{user_id}#SAMPLE#{sample_id}
  entity: "UserSampleLabel";
  user_id: string;
  sample_id: string;
  folder_id: string;
  label_category: LabelCategory;
  submitted_at: string;
  updated_at: string;
}

export interface SampleAggregateItem {
  pk: string; // SAMPLE#{sample_id}
  sk: "AGGREGATE";
  entity: "SampleAggregate";
  sample_id: string;
  total_labels: number;
  counts_by_category: Partial<Record<LabelCategory, number>>;
  updated_at: string;
}

// --- Key builders ---

export const CatalogKeys = {
  folderPk: (folderId: string) => `FOLDER#${folderId}`,
  folderSk: () => "META" as const,
  sampleRefSk: (capturedAt: string, sampleId: string) =>
    `SAMPLE#${capturedAt}#${sampleId}`,
  sampleDetailPk: (sampleId: string) => `SAMPLE#${sampleId}`,
  sampleDetailSk: () => "META" as const,
} as const;

export const LabelsKeys = {
  userPk: (userId: string) => `USER#${userId}`,
  labelSk: (sampleId: string) => `LABEL#${sampleId}`,
  sampleGsi1Pk: (sampleId: string) => `SAMPLE#${sampleId}`,
  userGsi1Sk: (userId: string) => `USER#${userId}`,
  folderGsi2Pk: (folderId: string) => `FOLDER#${folderId}`,
  gsi2Sk: (updatedAt: string, userId: string, sampleId: string) =>
    `${updatedAt}#USER#${userId}#SAMPLE#${sampleId}`,
  aggregatePk: (sampleId: string) => `SAMPLE#${sampleId}`,
  aggregateSk: () => "AGGREGATE" as const,
} as const;
