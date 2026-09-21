-- 0005 — registry guardrails for the BlobStore (critic BLOCKED follow-up).
-- Defense in depth behind the application checks: direct SQL must not admit
-- negative sizes, malformed hashes, or empty/overlong filenames.
alter table blob_file add constraint blob_file_size_bytes_check check (size_bytes >= 0);
alter table blob_file add constraint blob_file_sha256_check check (sha256 ~ '^[0-9a-f]{64}$');
alter table blob_file add constraint blob_file_filename_check
  check (char_length(filename) between 1 and 255);
