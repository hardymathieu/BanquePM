#!/usr/bin/env bash
# Fails if a word from the local private list appears in tracked files or in any commit.
# The list lives in the gitignored spec folder, so the words themselves are never committed.
set -euo pipefail
list="claude_work_banque-papa-maman-spec/private-words.txt"
[ -f "$list" ] || { echo "no $list: nothing to check"; exit 0; }
found=0
while IFS= read -r word; do
  [ -z "$word" ] && continue
  if git grep -qIiw -- "$word"; then echo "PRIVATE WORD IN WORKING TREE/INDEX: $word"; found=1; fi
  hits=$(git log --all --format=%h -i -G "(^|[^[:alnum:]])${word}([^[:alnum:]]|$)")
  if [ -n "$hits" ]; then echo "PRIVATE WORD IN HISTORY: $word ($(echo $hits))"; found=1; fi
done < "$list"
[ "$found" = 0 ] && echo "private-word check: clean"
exit "$found"
