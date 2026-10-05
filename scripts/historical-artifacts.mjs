import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

/** Immutable release records and distribution manifests retained in this repository. */
export const HISTORICAL_ARTIFACT_SHA256 = Object.freeze({
  "provenance/releases/shadcn-radix-release-001.json": "70795494166657dfcdc74a57626b5b9501621ffa8aaa11a17216a1cf72bbd6a9",
  "provenance/releases/shadcn-radix-release-002.json": "f63207dedd4d8e3c8656db50583660f5ab16174051c4ae847b3b6ddc1954f3ae",
  "provenance/releases/shadcn-radix-release-003.json": "2aa266790b3e74395750e0f6e703238f2e29192f46f4237094fae212263600eb",
  "provenance/releases/shadcn-radix-release-004.json": "bd90164eb8065a2e5c8a3209d9d831e85a8cf6b1134b44011e4921f57ab3d797",
  "provenance/releases/shadcn-radix-release-005.json": "a8f0be8d622a8e9f773af522564ec2398860cb7fe6ff49e4c057f65f81cbff88",
  "provenance/releases/shadcn-radix-release-006.json": "6fbdf4a98a7d0e5667e073857cd9beb3061b4d71b141dc38248008f37b8e7b43",
  "provenance/releases/shadcn-radix-release-007.json": "366a2dd45490a28689effc10a8c58b68d090d8d0d86895c7e6269c9bbd2ae45c",
  "provenance/releases/shadcn-radix-release-008.json": "890a1a25be20039270c0222524813786044137ff0b90b1843fb9ac0a527015db",
  "provenance/releases/shadcn-radix-release-009.json": "2df8a6b086af5b4d90c1bda2a9bb9a3304b18d20f3ef9871d5e5b640f85cd0d4",
  "provenance/releases/shadcn-radix-release-010.json": "6450355882fe28d3b17ec94bcdf379fdf80dfa4c88538356bb15cc1e0bf8cdac",
  "provenance/releases/shadcn-radix-release-011.json": "fd3afb47e710fa18f4007ad759134018ce4114ec0b5bfd5acb64bbcad4d35773",
  "provenance/releases/shadcn-radix-release-012.json": "2909c4112cd27a26e758c5080d731f98f75f5bb6b84de3edea94a08adf84335f",
  "provenance/releases/shadcn-radix-release-013.json": "aaa0ced0fb66e624bc405a075f7546bd305cd6feace7b37702806c538923e80a",
  "provenance/distributions/shadcn-radix-release-001.distribution.json": "e72d1a649f63b649bdafad6805ee481031e976072a3d8c2ce2f6858d47f97fea",
  "provenance/distributions/shadcn-radix-release-002.distribution.json": "5a06b7813edd9766f3bc2dca8e900e57fffe56776935eebbff998f1f8d16ea79",
  "provenance/distributions/shadcn-radix-release-003.distribution.json": "c75905422d8cd0b75f33d4dbd688bc378a112a64fac0023332c73e1732f46d31",
  "provenance/distributions/shadcn-radix-release-004.distribution.json": "ea074153c56bf6a012a0e9924369b9aa3a82a777e14b17ffade06b0b6349e46f",
  "provenance/distributions/shadcn-radix-release-007.distribution.json": "3631a7f0cf0edf62951e71a5c7b52a2971c629fd5fa72ec5178179b99f8d1168",
  "provenance/distributions/shadcn-radix-release-009.distribution.json": "79fbbc7657d68c4a3a5d5cf9db0ebf684617be78bb792036f8b89827d698e87f",
  "provenance/distributions/shadcn-radix-release-010.distribution.json": "49d4e2e65027011c8b7b861cc6b60778be0c4fb5151e2188058d3ab520845beb",
  "provenance/distributions/shadcn-radix-release-011.distribution.json": "9190ce39c049cc6016fdd976d6a2bb405ce74119bfda4847b4d7548a3f6577ea",
  "provenance/distributions/shadcn-radix-release-012.distribution.json": "cb65fccb2eafda2d5bfedae66b53f52ab01833094268a130e3bfff60821c8c53",
  "provenance/distributions/shadcn-radix-release-013.distribution.json": "112cc081ed62acc8ecfbc1d14fed3adb11c25560336bb3729c6ef8a95bab6f17",
})

export function assertHistoricalArtifacts(root, phase = "verification") {
  for (const [relativePath, expected] of Object.entries(HISTORICAL_ARTIFACT_SHA256)) {
    const actual = createHash("sha256").update(readFileSync(path.join(root, relativePath))).digest("hex")
    if (actual !== expected) throw new Error(`HISTORICAL_ARTIFACT_CHANGED (${phase}): ${relativePath}`)
  }
}
