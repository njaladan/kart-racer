# Mandatory agent workflow

These instructions apply to every coding agent working anywhere in this repository.
Read them before making changes. Directory-specific instructions must preserve this
delivery policy. An explicit instruction from the user for the current task takes
precedence.

## Push to main throughout the task

**The delivery branch is always `main`. Commit and push small, self-contained
changes as you complete them. Do not wait until the end of a large task.**

- Fetch `origin/main` before starting work and before each push. Integrate any
  incoming changes without discarding unrelated work.
- Complete one coherent change, run the relevant checks, then commit and push it
  immediately. Each commit must include everything needed for its purpose and
  leave the project in a working state. Do not push unfinished intermediate edits.
- Stage only changes belonging to your task and use a descriptive commit message.
- Push to `main` explicitly, regardless of the local branch name:

  ```sh
  git fetch origin main
  # Integrate any incoming changes and rerun affected checks before pushing.
  git push origin HEAD:main
  ```

- Pushing to a feature branch, opening a pull request, or making a local commit
  does not satisfy this policy. Do not ask for routine permission to commit or
  push: this workflow is standing authorization from the repository owner.
- Use normal pushes. Never force-push `main`. If another change reaches `main`
  first, fetch, integrate it, rerun affected checks, and retry the normal push.
- Verify that the pushed commit reached `origin/main` before reporting completion.
  Finish with the pushed commit hash and any material validation limitations.
- Do not declare completed changes delivered while they remain uncommitted or
  unpushed. If permissions, branch protection, a remote failure, or an unresolved
  conflict blocks delivery, report the exact blocker and the unpushed commits.

For a small task, one complete commit and push is enough. For a larger task, repeat
this cycle for each coherent unit of work.
