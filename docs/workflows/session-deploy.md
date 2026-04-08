# session-deploy

Manual operational workflow for deploying or redeploying the active
viewer-only AWS stack. Use it only when the user explicitly wants to publish
the current viewer build to AWS and verify that the local export root matches
the deployed data bucket.

## Preconditions

- You are working on the intended branch for the deploy target
- `HEAD` is not detached
- Prefer a clean working tree; if the tree is dirty, stop unless the user
  explicitly wants to deploy uncommitted changes
- Deploy environment variables are loaded from the shell or `.env.deploy`
- This workflow applies only to the active viewer-only CloudFront/S3 path, not
  the dormant annotation API stack

## Steps

1. **Check deploy state**
   - Confirm the current branch and whether the working tree is clean
   - Confirm the active deploy scope is the viewer-only CDK stack
   - Load `.env.deploy` when present

2. **Validate deploy inputs**
   - Confirm AWS credentials are available
   - Confirm the target stack name and region
   - Confirm `TIMELINE_EXPORT_ROOT` or `--path` is set unless the user wants
     an app-only deploy with `--skip-data`

3. **Run the smart deploy helper**
   - Preferred dry run:
     - `pnpm deploy:viewer -- --dry-run`
   - Normal deploy:
     - `pnpm deploy:viewer`
   - Useful overrides:
     - `pnpm deploy:viewer -- --path /abs/export/root`
     - `pnpm deploy:viewer -- --skip-data`
     - `pnpm deploy:viewer -- --allow-dirty` only when the user explicitly
       wants to deploy uncommitted changes

4. **Let the helper choose the right path**
   - Always run `pnpm cdk:synth` first
   - If the stack does not exist, create it with `pnpm cdk:deploy`
   - If the stack exists, inspect the diff and deploy only when the
     infrastructure changed
   - Resolve the deployed bucket names and CloudFront distribution ID from the
     stack outputs
   - Publish the viewer app bundle
   - Verify that the deployed data bucket matches the local export root
   - Fail the workflow when the bucket is missing local objects, contains extra
     remote objects, or has size/JSON mismatches

5. **Report the result**
   - State whether `cdk deploy`, app publish, and data verification ran or were
     skipped
   - Include the viewer URL and data URL when available
   - If data verification fails, point to `pnpm upload:viewer:missing` for a
     manual missing-object upload and note that extra remote keys must be
     removed separately

## Does NOT

- Generate timeline export artifacts from source media
- Deploy the dormant annotation API, DynamoDB tables, or auth path
- Upload timeline export data automatically
- Replace the lower-level `pnpm cdk:*`, `pnpm publish:viewer:*`, or
  `pnpm upload:viewer:missing` commands for operators who want manual control

## Output

Summary of the deploy actions taken, skipped steps with reasons, and the
resulting viewer/data URLs when available.

## Next Step

- Continue normal development work if deployment succeeded
- `session-debug` if deploy verification exposes an issue
