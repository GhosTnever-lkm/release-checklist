# Release Checklist

> Evidence-based release readiness checks and follow-up actions.

![CI](https://github.com/GhosTnever-lkm/release-checklist/actions/workflows/ci.yml/badge.svg)

Current version: **1.0.2**.

## Install in Codex

Add this pinned repository version as a plugin marketplace, then install the plugin:

    codex plugin marketplace add GhosTnever-lkm/release-checklist@v1.0.2
    codex plugin add release-checklist --marketplace release-checklist

To inspect the marketplace after adding it, run `codex plugin marketplace list`. The selected tag keeps the installed marketplace on a known release instead of following future changes on `main`. See the [official Codex marketplace instructions](https://developers.openai.com/plugins/build/plugins) for supported source and ref formats.

## Use it

Start a Codex task that matches the skill's purpose. The plugin instructions live in `skills/release-readiness/SKILL.md` and are included in the marketplace source for inspection.

## Scope

This focused Codex plugin has no external service, background process, or credential requirement. It reviews repository evidence and prepares follow-up actions. It does not publish, tag, deploy, or announce releases automatically.

## Validate this repository

Requires Node.js 20 or newer. The checker and tests use built-in Node.js modules only:

```bash
npm run ci
```

## ☕ Support / Pro Version

The plugin is free and open source under MIT. No separate Pro version is currently offered. If it is useful, support GhosTnever on [Boosty](https://boosty.to/azizazimov), [Buy Me a Coffee](https://buymeacoffee.com/azizazimov8), or [Gumroad](https://azimovian22.gumroad.com/).

## License

MIT. See [LICENSE](LICENSE).