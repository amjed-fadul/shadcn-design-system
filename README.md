# Retained release artifacts for CI

Byte-exact copies of the externally retained Release 003 and Release 004 package
artifacts. The baseline workflow extracts this orphan branch outside the checkout,
checks `SHA256SUMS`, and points the tests at it with `ADC_R3_ARTIFACT_DIRECTORY` and
`ADC_R4_ARTIFACT_DIRECTORY`. The tests independently pin the same hashes.

Never rewrite these files. A new retained artifact gets a new directory.
