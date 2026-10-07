# release-checklist

> Evidence-based release readiness checks and follow-up actions.

## Install in Codex

Add this repository as a plugin marketplace, then install the plugin:

```powershell
codex plugin marketplace add GhosTnever-lkm/release-checklist
codex plugin add release-checklist --marketplace release-checklist
```

To inspect the marketplace after adding it, run codex plugin list. Codex may ask you to restart or reload plugins before the skill becomes available.

## Use it

Start a Codex task that matches the skill's purpose. The plugin instructions live in skills/ and are included in the marketplace source for inspection.

## Scope

This is a focused Codex skill. It has no external service, background process, or credential requirement. See the skill file for its workflow and limits.

## License

MIT. See [LICENSE](LICENSE).
