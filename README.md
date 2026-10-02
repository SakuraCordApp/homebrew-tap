# SakuraCord Homebrew tap

Install the latest regular [SakuraCord](https://sakuracord.app) release on
Apple Silicon with macOS 27 or newer:

```sh
brew install --cask SakuraCordApp/tap/sakuracord
```

Update an installed release:

```sh
brew update
brew upgrade --cask sakuracord
```

SakuraCord also supports in-app updates. To include it when upgrading all casks,
use `brew upgrade --cask --greedy-auto-updates`.

Current releases are ad-hoc signed and not notarized. First launch may require
approval in **System Settings → Privacy & Security**.

Uninstall with `brew uninstall --cask sakuracord`. This preserves app data.

## Maintenance

The **Update cask** workflow checks the latest regular GitHub release hourly;
it can also be run manually. It verifies the downloaded DMG against GitHub's
SHA-256 digest before committing the version, URL, and checksum. Beta releases
are excluded. No cross-repository secret is required: the workflow uses this
tap's `GITHUB_TOKEN`. Allow GitHub Actions to write contents on `main`.

The macOS and architecture requirements in `Casks/sakuracord.rb` must stay
aligned with the published app. If the packaging layout or requirements change,
update the cask as part of that release.

For local validation:

```sh
node --test script/update-cask.test.mjs
node script/update-cask.mjs
brew style Casks/sakuracord.rb
brew tap --custom-remote SakuraCordApp/tap "$PWD"
brew audit --cask --online SakuraCordApp/tap/sakuracord
```

The local tap command reads committed files. After validation, run
`brew untap SakuraCordApp/tap` to remove the local test tap before using the
published repository.

Report app and installation problems in the
[SakuraCord issue tracker](https://github.com/SakuraCordApp/SakuraCord/issues).
