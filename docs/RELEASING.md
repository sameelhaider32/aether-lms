# Releasing Aether LMS

Changes go through a pull request and all required checks before reaching `main`. Only the maintainer can currently merge contributions. Adding another collaborator with write access also grants merge privileges; review branch rules before granting that role.

## Before each release

1. Update `manifest.json`, `package.json`, and the lockfile version together, plus the README version and changelog. Use a feature branch and pull request.
2. Add regression coverage for changed behavior. Wait for Windows/Linux tests, packaged-extension checks, dependency review, and security analysis to pass. Read the changes yourself, including workflow, permission, network, and vendored-library changes.
3. Check the Security tab for new CodeQL or dependency alerts. A successful CodeQL upload means analysis completed; it does not mean there are no findings. Resolve relevant high-risk findings before release.
4. Try affected workflows in your signed-in LUMS session, including relevant student/TA permissions. Automated fixtures cannot prove live customization compatibility. Keep private records and screenshots out of the repository.
5. Use the successful **Checks** run for the exact `main` commit you intend to release. Download its **tested-extension** artifact, which contains the extension ZIP and SHA-256 hashes. Test that ZIP unpacked in Chrome.
6. Create a GitHub release for that exact commit and version tag. Attach the extension ZIP and hash JSON inside the artifact. Mark beta releases as pre-releases and describe meaningful limitations. Do not attach browser profiles, reports containing private captures, or development-history bundles.

No workflow automatically merges or publishes releases. The maintainer chooses when a tested commit is ready. Never publish an artifact from an untrusted contribution before reviewing and merging its source.

## Dependencies

Dependabot proposes updates; it does not merge them. Review changes, licenses, test results, and relevant advisories. Npm/action checks do not cover every bundled binary or minified runtime library. For `vendor/` upgrades, update the actual local bundle, notices and provenance together, verify the new hashes, and test the affected file readers with valid, invalid, oversized, and permission-restricted fictional samples.
