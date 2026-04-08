#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.deploy"

DEFAULT_REGION="us-west-2"
DEFAULT_STACK_NAME="humpback-static-viewer"
DEFAULT_JSON_WORKERS=4
DEFAULT_PNG_WORKERS=64
DEFAULT_MP3_WORKERS=8
DEFAULT_RETRY_COUNT=20
DEFAULT_MAX_ATTEMPTS=4
DEFAULT_PROGRESS_SECONDS=10

AWS_REGION=""
STACK_NAME=""
EXPORT_ROOT=""
DATA_BUCKET=""
DISTRIBUTION_ID=""

JSON_WORKERS="$DEFAULT_JSON_WORKERS"
PNG_WORKERS="$DEFAULT_PNG_WORKERS"
MP3_WORKERS="$DEFAULT_MP3_WORKERS"
RETRY_COUNT="$DEFAULT_RETRY_COUNT"
MAX_ATTEMPTS="$DEFAULT_MAX_ATTEMPTS"
PROGRESS_SECONDS="$DEFAULT_PROGRESS_SECONDS"
DRY_RUN=0
INVALIDATE=1

usage() {
  cat <<'EOF'
Usage: scripts/upload-missing-to-s3.sh [options]

Upload only missing timeline export objects from a local export root to the
viewer data bucket. This script uses `s5cmd` for uploads and `aws` for stack
lookup and invalidation.

Options:
  --path PATH              Local export root. Defaults to TIMELINE_EXPORT_ROOT.
  --bucket NAME            S3 bucket name. Defaults to STATIC_VIEWER_DATA_BUCKET_NAME
                           or resolves from the CloudFormation stack.
  --distribution-id ID     CloudFront distribution ID for invalidation.
                           Defaults to STATIC_VIEWER_DISTRIBUTION_ID or resolves
                           from the CloudFormation stack.
  --region REGION          AWS region. Defaults to AWS_REGION or us-west-2.
  --stack-name NAME        CloudFormation stack name. Defaults to
                           STATIC_VIEWER_STACK_NAME or humpback-static-viewer.
  --json-workers N         Worker count for JSON uploads. Default: 4
  --png-workers N          Worker count for PNG uploads. Default: 64
  --mp3-workers N          Worker count for MP3 uploads. Default: 8
  --retry-count N          s5cmd retry count. Default: 20
  --attempts N             Max passes per file type. Default: 4
  --progress-seconds N     Console progress update interval. Default: 10
  --dry-run                Show missing counts without uploading.
  --no-invalidate          Skip CloudFront invalidation.
  --help                   Show this help text.
EOF
}

stream_s5cmd_progress() {
  local label="$1"
  local total="$2"
  local progress_seconds="$3"
  local uploaded=0
  local errors=0
  local last_report
  local now
  local line

  last_report="$(date +%s)"

  while IFS= read -r line; do
    case "$line" in
      "cp "*)
        uploaded=$((uploaded + 1))
        now="$(date +%s)"
        if (( uploaded == 1 || uploaded == total || now - last_report >= progress_seconds )); then
          printf '[%s] progress: %d/%d uploaded\n' "$label" "$uploaded" "$total"
          last_report="$now"
        fi
        ;;
      ERROR*)
        errors=$((errors + 1))
        printf '[%s] %s\n' "$label" "$line"
        ;;
      WARN*)
        printf '[%s] %s\n' "$label" "$line"
        ;;
    esac
  done

  if (( uploaded > 0 && uploaded < total )); then
    printf '[%s] pass finished after %d/%d successful uploads\n' "$label" "$uploaded" "$total"
  fi

  if (( errors > 0 )); then
    printf '[%s] pass reported %d error(s)\n' "$label" "$errors"
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

resolve_stack_output() {
  local output_key="$1"

  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`${output_key}\`].OutputValue | [0]" \
    --output text
}

prepare_remote_list() {
  local extension="$1"
  local output_file="$2"

  aws s3 ls "s3://$DATA_BUCKET" --recursive \
    | awk -v ext=".$extension" '$4 ~ (ext "$") { print $4 }' \
    | sort > "$output_file"
}

prepare_local_list() {
  local extension="$1"
  local output_file="$2"

  find "$EXPORT_ROOT" -type f -name "*.${extension}" \
    | sed "s#^$EXPORT_ROOT/##" \
    | sort > "$output_file"
}

build_batch() {
  local missing_file="$1"
  local batch_file="$2"
  local cache_control="$3"
  local content_type="$4"

  : > "$batch_file"
  while IFS= read -r relative_path; do
    [[ -n "$relative_path" ]] || continue
    printf 'cp --cache-control "%s" --content-type "%s" "%s/%s" "s3://%s/%s"\n' \
      "$cache_control" \
      "$content_type" \
      "$EXPORT_ROOT" \
      "$relative_path" \
      "$DATA_BUCKET" \
      "$relative_path" >> "$batch_file"
  done < "$missing_file"
}

process_type() {
  local label="$1"
  local extension="$2"
  local workers="$3"
  local cache_control="$4"
  local content_type="$5"
  local work_dir="$6"

  local local_file="$work_dir/local_${extension}.txt"
  local remote_file="$work_dir/remote_${extension}.txt"
  local missing_file="$work_dir/missing_${extension}.txt"
  local batch_file="$work_dir/batch_${extension}.txt"
  local log_file="$work_dir/${extension}.log"

  prepare_local_list "$extension" "$local_file"

  local attempt=1
  while (( attempt <= MAX_ATTEMPTS )); do
    prepare_remote_list "$extension" "$remote_file"
    comm -23 "$local_file" "$remote_file" > "$missing_file"

    local missing_count
    missing_count="$(wc -l < "$missing_file" | tr -d ' ')"
    echo "[$label] attempt $attempt missing: $missing_count"

    if [[ "$missing_count" == "0" ]]; then
      return 0
    fi

    if (( DRY_RUN )); then
      echo "[$label] dry run sample:"
      sed -n '1,10p' "$missing_file"
      return 0
    fi

    build_batch "$missing_file" "$batch_file" "$cache_control" "$content_type"
    local batch_count
    batch_count="$(wc -l < "$batch_file" | tr -d ' ')"

    echo "[$label] starting upload pass $attempt with $batch_count object(s), workers=$workers, retries=$RETRY_COUNT"
    echo "[$label] logging detailed output to $log_file"
    : > "$log_file"
    s5cmd --numworkers "$workers" --retry-count "$RETRY_COUNT" run "$batch_file" 2>&1 \
      | tee "$log_file" \
      | stream_s5cmd_progress "$label" "$batch_count" "$PROGRESS_SECONDS" || true
    echo "[$label] upload pass $attempt finished"

    attempt=$((attempt + 1))
  done

  prepare_remote_list "$extension" "$remote_file"
  comm -23 "$local_file" "$remote_file" > "$missing_file"

  local final_missing
  final_missing="$(wc -l < "$missing_file" | tr -d ' ')"
  if [[ "$final_missing" != "0" ]]; then
    echo "[$label] still missing after $MAX_ATTEMPTS attempts: $final_missing" >&2
    echo "[$label] sample missing keys:" >&2
    sed -n '1,20p' "$missing_file" >&2
    echo "[$label] recent log:" >&2
    tail -n 20 "$log_file" >&2 || true
    exit 1
  fi
}

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

AWS_REGION="${AWS_REGION:-$DEFAULT_REGION}"
STACK_NAME="${STATIC_VIEWER_STACK_NAME:-${STACK_NAME:-$DEFAULT_STACK_NAME}}"
EXPORT_ROOT="${TIMELINE_EXPORT_ROOT:-${EXPORT_ROOT:-}}"
DATA_BUCKET="${STATIC_VIEWER_DATA_BUCKET_NAME:-${DATA_BUCKET:-}}"
DISTRIBUTION_ID="${STATIC_VIEWER_DISTRIBUTION_ID:-${DISTRIBUTION_ID:-}}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --path)
      EXPORT_ROOT="$2"
      shift 2
      ;;
    --bucket)
      DATA_BUCKET="$2"
      shift 2
      ;;
    --distribution-id)
      DISTRIBUTION_ID="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    --json-workers)
      JSON_WORKERS="$2"
      shift 2
      ;;
    --png-workers)
      PNG_WORKERS="$2"
      shift 2
      ;;
    --mp3-workers)
      MP3_WORKERS="$2"
      shift 2
      ;;
    --retry-count)
      RETRY_COUNT="$2"
      shift 2
      ;;
    --progress-seconds)
      PROGRESS_SECONDS="$2"
      shift 2
      ;;
    --attempts)
      MAX_ATTEMPTS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-invalidate)
      INVALIDATE=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command aws
require_command s5cmd

if [[ -z "$EXPORT_ROOT" ]]; then
  echo "Missing export root. Use --path or set TIMELINE_EXPORT_ROOT." >&2
  exit 1
fi

if [[ ! -d "$EXPORT_ROOT" ]]; then
  echo "Export root does not exist: $EXPORT_ROOT" >&2
  exit 1
fi

if [[ ! -f "$EXPORT_ROOT/index.json" ]]; then
  echo "Export root is missing index.json: $EXPORT_ROOT/index.json" >&2
  exit 1
fi

if [[ -z "$DATA_BUCKET" ]]; then
  DATA_BUCKET="$(resolve_stack_output "StaticViewerDataBucketName")"
fi

if [[ -z "$DATA_BUCKET" || "$DATA_BUCKET" == "None" ]]; then
  echo "Could not resolve the data bucket name." >&2
  exit 1
fi

if (( INVALIDATE )) && [[ -z "$DISTRIBUTION_ID" ]]; then
  DISTRIBUTION_ID="$(resolve_stack_output "StaticViewerDistributionId")"
fi

if (( INVALIDATE )) && [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
  echo "Could not resolve the CloudFront distribution ID." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d /tmp/upload-missing-s3.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Export root: $EXPORT_ROOT"
echo "Bucket: $DATA_BUCKET"
echo "Region: $AWS_REGION"
if (( INVALIDATE )); then
  echo "Distribution: $DISTRIBUTION_ID"
else
  echo "Distribution: skipped"
fi
if (( DRY_RUN )); then
  echo "Mode: dry run"
fi
echo "Workers: json=$JSON_WORKERS png=$PNG_WORKERS mp3=$MP3_WORKERS"
echo "Retries per object: $RETRY_COUNT"
echo "Max attempts per file type: $MAX_ATTEMPTS"
echo "Progress interval: ${PROGRESS_SECONDS}s"

process_type "json" "json" "$JSON_WORKERS" "public, max-age=300" "application/json" "$WORK_DIR"
process_type "png" "png" "$PNG_WORKERS" "public, max-age=31536000, immutable" "image/png" "$WORK_DIR"
process_type "mp3" "mp3" "$MP3_WORKERS" "public, max-age=31536000, immutable" "audio/mpeg" "$WORK_DIR"

if (( DRY_RUN )); then
  exit 0
fi

if (( INVALIDATE )); then
  echo "Invalidating /data/* ..."
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/data/*" \
    --query 'Invalidation.Id' \
    --output text
fi

echo "Final counts:"
printf 'json '
aws s3 ls "s3://$DATA_BUCKET" --recursive | awk '$4 ~ /\.json$/ { print $4 }' | wc -l
printf 'png '
aws s3 ls "s3://$DATA_BUCKET" --recursive | awk '$4 ~ /\.png$/ { print $4 }' | wc -l
printf 'mp3 '
aws s3 ls "s3://$DATA_BUCKET" --recursive | awk '$4 ~ /\.mp3$/ { print $4 }' | wc -l
