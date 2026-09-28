# Task 6.4 accepted package artifact

Release `shadcn-radix-release-001` is accepted for the next Canvas task.

- Release SHA-256: `97eb857c7de37fbb88793f7f28cc3a684e2f644b30c51867b471e842d0d86697`
- Source commit: `9db5ab4c8abeab7710a474c45846a19d696fc952`
- Package: `@adc/shadcn-design-system@0.0.0-release.1`
- React peer requirement: `react` and `react-dom` exactly `18.3.1`
- Public package entrypoints: `.` , `./styles.css`, `./release` (3 total)
- External artifact directory: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-001`
- Tarball: `adc-shadcn-design-system-0.0.0-release.1.tgz`
- Tarball SHA-256: `92761dd7b7b7e41e84b50d04c35651342614ca0f6471152e14f8f7ae7c2a2d80`
- npm integrity: `sha512-rtdsBrRqrfWRzpg8mAGFTjSiFs/qulMXJzKKxQMXBE4+SQ9Q/p6UrrM0rKmo43ENHZDSEePSpP9yq6q0tMrKCA==`
- Durable external distribution manifest: `provenance/distributions/shadcn-radix-release-001.distribution.json`
- Distribution manifest SHA-256: `e72d1a649f63b649bdafad6805ee481031e976072a3d8c2ce2f6858d47f97fea`
- Packed files: 35

The retained external manifest is a byte-for-byte copy of the final candidate's
`distribution-manifest.json`; it is not an implementation input and is not
included in the tarball. The release itself does not hash or reference the
tarball, so there is no circular identity.

An independent clean rebuild produced byte-identical tarball and manifest
bytes. The isolated consumer run against this exact external artifact completed
with `success: true`, including package-byte verification before and after use.

Canvas Task 7 must install this exact local artifact:

```sh
npm install /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-001/adc-shadcn-design-system-0.0.0-release.1.tgz
```

The `.tgz` itself is **not committed to Git**. The committed distribution
manifest and this handoff record are durable provenance; the external tarball
is the exact local artifact to hand to Canvas next.
