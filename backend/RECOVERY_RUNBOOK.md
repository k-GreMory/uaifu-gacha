# User Recovery Runbook

Use the offline snapshot flow for collection recovery. Do not add temporary prod HTTP endpoints for this.

## Preconditions

- The target database must already have the app schema and card catalog bootstrapped.
- Start with `diff` before any `merge`.
- This tool is collection-focused. It restores a missing user fully, but for existing users it only fills blank profile fields, optionally fills `referred_by`, and merges collection cards conservatively.

## Export

```bash
python backend/user_data_tools.py export --db-url "sqlite:///./backend/gacha_v2.db" --user-id 908721870 --output "./tmp/user-908721870.json"
```

## Diff

```bash
python backend/user_data_tools.py diff --source-db-url "sqlite:///./backend/gacha_v2.db" --target-db-url "sqlite:////data/gacha_v2.db" --user-id 908721870
```

Review the JSON output before merging.

## Merge

Dry-run first:

```bash
python backend/user_data_tools.py merge --snapshot "./tmp/user-908721870.json" --target-db-url "sqlite:////data/gacha_v2.db" --user-id 908721870 --dry-run
```

Then apply:

```bash
python backend/user_data_tools.py merge --snapshot "./tmp/user-908721870.json" --target-db-url "sqlite:////data/gacha_v2.db" --user-id 908721870
```

## Merge Rules

- Existing non-empty `username` and `first_name` are never overwritten.
- Blank `username` and `first_name` may be filled from the snapshot.
- Target-only cards are preserved.
- For the same `card_id`, the higher `duplicates` value wins.
- Running the same merge twice is safe.
